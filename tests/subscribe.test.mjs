import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import { onRequestPost } from "../functions/api/subscribe.ts";

afterEach(() => mock.restoreAll());

const request = body => new Request("https://andorlabs.ca/api/subscribe", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const submit = (body, env = { LOOPS_API_KEY: "test-key" }) => onRequestPost({ request: request(body), env });
const address = "reader@example.invalid";

test("rejects malformed and invalid addresses before contacting the provider", async () => {
  const fetch = mock.method(globalThis, "fetch", () => assert.fail("Unexpected provider request"));
  for (const body of ["{", {}, { email: "invalid" }, { email: "a".repeat(255) + "@example.invalid" }]) {
    assert.equal((await submit(body)).status, 400);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test("reports unavailable configuration without logging the submitted address", async () => {
  const log = mock.method(console, "error", () => {});
  const response = await submit({ email: address }, {});
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(log.mock.calls).includes(address), false);
});

test("preserves the record source and only confirms a provider success", async () => {
  mock.method(globalThis, "fetch", async (url, init) => {
    assert.equal(url, "https://app.loops.so/api/v1/contacts/create");
    const payload = JSON.parse(init.body);
    assert.equal(payload.email, address);
    assert.equal(payload.source, "record");
    assert.equal(payload.subscribed, true);
    assert.ok(init.signal instanceof AbortSignal);
    return new Response("{}", { status: 200 });
  });
  const response = await submit({ email: ` ${address.toUpperCase()} `, source: "record" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("treats an existing subscription as success without disclosing membership", async () => {
  mock.method(globalThis, "fetch", async () => new Response("already exists", { status: 409 }));
  const response = await submit({ email: address });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("a provider failure never becomes a successful subscription", async () => {
  mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => new Response("upstream detail", { status: 503 }));
  const response = await submit({ email: address });
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.ok(body.error);
  assert.equal(body.ok, undefined);
  assert.equal(JSON.stringify(body).includes("upstream detail"), false);
});

test("network and timeout failures provide a retryable response", async () => {
  mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  const response = await submit({ email: address });
  assert.equal(response.status, 502);
  assert.ok((await response.json()).error);
});
