import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { registerTools } from "../dist/tools.js";
import { OUTPUT_SCHEMAS } from "../dist/output-schemas.js";

// Every tool declares an outputSchema, so the SDK validates each successful
// result's structuredContent against it on every call. This drives the REAL
// handlers (registered by registerTools) against a stub API and asserts their
// structuredContent parses — the same check the SDK performs at runtime — so a
// handler and its schema cannot drift out of sense without a test failure.

// --- Stub API: realistic responses mirroring api.ts, no network ---
const num = { id: "num_1", phoneNumber: "+14155550123", country: "US", status: "active", agentId: null, createdAt: "t" };
const agentNum = { id: "num_1", phoneNumber: "+14155550123", status: "active" };
const agent = {
  id: "agt_1", name: "Support", description: null, voiceMode: "hosted", systemPrompt: null,
  beginMessage: null, voice: "Skylar", modelTier: "balanced", transferNumber: null, voicemailMessage: null,
  sttMode: "fast", ambientSound: "none", denoisingMode: "noise-cancellation", maxSilenceMs: 600000,
  enableMessaging: true, enableBackchannel: true, interruptionSensitivity: 0.8, voiceSpeed: 1,
  language: "en-US", createdAt: "t", numbers: [agentNum],
};
const call = { id: "call_1", fromNumber: "+1415", toNumber: "+1310", direction: "outbound", status: "completed", startedAt: "t", endedAt: null, agentId: null, phoneNumberId: "num_1", retellCallId: null, transcripts: [{ id: "t1", transcript: "hi", response: null, createdAt: "t" }] };
const conv = { id: "conv_1", agentId: null, phoneNumberId: "num_1", phoneNumber: "+1415", participant: "+1310", lastMessageAt: null, lastMessagePreview: "hi", messageCount: 2, metadata: null, createdAt: "t" };
const convFull = { ...conv, messages: [{ id: "m1", body: "hi", fromNumber: "+1310", toNumber: "+1415", direction: "inbound", receivedAt: "t" }] };
const contact = { id: "ct_1", phoneNumber: "+1310", name: "Jo", email: null, notes: null, createdAt: "t", updatedAt: "t" };
const webhook = { id: "wh_1", url: "https://x", secret: "whsec_realish", status: "active", contextLimit: 10, createdAt: "t" };
const delivery = { id: "d1", event: "message", statusCode: 200, success: true, deliveredAt: "t", responseMs: 42 };
const voice = { voice_id: "v1", voice_name: "Skylar", provider: "p", gender: "f", accent: "us", preview_audio_url: null };
const msg = { id: "m1", from: "+1415", to: "+1310", body: "hi", receivedAt: "t" };
const usage = { numbers: { used: 1, limit: 5, remaining: 4 }, stats: { totalMessages: 1, messagesLast24h: 0, messagesLast7d: 0, messagesLast30d: 0, smsSegmentsLast30d: 0, totalCalls: 0, callsLast24h: 0, callsLast7d: 0, callsLast30d: 0, totalWebhookDeliveries: 0, successfulWebhookDeliveries: 0, failedWebhookDeliveries: 0 }, periodStart: "t", periodEnd: "t" };

function makeStub(overrides = {}) {
  return {
    listNumbers: async () => ({ data: [num], hasMore: false, total: 1 }),
    buyNumber: async () => num,
    getMessages: async () => ({ data: [msg], hasMore: false }),
    sendMessage: async () => ({ id: "m1", status: "sent", channel: "sms", from_number: "+1415", to_number: "+1310", media_urls: [], reply_to_message_id: null, reply_parent_unresolved: null }),
    sendReaction: async () => ({ id: "r1", reaction_type: "love", message_id: "m1", channel: "imessage" }),
    listVoices: async () => ({ data: [voice] }),
    listAgents: async () => ({ data: [agent], total: 1 }),
    createAgent: async () => agent,
    updateAgent: async () => agent,
    deleteAgent: async () => ({ success: true, id: "agt_1", name: "Support" }),
    getAgent: async () => agent,
    attachNumber: async () => ({ agentId: "agt_1", number: agentNum }),
    detachNumber: async () => ({ success: true }),
    listConversations: async () => ({ data: [conv], hasMore: false, total: 1 }),
    getConversation: async () => convFull,
    updateConversation: async () => conv,
    listCalls: async () => ({ data: [call], hasMore: false, total: 1 }),
    getCall: async () => call,
    makeCall: async () => ({ id: "call_1", fromNumber: "+1415", toNumber: "+1310", direction: "outbound", status: "ringing", startedAt: "t", retellCallId: null }),
    makeConversationCall: async () => call,
    listContacts: async () => ({ data: [contact], hasMore: false, total: 1 }),
    createContact: async () => contact,
    updateContact: async () => contact,
    deleteContact: async () => ({ success: true }),
    getWebhook: async () => webhook,
    setWebhook: async () => webhook,
    deleteWebhook: async () => ({ success: true }),
    testWebhook: async () => ({ success: true, statusCode: 200, responseMs: 42, error: null }),
    listWebhookDeliveries: async () => ({ data: [delivery], hasMore: false, total: 1 }),
    getUsage: async () => usage,
    getDailyUsage: async () => ({ data: [{ date: "2026-01-01", messages: 1, calls: 2, webhooks: 3 }], days: 30 }),
    getMonthlyUsage: async () => ({ data: [{ month: "2026-01", messages: 1, calls: 2, webhooks: 3 }], months: 12 }),
    ...overrides,
  };
}

