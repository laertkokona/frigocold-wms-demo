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

const MOVEMENT_TYPES = ["IN", "OUT", "RET", "ADJ", "ANUL", "KOR"];

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
        FROM sales sa LEFT JOIN sale_lines sl ON sl.sale_id = sa.id WHERE sa.cancelled_at IS NULL GROUP BY sa.client_id
      ) t ON t.client_id = c.id
      WHERE c.name ILIKE ${match} OR c.city ILIKE ${match} OR COALESCE(c.contact, '') ILIKE ${match}
    `;
    case "suppliers": return Prisma.sql`
      SELECT s.id, s.name, s.country, s.contact, s.phone,
        COALESCE(t.shipments, 0)::int AS shipments, COALESCE(t.kg, 0) AS kg,
        CASE WHEN t.shipments IS NULL THEN 0 ELSE t.spend END AS spend, COALESCE(t.stock, 0) AS stock, t.last
      FROM suppliers s LEFT JOIN (
        SELECT sh.supplier_id, COUNT(*)::int AS shipments, SUM(sh.net_kg_actual) AS kg,
          CASE WHEN COUNT(*) FILTER (WHERE sh.cost_per_kg IS NULL) > 0 THEN NULL ELSE SUM(sh.net_kg_actual * sh.cost_per_kg) END AS spend,
          SUM(COALESCE(b.kg, 0)) AS stock, MAX(sh.entry_date) AS last
        FROM shipments sh LEFT JOIN (
          SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id
        ) b ON b.shipment_id = sh.id WHERE sh.cancelled_at IS NULL GROUP BY sh.supplier_id
      ) t ON t.supplier_id = s.id
      WHERE s.name ILIKE ${match} OR s.country ILIKE ${match} OR COALESCE(s.contact, '') ILIKE ${match}
    `;
    case "inventory": return Prisma.sql`
      SELECT sh.id, sh.product_id AS "productId", p.name AS product,
        sh.supplier_id AS "supplierId", su.name AS supplier, sh.order_nr AS "orderNr", (sh.return_of_line_id IS NOT NULL) AS "isReturn",
        sh.load_type AS "loadType", sh.count_actual AS "countActual",
        sh.net_kg_actual AS "netKgActual", sh.cost_per_kg AS "costPerKg",
        sh.entry_date, sh.exp_from AS expiry,
        COALESCE(b.kg, 0) AS remaining_kg, CASE WHEN sh.count_actual IS NULL THEN NULL ELSE COALESCE(b.qty, 0)::int END AS remaining_count,
        COALESCE(l.lots, '') AS lots, sh.fixed_kg AS "fixedKg", sh.origin, sh.specs
      FROM shipments sh JOIN products p ON p.id = sh.product_id
      LEFT JOIN suppliers su ON su.id = sh.supplier_id
      LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg, SUM(qty) AS qty FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
      LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
      WHERE COALESCE(b.kg, 0) > 0 AND sh.cancelled_at IS NULL AND (
        p.name ILIKE ${match} OR su.name ILIKE ${match} OR sh.order_nr ILIKE ${match}
        OR sh.origin ILIKE ${match} OR sh.specs ILIKE ${match}
        OR sh.entry_date ILIKE ${dateMatch} OR EXISTS (
          SELECT 1 FROM shipment_lots fl WHERE fl.shipment_id = sh.id AND fl.lot_number ILIKE ${match}
        )
      )
    `;
    // One row per order: a sale (all its lines), a truck received from a supplier, a return, a shortage or a
    // correction. Each row carries its lines for the detail view; search matches any line of the order.
    case "movements": return Prisma.sql`
      SELECT g.gid AS id, MIN(g.date) AS date, g.type, MAX(g.party) AS party, COUNT(*)::int AS items,
        CASE WHEN COUNT(g.qty) = COUNT(*) THEN SUM(g.qty)::int END AS qty, SUM(g.kg) AS kg,
        CASE WHEN COUNT(g.value) = COUNT(*) THEN SUM(g.value) END AS value,
        STRING_AGG(DISTINCT g.product, ', ') AS products, MAX(g.ref) AS ref, MIN(g.method) AS method,
        JSON_AGG(JSON_BUILD_OBJECT('id', g.id, 'sid', g.sid, 'product', g.product, 'lot', g.lot, 'qty', g.qty, 'kg', g.kg, 'price', g.price, 'value', g.value, 'method', g.method) ORDER BY g.product, g.kg DESC) AS lines
      FROM (
        -- A truck (same day, supplier and order number) is one entry; loads without a supplier stay on their own.
        SELECT sh.id, CASE WHEN sh.return_of_line_id IS NULL AND sh.supplier_id IS NOT NULL THEN CONCAT('in:', sh.entry_date, ':', sh.supplier_id, ':', COALESCE(sh.order_nr, '')) ELSE sh.id::text END AS gid,
          sh.id AS sid, sh.cost_per_kg AS price, sh.order_nr AS ref, sh.entry_date AS date, CASE WHEN sh.return_of_line_id IS NULL THEN 'IN' ELSE 'RET' END AS type, p.name AS product,
          COALESCE(l.lots, '') AS lot, COALESCE(rc.name, su.name) AS party, sh.count_actual AS qty,
          COALESCE(im.kg, sh.net_kg_actual) AS kg, COALESCE(im.kg, sh.net_kg_actual) * sh.cost_per_kg AS value,
          CASE WHEN sh.return_of_line_id IS NOT NULL THEN CONCAT('kthim: ', sh.return_reason)
            WHEN sh.order_nr IS NULL THEN 'Pa nr. porosie' ELSE CONCAT('Porosia ', sh.order_nr) END AS method
        FROM shipments sh JOIN products p ON p.id = sh.product_id
        LEFT JOIN suppliers su ON su.id = sh.supplier_id
        LEFT JOIN sale_lines rl ON rl.id = sh.return_of_line_id LEFT JOIN sales rs ON rs.id = rl.sale_id LEFT JOIN clients rc ON rc.id = rs.client_id
        -- The entry row shows the kilograms as received; later corrections appear as their own KOR rows.
        LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg FROM movements WHERE type = 'IN' GROUP BY shipment_id) im ON im.shipment_id = sh.id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        WHERE sh.cancelled_at IS NULL
        UNION ALL
        SELECT sl.id, sa.id::text, sl.shipment_id, sl.price_per_kg, sa.receipt_nr::varchar, sa.date, 'OUT'::text, p.name, COALESCE(l.lots, ''), c.name,
          sl.qty, sl.kg, sl.kg * sl.price_per_kg,
          CASE sl.method WHEN 'FIXED' THEN 'peshë fikse' WHEN 'VARIABLE' THEN 'peshë e ndryshme' WHEN 'TOTAL' THEN 'peshë totale' ELSE 'paleta' END
        FROM sale_lines sl JOIN sales sa ON sa.id = sl.sale_id
        JOIN shipments sh ON sh.id = sl.shipment_id JOIN products p ON p.id = sh.product_id
        JOIN clients c ON c.id = sa.client_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        WHERE sa.cancelled_at IS NULL
        UNION ALL
        SELECT sl.id, sa.id::text, sl.shipment_id, sl.price_per_kg, sa.receipt_nr::varchar, sa.date, 'ANUL'::text, p.name, COALESCE(l.lots, ''), c.name,
          sl.qty, sl.kg, sl.kg * sl.price_per_kg,
          CONCAT('shitje e anuluar më ', TO_CHAR((sa.cancelled_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Tirane', 'DD/MM/YYYY'), ' — ', sa.cancel_reason)
        FROM sale_lines sl JOIN sales sa ON sa.id = sl.sale_id
        JOIN shipments sh ON sh.id = sl.shipment_id JOIN products p ON p.id = sh.product_id
        JOIN clients c ON c.id = sa.client_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        WHERE sa.cancelled_at IS NOT NULL
        UNION ALL
        SELECT k.id, k.id::text, k.shipment_id, sh.cost_per_kg, NULL::varchar, k.date, 'KOR'::text, p.name, COALESCE(l.lots, ''), su.name,
          NULL::int, k.kg_after - k.kg_before, (k.kg_after - k.kg_before) * sh.cost_per_kg,
          CONCAT('korrigjim i kg: ', TRIM(TO_CHAR(k.kg_before, 'FM999999990.999'), '.'), ' → ', TRIM(TO_CHAR(k.kg_after, 'FM999999990.999'), '.'), ' kg — ', k.note)
        FROM shipment_corrections k JOIN shipments sh ON sh.id = k.shipment_id JOIN products p ON p.id = sh.product_id
        LEFT JOIN suppliers su ON su.id = sh.supplier_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        WHERE sh.cancelled_at IS NULL
        UNION ALL
        SELECT a.id, a.id::text, a.shipment_id, sh.cost_per_kg, NULL::varchar, a.date, 'ADJ'::text, p.name, COALESCE(l.lots, ''), NULL::varchar,
          a.qty, a.kg, a.kg * sh.cost_per_kg,
          CONCAT('mungesë: ', CASE a.reason WHEN 'SUPPLIER' THEN 'furnizuesi ngarkoi më pak' WHEN 'COUNT' THEN 'gabim në numërim'
            WHEN 'UNRECORDED_SALE' THEN 'shitje e paregjistruar' WHEN 'DAMAGED' THEN 'i dëmtuar / i prishur' ELSE 'tjetër' END,
            CASE WHEN a.note IS NULL THEN '' ELSE CONCAT(' — ', a.note) END)
        FROM stock_adjustments a JOIN shipments sh ON sh.id = a.shipment_id JOIN products p ON p.id = sh.product_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        WHERE sh.cancelled_at IS NULL
      ) g WHERE (${MOVEMENT_TYPES.includes(p.filter) ? p.filter : "ALL"} = 'ALL' OR g.type = ${MOVEMENT_TYPES.includes(p.filter) ? p.filter : "ALL"})
      GROUP BY g.gid, g.type
      HAVING BOOL_OR(g.product ILIKE ${match} OR g.lot ILIKE ${match} OR g.party ILIKE ${match} OR g.method ILIKE ${match} OR COALESCE(g.ref, '') ILIKE ${match})
    `;
    case "search": return Prisma.sql`
      SELECT * FROM (
        SELECT sh.id, 'ship'::text AS type, CONCAT('Lot ', COALESCE(l.lots, ''), ' · ', p.name) AS title,
          CONCAT('Porosia ', sh.order_nr, ' · ', su.name, ' · hyri ', sh.entry_date) AS sub,
          COALESCE(b.kg, 0) AS amount, sh.entry_date AS date
        FROM shipments sh JOIN products p ON p.id = sh.product_id LEFT JOIN suppliers su ON su.id = sh.supplier_id
        LEFT JOIN (SELECT shipment_id, STRING_AGG(lot_number, ', ' ORDER BY lot_number) AS lots FROM shipment_lots GROUP BY shipment_id) l ON l.shipment_id = sh.id
        LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
        WHERE sh.cancelled_at IS NULL AND (sh.order_nr ILIKE ${match} OR p.name ILIKE ${match} OR su.name ILIKE ${match}
          OR sh.entry_date ILIKE ${dateMatch} OR EXISTS (
            SELECT 1 FROM shipment_lots fl WHERE fl.shipment_id = sh.id AND fl.lot_number ILIKE ${match}
          ))
        UNION ALL
        SELECT p.id, 'prod'::text, p.name, COALESCE(p.origin, ''), COALESCE(SUM(b.kg), 0), NULL::varchar(10)
        FROM products p LEFT JOIN shipments sh ON sh.product_id = p.id
        LEFT JOIN (SELECT shipment_id, SUM(kg) AS kg FROM movements GROUP BY shipment_id) b ON b.shipment_id = sh.id
        WHERE p.name ILIKE ${match} GROUP BY p.id
        UNION ALL
        SELECT c.id, 'cli'::text, c.name, c.city, COALESCE(SUM(sl.kg * sl.price_per_kg), 0), NULL::varchar(10)
        FROM clients c LEFT JOIN sales sa ON sa.client_id = c.id AND sa.cancelled_at IS NULL LEFT JOIN sale_lines sl ON sl.sale_id = sa.id
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
