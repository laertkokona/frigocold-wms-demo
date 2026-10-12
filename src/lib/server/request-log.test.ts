import assert from "node:assert/strict";
import test from "node:test";
import { redirect } from "next/navigation";
import { withRequestLog, type LogWriter } from "./request-log";

function capture() {
  const records: { level: string; data: Record<string, unknown> }[] = [];
  const write: LogWriter = (level, line) => records.push({ level, data: JSON.parse(line) });
  return { records, write };
}

test("completed requests preserve the response and expose the logged correlation ID", async () => {
  const { records, write } = capture();
  const handler = withRequestLog({ route: "/api/commands", action: "command" }, async (_request, log) => {
    log.actor("00000000-0000-4000-8000-000000000001");
    log.action("addShipment");
    log.operation("00000000-0000-4000-8000-000000000002");
    log.result("00000000-0000-4000-8000-000000000003");
    log.writeOutcome("completed");
    return Response.json({ result: "created" }, { status: 201, headers: { "Cache-Control": "no-store", "Set-Cookie": "session=test; HttpOnly" } });
  }, write);
  const response = await handler(new Request("https://example.test/api/commands", { method: "POST" }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { result: "created" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("set-cookie"), "session=test; HttpOnly");
  assert.equal(records.length, 1);
  const { data, level } = records[0];
  assert.equal(level, "info");
  assert.equal(data.event, "api.request");
  assert.equal(data.requestId, response.headers.get("x-request-id"));
  assert.match(String(data.requestId), /^[a-f0-9-]{36}$/);
  assert.equal(data.action, "addShipment");
  assert.equal(data.status, 201);
  assert.equal(data.writeOutcome, "completed");
  assert.equal(data.userId, "00000000-0000-4000-8000-000000000001");
  assert.equal(data.operationId, "00000000-0000-4000-8000-000000000002");
  assert.equal(data.resultId, "00000000-0000-4000-8000-000000000003");
  assert.ok(typeof data.durationMs === "number" && data.durationMs >= 0);
  assert.ok(Number.isFinite(Date.parse(String(data.timestamp))));
});

test("handled validation and stock failures produce warning logs without changing error responses", async () => {
  for (const [status, reason] of [[400, "validation_failed"], [401, "authentication_required"], [409, "stock_conflict"], [429, "login_rate_limited"]] as const) {
    const { records, write } = capture();
    const handler = withRequestLog({ route: "/api/commands", action: "command" }, async (_request, log) => {
      log.reason(reason);
      return Response.json({ error: "Expected rejection" }, { status });
    }, write);
    const response = await handler(new Request("https://example.test/api/commands"));
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: "Expected rejection" });
    assert.equal(records[0].level, "warn");
    assert.equal(records[0].data.reason, reason);
    assert.equal(records[0].data.status, status);
  }
});

test("request bodies, query strings, headers and exception messages never enter logs", async () => {
  const { records, write } = capture();
  const secret = "PRIVATE_PASSWORD_AND_DATABASE_URL";
  const handler = withRequestLog({ route: "/api/auth/login", action: "login" }, async () => {
    const error = new Error(`${secret}\n at secret-frame ${secret}`);
    error.stack = `${secret}\n at ${secret}`;
    throw error;
  }, write);
  const response = await handler(new Request(`https://example.test/api/auth/login?password=${secret}`, {
    method: "POST", headers: { Authorization: secret, Cookie: secret, "x-request-id": secret }, body: JSON.stringify({ password: secret }),
  }));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error, "Internal server error");
  assert.equal(body.requestId, records[0].data.requestId);
  assert.equal(records[0].level, "error");
  assert.equal(records[0].data.reason, "unexpected_error");
  assert.equal(records[0].data.errorClass, "Error");
  assert.equal(records[0].data.route, "/api/auth/login");
  assert.ok(!JSON.stringify(records).includes(secret));
  assert.ok(!JSON.stringify(body).includes(secret));
});

test("known database error codes survive while arbitrary error metadata is excluded", async () => {
  const { records, write } = capture();
  const handler = withRequestLog({ route: "/api/state", action: "state" }, async () => {
    throw Object.assign(new Error("postgresql://owner:SECRET@db.test/database"), { code: "P2003", meta: { password: "SECRET" } });
  }, write);
  await handler(new Request("https://example.test/api/state"));
  assert.equal(records[0].data.errorCode, "P2003");
  assert.ok(!JSON.stringify(records).includes("SECRET"));
});

test("a later response failure keeps the completed write ID and replaces an earlier error diagnosis", async () => {
  const { records, write } = capture();
  const handler = withRequestLog({ route: "/api/commands", action: "command" }, async (_request, log) => {
    log.error(Object.assign(new Error("Recovered duplicate"), { code: "P2002" }));
    log.result("00000000-0000-4000-8000-000000000003");
    log.writeOutcome("replayed");
    throw new Error("Projection failed with private data");
  }, write);
  const response = await handler(new Request("https://example.test/api/commands", { method: "POST" }));
  assert.equal(response.status, 500);
  assert.equal(records[0].data.resultId, "00000000-0000-4000-8000-000000000003");
  assert.equal(records[0].data.writeOutcome, "replayed");
  assert.equal(records[0].data.errorCode, undefined);
  assert.equal(records[0].data.reason, "unexpected_error");
});

test("user-controlled action names and identifiers cannot inject private data into logs", async () => {
  const { records, write } = capture();
  const handler = withRequestLog({ route: "/api/commands", action: "command" }, async (_request, log) => {
    log.action("SECRET" as never);
    log.actor("SECRET"); log.operation("SECRET"); log.result("SECRET");
    log.reason("SECRET" as never);
    log.error(Object.assign(new Error("SECRET"), { name: "SECRET", code: "SECRET", meta: "SECRET" }));
    return Response.json({ ok: true });
  }, write);
  await handler(new Request("https://example.test/api/commands"));
  assert.equal(records[0].data.action, "command");
  assert.ok(!JSON.stringify(records).includes("SECRET"));
});

test("concurrent requests keep actor and operation context separate", async () => {
  const { records, write } = capture();
  const users = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const handler = withRequestLog({ route: "/api/commands", action: "command" }, async (request, log) => {
    const user = new URL(request.url).searchParams.get("user")!;
    log.actor(user);
    if (user === users[0]) await gate;
    else release();
    return Response.json({ user });
  }, write);
  const responses = await Promise.all(users.map(user => handler(new Request(`https://example.test/api/commands?user=${user}`))));
  for (let i = 0; i < responses.length; i++) {
    const id = responses[i].headers.get("x-request-id");
    assert.equal(records.find(r => r.data.requestId === id)?.data.userId, users[i]);
  }
  assert.notEqual(responses[0].headers.get("x-request-id"), responses[1].headers.get("x-request-id"));
});

test("logging sink failures do not turn a successful action into an API failure", async () => {
  const handler = withRequestLog({ route: "/api/state", action: "state" }, async () => Response.json({ ok: true }), () => { throw new Error("Logging unavailable"); });
  const response = await handler(new Request("https://example.test/api/state"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("Next.js redirects keep their control flow instead of becoming logged server errors", async () => {
  const { records, write } = capture();
  const handler = withRequestLog({ route: "/api/state", action: "state" }, async () => { redirect("/login"); }, write);
  await assert.rejects(handler(new Request("https://example.test/api/state")), (error: unknown) => typeof (error as { digest?: unknown }).digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT"));
  assert.equal(records.length, 0);
});
