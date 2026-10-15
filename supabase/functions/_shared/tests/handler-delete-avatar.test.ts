/**
 * Handler-level tests for ../../delete-avatar/index.ts (P0 hotfix review packet).
 * Run: deno test --allow-env --import-map=supabase/functions/_shared/tests/import-map.json
 *        supabase/functions/_shared/tests/handler-delete-avatar.test.ts
 * The real handler runs with a stubbed supabase client (scenario-driven) and a
 * stubbed global fetch (Cloudinary). No network.
 */
import { handleDeleteAvatar } from "../../delete-avatar/handler.ts";

// Dummy (obviously fake, low-entropy) Cloudinary credentials so the handler
// passes its config gate in tests. Deno.env.set needs --allow-env (see header).
Deno.env.set("CLOUDINARY_CLOUD_NAME", "test-fake-cloud");
Deno.env.set("CLOUDINARY_API_KEY", "test-fake-key");
Deno.env.set("CLOUDINARY_API_SECRET", "test-fake-value-not-real");

const USER_A = "aaaaaaaa-1111-2222-3333-444444444444";
const USER_B = "bbbbbbbb-1111-2222-3333-444444444444";
const AVATAR_A = `https://res.cloudinary.com/demo/image/upload/v1712345678/avatars/${USER_A}_1712345678.jpg`;
const AVATAR_B_ID = `avatars/${USER_B}_1712345678`;

interface Scenario {
  users: Record<string, { id: string } | null>;
  profileRow: { avatar_url: string | null } | null;
  profileError?: boolean;
  rpcAllowed?: boolean;
  calls: { updates: Array<unknown>; destroys: string[] };
}

function setScenario(s: Scenario): void {
  (globalThis as unknown as Record<string, unknown>).__SCENARIO__ = s;
}

function baseScenario(): Scenario {
  return {
    users: { "good-token-A": { id: USER_A }, "garbage": null },
    profileRow: { avatar_url: AVATAR_A },
    calls: { updates: [], destroys: [] },
  };
}

function stubFetch(scenario: Scenario): void {
  (globalThis as unknown as Record<string, unknown>).fetch = (
    _url: string,
    init?: { body?: FormData },
  ) => {
    const body = init?.body as unknown as FormData | undefined;
    const publicId = typeof body?.get === "function" ? String(body.get("public_id") ?? "") : "";
    scenario.calls.destroys.push(publicId);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as unknown as Response);
  };
}

function req(auth: string | null, body: unknown): Request {
  const headers = new Headers();
  if (auth !== null) headers.set("authorization", auth);
  return new Request("https://functions.local/delete-avatar", {
    method: "POST",
    headers,
    body: body === undefined ? null : JSON.stringify(body),
  });
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

Deno.test("handler: unauthenticated request -> 401, Cloudinary untouched", async () => {
  const s = baseScenario();
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req(null, { publicId: AVATAR_B_ID }));
  assert(res.status === 401, `status ${res.status}`);
  assert(s.calls.destroys.length === 0, "no destroy call");
});

Deno.test("handler: garbage token (anon-key-style, no user) -> 401", async () => {
  const s = baseScenario();
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req("Bearer garbage", { publicId: AVATAR_B_ID }));
  assert(res.status === 401, `status ${res.status}`);
  assert(s.calls.destroys.length === 0, "no destroy call");
});

Deno.test("handler: user A sending user B public_id deletes ONLY A's own avatar", async () => {
  const s = baseScenario();
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req("Bearer good-token-A", { publicId: AVATAR_B_ID }));
  assert(res.status === 200, `status ${res.status}`);
  assert(s.calls.destroys.length === 1, "exactly one destroy");
  assert(
    s.calls.destroys[0] === `avatars/${USER_A}_1712345678`,
    `destroyed ${s.calls.destroys[0]}`,
  );
  assert(!s.calls.destroys[0].includes(USER_B), "B's id never sent to Cloudinary");
});

Deno.test("handler: no avatar on record -> 404, Cloudinary untouched", async () => {
  const s = baseScenario();
  s.profileRow = { avatar_url: null };
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req("Bearer good-token-A", {}));
  assert(res.status === 404, `status ${res.status}`);
  assert(s.calls.destroys.length === 0, "no destroy call");
});

Deno.test("handler: tampered record (A profile points at B avatar) -> 403", async () => {
  const s = baseScenario();
  s.profileRow = {
    avatar_url: `https://res.cloudinary.com/demo/image/upload/v1/avatars/${USER_B}_1712345678.jpg`,
  };
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req("Bearer good-token-A", {}));
  assert(res.status === 403, `status ${res.status}`);
  assert(s.calls.destroys.length === 0, "no destroy call");
});
Deno.test("handler: legacy avatar outside namespace -> 403, Cloudinary untouched", async () => {
  const s = baseScenario();
  s.profileRow = { avatar_url: "https://res.cloudinary.com/demo/image/upload/other/x.jpg" };
  setScenario(s);
  stubFetch(s);
  const res = await handleDeleteAvatar(req("Bearer good-token-A", {}));
  assert(res.status === 403, `status ${res.status}`);
  assert(s.calls.destroys.length === 0, "no destroy call");
});
