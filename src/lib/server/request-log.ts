import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";

const actions = ["login", "logout", "command", "dashboard", "accounting", "browse", "state", "nav",
  "addProduct", "updateProduct", "addSupplier", "updateSupplier", "addClient", "updateClient",
  "addShipment", "updateShipmentDetails", "saveDraft", "deleteDraft", "finalizeSale", "setThresholds"] as const;
type Action = typeof actions[number];
const reasons = ["authentication_required", "validation_failed", "missing_operation_id", "invalid_credentials",
  "login_rate_limited", "stock_conflict", "domain_conflict", "duplicate_record", "related_record_unavailable",
  "transaction_conflict", "unexpected_error"] as const;
type Reason = typeof reasons[number];
type Route = "/api/auth/login" | "/api/auth/logout" | "/api/commands" | "/api/dashboard" | "/api/accounting" | "/api/browse" | "/api/state" | "/api/nav";
type Level = "info" | "warn" | "error";
export type LogWriter = (level: Level, line: string) => void;

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const errorClasses = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "DomainError", "StockError",
  "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientInitializationError", "PrismaClientValidationError", "PrismaClientRustPanicError"]);
const transportCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EPIPE",
  "23502", "23503", "23505", "23514", "40001", "40P01", "53300", "57P01"]);
const knownCode = (value: unknown): value is string => typeof value === "string" && (/^P\d{4}$/.test(value) || transportCodes.has(value));

/** Only these explicitly approved scalar fields can be emitted. Never accept free-form metadata. */
class RequestLog {
  readonly requestId = randomUUID();
  private facts: { action: Action; userId?: string; operationId?: string; resultId?: string; reason?: Reason;
    writeOutcome?: "completed" | "replayed"; errorClass?: string; errorCode?: string };

  constructor(action: Action) { this.facts = { action }; }
  action(value: Action) { if (actions.includes(value)) this.facts.action = value; }
  actor(value: string) { if (uuid.test(value)) this.facts.userId = value; }
  operation(value: string) { if (uuid.test(value)) this.facts.operationId = value; }
  result(value: string | number) { if (typeof value === "string" && uuid.test(value)) this.facts.resultId = value; }
  reason(value: Reason) { if (reasons.includes(value)) this.facts.reason = value; }
  writeOutcome(value: "completed" | "replayed") { if (value === "completed" || value === "replayed") this.facts.writeOutcome = value; }
  error(error: unknown) {
    this.facts.errorClass = "UnknownError";
    delete this.facts.errorCode;
    // Even exception messages/stacks and Prisma metadata may contain credentials or submitted values.
    try {
      if (error instanceof Error) {
        const name = errorClasses.has(error.name) ? error.name : "Error";
        const constructor = error.constructor.name;
        this.facts.errorClass = errorClasses.has(constructor) ? constructor : name;
      }
      const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
      if (knownCode(code)) this.facts.errorCode = code;
    } catch { /* A hostile or broken error object must not break error handling. */ }
  }
  fields() { return { ...this.facts }; }
}

const consoleWriter: LogWriter = (level, line) => { console[level](line); };

/** One completion log per invocation. Context lives in the invocation, never in a shared global. */
export function withRequestLog(options: { route: Route; action: Action }, handler: (request: Request, log: RequestLog) => Promise<Response>, write: LogWriter = consoleWriter) {
  return async function loggedRequest(request: Request): Promise<Response> {
    const started = performance.now();
    const log = new RequestLog(options.action);
    let response: Response;
    try { response = await handler(request, log); }
    catch (error) {
      // Next.js uses exceptions for dynamic rendering/redirects; they must reach the framework.
      unstable_rethrow(error);
      log.reason("unexpected_error"); log.error(error);
      response = Response.json({ error: "Internal server error", requestId: log.requestId }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
    const level: Level = response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
    const headers = new Headers(response.headers);
    headers.set("x-request-id", log.requestId);
    const method = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(request.method) ? request.method : "OTHER";
    const commit = process.env.VERCEL_GIT_COMMIT_SHA;
    const environment = process.env.VERCEL_ENV;
    try {
      write(level, JSON.stringify({ timestamp: new Date().toISOString(), level, event: "api.request",
        requestId: log.requestId, route: options.route, method, status: response.status,
        durationMs: Math.max(0, Math.round(performance.now() - started)), ...log.fields(),
        ...(commit && /^[a-f0-9]{40}$/i.test(commit) ? { commit } : {}),
        ...(environment && ["production", "preview", "development"].includes(environment) ? { environment } : {}),
      }));
    } catch { /* A log transport failure cannot undo a committed shipment or sale. */ }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}
