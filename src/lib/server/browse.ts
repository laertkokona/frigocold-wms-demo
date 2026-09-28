import { Prisma } from "@/generated/prisma/client";
import { getDb } from "./db";

export type BrowseKind = "clients" | "suppliers" | "inventory" | "movements" | "search";
export type BrowseParams = { kind: BrowseKind; q: string; page: number; pageSize: number; sort: string; direction: "asc" | "desc"; filter: string };

const sorts: Record<BrowseKind, Record<string, string>> = {
  clients: { name: 'name', orders: 'orders', kg: 'kg', value: 'value', last: 'last' },
  suppliers: { name: 'name', shipments: 'shipments', kg: 'kg', spend: 'spend', stock: 'stock', last: 'last' },
  inventory: { expiry: 'expiry', product: 'product', kg: 'remaining_kg', entry: 'entry_date' },
  movements: { date: 'date', kg: 'kg', value: 'value' },
  search: { date: 'date', title: 'title' },
};

function baseQuery(p: BrowseParams): Prisma.Sql {
  const match = `%${p.q}%`;
  const dateQuery = /^\d{2}\/\d{2}\/\d{4}$/.test(p.q) ? `${p.q.slice(6)}-${p.q.slice(3, 5)}-${p.q.slice(0, 2)}` : p.q;
  const dateMatch = `%${dateQuery}%`;
  switch (p.kind) {
    case "clients": return Prisma.sql`
      SELECT c.id, c.name, c.city, c.contact, c.phone,
        COALESCE(t.orders, 0)::int AS orders, COALESCE(t.kg, 0) AS kg,
        COALESCE(t.value, 0) AS value, t.last
      FROM clients c LEFT JOIN (
        SELECT sa.client_id, COUNT(DISTINCT sa.id)::int AS orders, SUM(sl.kg) AS kg,
          SUM(sl.kg * sl.price_per_kg) AS value, MAX(sa.date) AS last
        FROM sales sa LEFT JOIN sale_lines sl ON sl.sale_id = sa.id GROUP BY sa.client_id
      ) t ON t.client_id = c.id
      WHERE c.name ILIKE ${match} OR c.city ILIKE ${match} OR COALESCE(c.contact, '') ILIKE ${match}
    `;
    case "suppliers": return Prisma.sql`
      SELECT s.id, s.name, s.country, s.contact, s.phone,
        COALESCE(t.shipments, 0)::int AS shipments, COALESCE(t.kg, 0) AS kg,
        COALESCE(t.spend, 0) AS spend, COALESCE(t.stock, 0) AS stock, t.last
      FROM suppliers s LEFT JOIN (
        SELECT sh.supplier_id, COUNT(*)::int AS shipments, SUM(sh.net_kg_actual) AS kg,
          SUM(sh.net_kg_actual * sh.cost_per_kg) AS spend,
          SUM(COALESCE(b.kg, 0)) AS stock, MAX(sh.entry_date) AS last
        FROM shipments sh LEFT JOIN (
          SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id
        ) b ON b.shipment_id = sh.id GROUP BY sh.supplier_id
      ) t ON t.supplier_id = s.id
      WHERE s.name ILIKE ${match} OR s.country ILIKE ${match} OR COALESCE(s.contact, '') ILIKE ${match}
    `;
    case "inventory": return Prisma.sql`
      SELECT sh.id, sh.product_id AS "productId", p.name AS product,
        sh.supplier_id AS "supplierId", su.name AS supplier, sh.order_nr AS "orderNr",
        sh.load_type AS "loadType", sh.count_actual AS "countActual",
        sh.net_kg_actual AS "netKgActual", sh.cost_per_kg AS "costPerKg",
        sh.entry_date, sh.exp_from AS expiry,
        COALESCE(b.kg, 0) AS remaining_kg, COALESCE(b.qty, 0)::int AS remaining_count,
        COALESCE(l.lots, '') AS lots
      FROM shipments sh JOIN products p ON p.id = sh.product_id
      JOIN suppliers su ON su.id = sh.supplier_id
      LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg, SUM(qty) AS qty FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
      LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
      WHERE COALESCE(b.kg, 0) > 0 AND (
        p.name ILIKE ${match} OR su.name ILIKE ${match} OR sh.order_nr ILIKE ${match}
        OR sh.entry_date ILIKE ${dateMatch} OR EXISTS (
          SELECT 1 FROM shipment_lots fl WHERE fl.shipment_id = sh.id AND fl.lot_number ILIKE ${match}
        )
      )
    `;
    case "movements": return Prisma.sql`
      SELECT * FROM (
        SELECT sh.id, sh.entry_date AS date, 'IN'::text AS type, p.name AS product,
          COALESCE(l.lots, '') AS lot, su.name AS party, sh.count_actual AS qty,
          sh.net_kg_actual AS kg, sh.net_kg_actual * sh.cost_per_kg AS value,
          CONCAT('Porosia ', sh.order_nr) AS method
        FROM shipments sh JOIN products p ON p.id = sh.product_id
        JOIN suppliers su ON su.id = sh.supplier_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        UNION ALL
        SELECT sl.id, sa.date, 'OUT'::text, p.name, COALESCE(l.lots, ''), c.name,
          sl.qty, sl.kg, sl.kg * sl.price_per_kg, sl.method
        FROM sale_lines sl JOIN sales sa ON sa.id = sl.sale_id
        JOIN shipments sh ON sh.id = sl.shipment_id JOIN products p ON p.id = sh.product_id
        JOIN clients c ON c.id = sa.client_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
      ) m WHERE (${p.filter === "IN" || p.filter === "OUT" ? p.filter : "ALL"} = 'ALL' OR m.type = ${p.filter === "IN" || p.filter === "OUT" ? p.filter : "ALL"})
        AND (m.product ILIKE ${match} OR m.lot ILIKE ${match} OR m.party ILIKE ${match} OR m.method ILIKE ${match})
    `;
    case "search": return Prisma.sql`
      SELECT * FROM (
        SELECT sh.id, 'ship'::text AS type, CONCAT('Lot ', COALESCE(l.lots, ''), ' · ', p.name) AS title,
          CONCAT('Porosia ', sh.order_nr, ' · ', su.name, ' · hyri ', sh.entry_date) AS sub,
          COALESCE(b.kg, 0) AS amount, sh.entry_date AS date
        FROM shipments sh JOIN products p ON p.id = sh.product_id JOIN suppliers su ON su.id = sh.supplier_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
        WHERE sh.order_nr ILIKE ${match} OR p.name ILIKE ${match} OR su.name ILIKE ${match}
          OR sh.entry_date ILIKE ${dateMatch} OR EXISTS (
            SELECT 1 FROM shipment_lots fl WHERE fl.shipment_id = sh.id AND fl.lot_number ILIKE ${match}
          )
        UNION ALL
        SELECT p.id, 'prod'::text, p.name, COALESCE(p.origin, ''), COALESCE(SUM(b.kg), 0), NULL::varchar(10)
        FROM products p LEFT JOIN shipments sh ON sh.product_id = p.id
        LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
        WHERE p.name ILIKE ${match} GROUP BY p.id
        UNION ALL
        SELECT c.id, 'cli'::text, c.name, c.city, COALESCE(SUM(sl.kg * sl.price_per_kg), 0), NULL::varchar(10)
        FROM clients c LEFT JOIN sales sa ON sa.client_id = c.id LEFT JOIN sale_lines sl ON sl.sale_id = sa.id
        WHERE c.name ILIKE ${match} OR c.city ILIKE ${match} OR COALESCE(c.contact, '') ILIKE ${match}
        GROUP BY c.id
      ) hits WHERE (${p.filter === "ship" || p.filter === "prod" || p.filter === "cli" ? p.filter : "all"} = 'all' OR hits.type = ${p.filter === "ship" || p.filter === "prod" || p.filter === "cli" ? p.filter : "all"})
    `;
  }
}

export async function browse(p: BrowseParams) {
  if (p.kind === "search" && !p.q.trim()) return { items: [], total: 0, page: p.page, pageSize: p.pageSize };
  const base = baseQuery(p);
  const sort = sorts[p.kind][p.sort] ?? Object.values(sorts[p.kind])[0];
  const direction = p.direction === "asc" ? "ASC" : "DESC";
  const offset = (p.page - 1) * p.pageSize;
  const [counts, items] = await Promise.all([
    getDb().$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total FROM (${base}) q`),
    getDb().$queryRaw<Record<string, unknown>[]>(Prisma.sql`SELECT * FROM (${base}) q ORDER BY ${Prisma.raw(sort)} ${Prisma.raw(direction)} NULLS LAST, id ASC LIMIT ${p.pageSize} OFFSET ${offset}`),
  ]);
  return { items: items.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" || value instanceof Prisma.Decimal ? Number(value) : value]))), total: Number(counts[0]?.total ?? 0), page: p.page, pageSize: p.pageSize };
}