// Recording registrar — names + handlers come from registerTools(), not a list.
function harness(apiStub) {
  const tools = new Map();
  const registrar = {
    tool(name, description, schema, annotationsOrHandler, maybeHandler) {
      const handler = typeof annotationsOrHandler === "function" ? annotationsOrHandler : maybeHandler;
      tools.set(name, { schema, handler });
    },
  };
  registerTools(registrar, apiStub);
  return {
    names: () => [...tools.keys()],
    call: async (name, args) => {
      const t = tools.get(name);
      return t.handler(await z.object(t.schema).parseAsync(args ?? {}));
    },
  };
}

// Valid arguments that take each tool down its API-calling success path.
const ARGS = {
  account_overview: {},
  list_numbers: {},
  buy_number: { confirm: true },
  send_message: { agent_id: "agt_1", to_number: "+14155550123", body: "hi" },
  get_messages: { number_id: "num_1" },
  list_calls: {},
  get_call: { call_id: "call_1" },
  make_call: { agent_id: "agt_1", to_number: "+14155550123" },
  make_conversation_call: { agent_id: "agt_1", to_number: "+14155550123", topic: "x", wait: false },
  list_agents: {},
  create_agent: { name: "X" },
  update_agent: { agent_id: "agt_1" },
  delete_agent: { agent_id: "agt_1" },
  get_agent: { agent_id: "agt_1" },
  attach_number: { agent_id: "agt_1", number_id: "num_1" },
  detach_number: { agent_id: "agt_1", number_id: "num_1" },
  list_voices: {},
  list_conversations: {},
  get_conversation: { conversation_id: "conv_1" },
  update_conversation: { conversation_id: "conv_1", metadata: { a: 1 } },
  list_contacts: {},
  manage_contact: { action: "create", phone_number: "+14155550123", name: "Jo" },
  get_usage: {},
  get_webhook: {},
  set_webhook: { url: "https://example.com/hook" },
  delete_webhook: {},
  test_webhook: {},
  list_webhook_deliveries: {},
};

test("registered tools and OUTPUT_SCHEMAS are the same set (no drift)", () => {
  const registered = new Set(harness(makeStub()).names());
  assert.equal(registered.size, 28);
  for (const name of registered) assert.ok(OUTPUT_SCHEMAS[name], `tool ${name} has no output schema`);
  for (const name of Object.keys(OUTPUT_SCHEMAS)) assert.ok(registered.has(name), `output schema ${name} has no tool`);
});

test("each handler's structuredContent validates against its output schema", async () => {
  const h = harness(makeStub());
  for (const [name, args] of Object.entries(ARGS)) {
    const r = await h.call(name, args);
    assert.equal(r.isError, undefined, `${name}: unexpected error: ${r.isError ? r.content[0].text : ""}`);
    assert.ok(r.structuredContent, `${name}: missing structuredContent`);
    const parsed = OUTPUT_SCHEMAS[name].safeParse(r.structuredContent);
    assert.ok(parsed.success, `${name}: structuredContent failed schema: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`);
  }
});

test("send_message reaction mode also validates", async () => {
  const h = harness(makeStub());
  const r = await h.call("send_message", { react_to_message_id: "m1", reaction: "love" });
  assert.equal(r.isError, undefined);
  assert.ok(OUTPUT_SCHEMAS.send_message.safeParse(r.structuredContent).success);
});

test("buy_number confirmation prompt validates", async () => {
  const h = harness(makeStub());
  const r = await h.call("buy_number", { confirm: false });
  assert.ok(OUTPUT_SCHEMAS.buy_number.safeParse(r.structuredContent).success);
  assert.equal(r.structuredContent.confirmationRequired, true);
});

test("get_usage daily and monthly branches validate", async () => {
  const h = harness(makeStub());
  for (const breakdown of ["daily", "monthly"]) {
    const r = await h.call("get_usage", { breakdown });
    assert.ok(OUTPUT_SCHEMAS.get_usage.safeParse(r.structuredContent).success, `get_usage ${breakdown}`);
  }
});

