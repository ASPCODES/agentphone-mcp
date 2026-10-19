import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTPUT_SCHEMAS } from "../dist/output-schemas.js";

// The SDK validates structuredContent against the tool's output schema on every
// successful call. These samples mirror the AgentPhone REST shapes (api.ts) and
// the minimal objects the handlers return on empty / alternate success paths.
// Every sample must parse, or a real call would throw at runtime.

const num = { id: "num_1", phoneNumber: "+14155550123", country: "US", status: "active", agentId: null, createdAt: "2026-01-01T00:00:00Z" };
const agentNum = { id: "num_1", phoneNumber: "+14155550123", status: "active" };
const agent = {
  id: "agt_1", name: "Support", description: null, voiceMode: "hosted", systemPrompt: null,
  beginMessage: null, voice: "Skylar", modelTier: "balanced", transferNumber: null,
  voicemailMessage: null, sttMode: "fast", ambientSound: "none", denoisingMode: "noise-cancellation",
  maxSilenceMs: 600000, enableMessaging: true, enableBackchannel: true, interruptionSensitivity: 0.8,
  voiceSpeed: 1, language: "en-US", createdAt: "2026-01-01T00:00:00Z", numbers: [agentNum],
};
const call = { id: "call_1", fromNumber: "+1415", toNumber: "+1310", direction: "outbound", status: "completed", startedAt: "t", endedAt: null, agentId: null, phoneNumberId: "num_1", retellCallId: null, transcripts: [{ id: "t1", transcript: "hi", response: null, createdAt: "t" }] };
const conv = { id: "conv_1", agentId: null, phoneNumberId: "num_1", phoneNumber: "+1415", participant: "+1310", lastMessageAt: null, lastMessagePreview: "hi", messageCount: 2, metadata: null, createdAt: "t" };
const contact = { id: "ct_1", phoneNumber: "+1310", name: "Jo", email: null, notes: null, createdAt: "t", updatedAt: "t" };
const webhook = { id: "wh_1", url: "https://x", secret: "sk_****1234", status: "active", contextLimit: 10, createdAt: "t" };
const delivery = { id: "d1", event: "message", statusCode: 200, success: true, deliveredAt: "t", responseMs: 42 };
const voice = { voice_id: "v1", voice_name: "Skylar", provider: "p", gender: "f", accent: "us", preview_audio_url: null };
const msg = { id: "m1", from: "+1415", to: "+1310", body: "hi", receivedAt: "t" };

// tool -> list of payloads that MUST all parse
const SAMPLES = {
  account_overview: [
    { usage: { used: 1, limit: 5, remaining: 4 }, agents: [agent], numbers: [num], webhook: { url: "https://x", status: "active" }, recentActivity: { messagesLast30d: 3, callsLast30d: 1 } },
    { usage: undefined, agents: null, numbers: null, webhook: null },
  ],
  list_numbers: [{ data: [num], hasMore: false, total: 1 }, { data: [], total: 0 }],
  buy_number: [num, { confirmationRequired: true }],
  send_message: [
    { id: "m1", status: "sent", channel: "sms", from_number: "+1415", to_number: "+1310", media_urls: [], reply_to_message_id: null, reply_parent_unresolved: null },
    { id: "r1", reaction_type: "love", message_id: "m1", channel: "imessage" },
  ],
  get_messages: [{ data: [msg], hasMore: false }, { data: [], hasMore: false }],
  list_calls: [{ data: [call], hasMore: false, total: 1 }, { data: [], total: 0 }],
  get_call: [call],
  make_call: [{ id: "call_1", fromNumber: "+1415", toNumber: "+1310", direction: "outbound", status: "ringing", startedAt: "t", retellCallId: null }],
  make_conversation_call: [call, { id: "c", fromNumber: "+1415", toNumber: "+1310", direction: "outbound", status: "in-progress", startedAt: "t", endedAt: null, retellCallId: null }],
  list_agents: [{ data: [agent], total: 1 }, { data: [], total: 0 }],
  create_agent: [agent],
  update_agent: [agent],
  delete_agent: [{ success: true, id: "agt_1", name: "Support" }],
  get_agent: [agent],
  attach_number: [{ agentId: "agt_1", number: agentNum }],
  detach_number: [{ success: true }],
  list_voices: [{ data: [voice] }, { data: [] }],
  list_conversations: [{ data: [conv], hasMore: false, total: 1 }, { data: [], total: 0 }],
  get_conversation: [{ ...conv, messages: [msg] }],
  update_conversation: [conv],
  list_contacts: [{ data: [contact], hasMore: false, total: 1 }, { data: [], total: 0 }],
  manage_contact: [contact, { success: true }],
  get_usage: [
    { numbers: { used: 1, limit: 5, remaining: 4 }, stats: { totalMessages: 10 }, periodStart: "t", periodEnd: "t" },
    { data: [{ date: "2026-01-01", messages: 1, calls: 2, webhooks: 3 }], days: 30 },
    { data: [{ month: "2026-01", messages: 1, calls: 2, webhooks: 3 }], months: 12 },
  ],
  get_webhook: [webhook, { configured: false }],
  set_webhook: [webhook],
  delete_webhook: [{ success: true }],
  test_webhook: [{ success: true, statusCode: 200, responseMs: 42, error: null }, { success: false, statusCode: null, responseMs: null, error: "timeout" }],
  list_webhook_deliveries: [{ data: [delivery], hasMore: false, total: 1 }, { data: [], total: 0 }],
};

test("every tool has an output schema", () => {
  const tools = Object.keys(SAMPLES);
  assert.equal(tools.length, 28);
  for (const t of tools) assert.ok(OUTPUT_SCHEMAS[t], `missing output schema for ${t}`);
  assert.equal(Object.keys(OUTPUT_SCHEMAS).length, 28);
});

test("real-shaped and empty-path payloads validate against each schema", () => {
  for (const [tool, samples] of Object.entries(SAMPLES)) {
    const schema = OUTPUT_SCHEMAS[tool];
    for (const sample of samples) {
      const r = schema.safeParse(sample);
      assert.ok(r.success, `${tool}: sample failed validation: ${r.success ? "" : JSON.stringify(r.error.issues)}`);
    }
    // The adapter's safety-net value ({}) must also validate.
    assert.ok(schema.safeParse({}).success, `${tool}: empty {} fallback failed`);
  }
});
