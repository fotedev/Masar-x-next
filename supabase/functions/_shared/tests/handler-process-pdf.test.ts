/**
 * Handler-level tests for ../../process-pdf/index.ts (P0 hotfix review packet).
 * Run: deno test --allow-env --import-map=supabase/functions/_shared/tests/import-map.json
 *        supabase/functions/_shared/tests/handler-process-pdf.test.ts
 * The real handler runs with stubbed supabase/Gemini imports, stubbed DNS and
 * stubbed fetch. No network.
 */
import { handleProcessPdf } from "../../process-pdf/index.ts";

const USER = "aaaaaaaa-1111-2222-3333-444444444444";
const LEGIT_URL = "https://res.cloudinary.com/demo/image/upload/v1/docs/a.pdf";

interface FetchCall {
  url: string;
}
let fetchCalls: FetchCall[] = [];
let fetchScript: Array<"pdf" | "redirect-internal" | "html" | "oversize"> = [];

function setScenario(opts: {
  authed: boolean;
  rpcAllowed?: boolean;
  dnsA?: string[];
  dnsAAAA?: string[];
  dnsThrow?: boolean;
}): void {
  (globalThis as unknown as Record<string, unknown>).__SCENARIO__ = {
    users: opts.authed ? { "good-token": { id: USER } } : { "good-token": null },
    profileRow: null,
    rpcAllowed: opts.rpcAllowed !== false,
    calls: { updates: [], destroys: [] },
  };
  const dns = Deno.resolveDns;
  void dns;
  (Deno as unknown as Record<string, unknown>).resolveDns = (
    _host: string,
    kind: string,
  ) => {
    if (opts.dnsThrow) return Promise.reject(new Error("dns down"));
    return Promise.resolve(kind === "A" ? (opts.dnsA ?? ["93.184.216.34"]) : (opts.dnsAAAA ?? []));
  };
  fetchCalls = [];
  (globalThis as unknown as Record<string, unknown>).fetch = (url: string) => {
    fetchCalls.push({ url });
    const mode = fetchScript.shift() ?? "pdf";
    if (mode === "redirect-internal") {
      return Promise.resolve(new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/x" },
      }));
    }
    if (mode === "html") {
      return Promise.resolve(
        new Response("<html></html>", { headers: { "content-type": "text/html" } }),
      );
    }
    if (mode === "oversize") {
      return Promise.resolve(new Response("x", {
        headers: {
          "content-type": "application/pdf",
          "content-length": String(16 * 1024 * 1024),
        },
      }));
    }
    return Promise.resolve(new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
      headers: { "content-type": "application/pdf" },
    }));
  };
}

function req(auth: string | null, pdfUrl: unknown): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (auth !== null) headers.set("authorization", auth);
  return new Request("https://functions.local/process-pdf", {
    method: "POST",
    headers,
    body: JSON.stringify({ pdfUrl }),
  });
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

Deno.test("handler: unauthenticated -> 401, no fetch, no AI call", async () => {
  setScenario({ authed: false });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req(null, LEGIT_URL));
  assert(res.status === 401, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});

Deno.test("handler: garbage token (no user) -> 401", async () => {
  setScenario({ authed: false });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer nope", LEGIT_URL));
  assert(res.status === 401, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});

Deno.test("handler: legit request works end-to-end (auth, DNS, fetch, AI)", async () => {
  setScenario({ authed: true });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 200, `status ${res.status}`);
  const body = await res.json();
  assert(body.success === true && body.text === "canned-ocr-text", "canned ocr passthrough");
  assert(fetchCalls.length === 1 && fetchCalls[0].url === LEGIT_URL, "single fetch of exact URL");
});

Deno.test("handler: SSRF literal (metadata IP, http) -> 403 before any fetch", async () => {
  setScenario({ authed: true });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer good-token", "http://169.254.169.254/x"));
  assert(res.status === 403, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});

Deno.test("handler: redirect to internal address -> 403, second hop never fetched", async () => {
  setScenario({ authed: true });
  fetchScript = ["redirect-internal"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 403, `status ${res.status}`);
  assert(fetchCalls.length === 1, `one fetch only, got ${fetchCalls.length}`);
});

Deno.test("handler: hostname resolving to private IP -> 403, no fetch", async () => {
  setScenario({ authed: true, dnsA: ["10.1.2.3"] });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 403, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});

Deno.test("handler: DNS failure -> 403 fail-closed", async () => {
  setScenario({ authed: true, dnsThrow: true });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 403, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});

Deno.test("handler: non-PDF content-type -> 400", async () => {
  setScenario({ authed: true });
  fetchScript = ["html"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 400, `status ${res.status}`);
});

Deno.test("handler: oversize declared length -> 400 without buffering", async () => {
  setScenario({ authed: true });
  fetchScript = ["oversize"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 400, `status ${res.status}`);
});

Deno.test("handler: rate-limited user -> 429", async () => {
  setScenario({ authed: true, rpcAllowed: false });
  fetchScript = ["pdf"];
  const res = await handleProcessPdf(req("Bearer good-token", LEGIT_URL));
  assert(res.status === 429, `status ${res.status}`);
  assert(fetchCalls.length === 0, "no fetch");
});