test("empty paged lists keep the real total, not a fabricated zero", async () => {
  // Out-of-range offset: no rows on this page, but total is still positive.
  const empty = {
    listCalls: async () => ({ data: [], hasMore: false, total: 7 }),
    listConversations: async () => ({ data: [], hasMore: false, total: 7 }),
    listContacts: async () => ({ data: [], hasMore: false, total: 7 }),
  };
  const h = harness(makeStub(empty));
  for (const name of ["list_calls", "list_conversations", "list_contacts"]) {
    const r = await h.call(name, { offset: 999 });
    assert.ok(OUTPUT_SCHEMAS[name].safeParse(r.structuredContent).success, name);
    assert.equal(r.structuredContent.total, 7, `${name}: should report real total, not 0`);
  }
});

test("account_overview reports failed webhook lookup as omitted, not null", async () => {
  const h = harness(makeStub({ getWebhook: async () => { throw new Error("boom"); } }));
  const r = await h.call("account_overview", {});
  assert.ok(OUTPUT_SCHEMAS.account_overview.safeParse(r.structuredContent).success);
  // A rejected lookup must not look like "no webhook configured" (null).
  assert.equal("webhook" in r.structuredContent && r.structuredContent.webhook === null, false);
});

test("webhook tools mask the signing secret in structuredContent by default", async () => {
  const h = harness(makeStub());
  for (const [name, args] of [["get_webhook", {}], ["set_webhook", { url: "https://example.com/hook" }]]) {
    const r = await h.call(name, args);
    assert.ok(OUTPUT_SCHEMAS[name].safeParse(r.structuredContent).success, name);
    assert.doesNotMatch(r.structuredContent.secret, /realish/, `${name} leaked the secret in structuredContent`);
    assert.match(r.structuredContent.secret, /masked/, `${name} should mask the secret`);
  }
});

test("webhook structuredContent includes the real secret only with reveal_secret=true", async () => {
  const h = harness(makeStub());
  const r = await h.call("get_webhook", { reveal_secret: true });
  assert.equal(r.structuredContent.secret, "whsec_realish");
});

test("manage_contact update and delete validate (delete passes the real success value)", async () => {
  const h = harness(makeStub());
  const upd = await h.call("manage_contact", { action: "update", contact_id: "ct_1", name: "Jo2" });
  assert.equal(upd.isError, undefined);
  assert.ok(OUTPUT_SCHEMAS.manage_contact.safeParse(upd.structuredContent).success);
  const del = await h.call("manage_contact", { action: "delete", contact_id: "ct_1" });
  assert.equal(del.isError, undefined);
  assert.ok(OUTPUT_SCHEMAS.manage_contact.safeParse(del.structuredContent).success);
  assert.equal(del.structuredContent.success, true);
});

// There is no structured-content fallback: every success path must return its
// own structuredContent, and it must satisfy the (now stricter) output schema.
// Cover the branches the main pass doesn't, so a missing field can't slip
// through to a runtime throw.
test("alternate success branches still return schema-valid structured content", async () => {
  // get_webhook when none is configured
  let h = harness(makeStub({ getWebhook: async () => null }));
  let r = await h.call("get_webhook", {});
  assert.equal(r.isError, undefined);
  assert.ok(OUTPUT_SCHEMAS.get_webhook.safeParse(r.structuredContent).success, "get_webhook/none");

  // make_conversation_call that completed with a transcript (wait=true)
  h = harness(makeStub());
  r = await h.call("make_conversation_call", { agent_id: "agt_1", to_number: "+14155550123", topic: "x", wait: true });
  assert.equal(r.isError, undefined);
  assert.ok(OUTPUT_SCHEMAS.make_conversation_call.safeParse(r.structuredContent).success, "mcc/transcript");

  // empty list variants that don't carry a `total`
  const emptyStub = {
    getMessages: async () => ({ data: [], hasMore: false }),
    listVoices: async () => ({ data: [] }),
    listWebhookDeliveries: async () => ({ data: [], hasMore: false, total: 0 }),
  };
  h = harness(makeStub(emptyStub));
  for (const [name, args] of [["get_messages", { number_id: "num_1" }], ["list_voices", {}], ["list_webhook_deliveries", {}]]) {
    r = await h.call(name, args);
    assert.equal(r.isError, undefined, name);
    assert.ok(r.structuredContent, `${name}: missing structuredContent`);
    assert.ok(OUTPUT_SCHEMAS[name].safeParse(r.structuredContent).success, `${name}: empty branch`);
  }
});

// Guaranteed fields are now required in the schema; confirm the schema rejects
// their absence (so the "required" promise is real, not cosmetic).
test("required output fields are enforced", () => {
  assert.equal(OUTPUT_SCHEMAS.delete_agent.safeParse({}).success, false);
  assert.equal(OUTPUT_SCHEMAS.list_numbers.safeParse({}).success, false);
  assert.equal(OUTPUT_SCHEMAS.detach_number.safeParse({}).success, false);
});
