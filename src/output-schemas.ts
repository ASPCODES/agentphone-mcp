/**
 * Output schemas for the MCP tools.
 *
 * Each tool returns a human-readable text block AND a `structuredContent`
 * object so clients can interpret the result's fields directly. These schemas
 * describe that structured object and are advertised on tools/list.
 *
 * Shapes mirror the AgentPhone REST responses in api.ts. Every field is
 * optional and each object is `.passthrough()`, for two reasons:
 *   1. The structured payload is a faithful superset of the real result, so
 *      backend additions never break validation.
 *   2. Some tools have more than one success shape (e.g. buy_number's
 *      confirmation prompt vs. the purchased number, or get_usage's summary vs.
 *      time-series), and a permissive schema covers each without inventing a
 *      shape the server does not actually return.
 *
 * The MCP SDK validates `structuredContent` against the matching schema on
 * every successful call (error results are exempt), so these must stay aligned
 * with what the handlers return.
 */

import { z } from "zod";

// --- Reusable field groups (all optional; names/types mirror api.ts) ---

const numberFields = {
  id: z.string().optional(),
  phoneNumber: z.string().optional(),
  country: z.string().optional(),
  status: z.string().optional(),
  agentId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
};

const agentNumber = z
  .object({
    id: z.string().optional(),
    phoneNumber: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const agentFields = {
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  voiceMode: z.string().optional(),
  systemPrompt: z.string().nullable().optional(),
  beginMessage: z.string().nullable().optional(),
  voice: z.string().optional(),
  modelTier: z.string().optional(),
  transferNumber: z.string().nullable().optional(),
  voicemailMessage: z.string().nullable().optional(),
  sttMode: z.string().optional(),
  ambientSound: z.string().optional(),
  denoisingMode: z.string().optional(),
  maxSilenceMs: z.number().optional(),
  enableMessaging: z.boolean().optional(),
  enableBackchannel: z.boolean().optional(),
  interruptionSensitivity: z.number().optional(),
  voiceSpeed: z.number().optional(),
  language: z.string().optional(),
  createdAt: z.string().optional(),
  numbers: z.array(agentNumber).optional(),
};
const agentObject = z.object(agentFields).passthrough();

const callFields = {
  id: z.string().optional(),
  fromNumber: z.string().optional(),
  toNumber: z.string().optional(),
  direction: z.string().optional(),
  status: z.string().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().nullable().optional(),
  agentId: z.string().nullable().optional(),
  phoneNumberId: z.string().optional(),
  retellCallId: z.string().nullable().optional(),
};
const transcriptEntry = z
  .object({
    id: z.string().optional(),
    transcript: z.string().optional(),
    response: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
const callObject = z
  .object({ ...callFields, transcripts: z.array(transcriptEntry).optional() })
  .passthrough();

const conversationFields = {
  id: z.string().optional(),
  agentId: z.string().nullable().optional(),
  phoneNumberId: z.string().optional(),
  phoneNumber: z.string().optional(),
  participant: z.string().optional(),
  lastMessageAt: z.string().nullable().optional(),
  lastMessagePreview: z.string().optional(),
  messageCount: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().optional(),
};

const contactFields = {
  id: z.string().optional(),
  phoneNumber: z.string().optional(),
  name: z.string().optional(),
  email: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
};

const webhookFields = {
  id: z.string().optional(),
  url: z.string().optional(),
  // Masked unless reveal_secret=true; never the raw secret by default.
  secret: z.string().optional(),
  status: z.string().optional(),
  contextLimit: z.number().optional(),
  createdAt: z.string().optional(),
};

const deliveryEntry = z
  .object({
    id: z.string().optional(),
    event: z.string().optional(),
    statusCode: z.number().nullable().optional(),
    success: z.boolean().optional(),
    deliveredAt: z.string().optional(),
    responseMs: z.number().nullable().optional(),
  })
  .passthrough();

const voiceEntry = z
  .object({
    voice_id: z.string().optional(),
    voice_name: z.string().optional(),
    provider: z.string().optional(),
    gender: z.string().optional(),
    accent: z.string().optional(),
    preview_audio_url: z.string().nullable().optional(),
  })
  .passthrough();

const messageEntry = z
  .object({
    id: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    fromNumber: z.string().optional(),
    toNumber: z.string().optional(),
    body: z.string().optional(),
    direction: z.string().optional(),
    receivedAt: z.string().optional(),
  })
  .passthrough();

const usageNumbers = z
  .object({
    used: z.number().optional(),
    limit: z.number().optional(),
    remaining: z.number().optional(),
  })
  .passthrough();

const listMeta = { hasMore: z.boolean().optional(), total: z.number().optional() };

// --- Per-tool output schemas ---

export const OUTPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  account_overview: z
    .object({
      usage: usageNumbers.nullable().optional(),
      agents: z.array(agentObject).nullable().optional(),
      numbers: z.array(z.object(numberFields).passthrough()).nullable().optional(),
      webhook: z
        .object({ url: z.string().optional(), status: z.string().optional() })
        .passthrough()
        .nullable()
        .optional(),
      recentActivity: z
        .object({
          messagesLast30d: z.number().optional(),
          callsLast30d: z.number().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),

  list_numbers: z
    .object({ data: z.array(z.object(numberFields).passthrough()).optional(), ...listMeta })
    .passthrough(),

  buy_number: z
    .object({ ...numberFields, confirmationRequired: z.boolean().optional() })
    .passthrough(),

  send_message: z
    .object({
      // message-send shape
      id: z.string().optional(),
      status: z.string().optional(),
      channel: z.string().nullable().optional(),
      from_number: z.string().optional(),
      to_number: z.string().optional(),
      media_urls: z.array(z.string()).optional(),
      reply_to_message_id: z.string().nullable().optional(),
      reply_parent_unresolved: z.boolean().nullable().optional(),
      // reaction shape
      reaction_type: z.string().optional(),
      message_id: z.string().optional(),
    })
    .passthrough(),

  get_messages: z
    .object({ data: z.array(messageEntry).optional(), ...listMeta })
    .passthrough(),

  list_calls: z
    .object({ data: z.array(callObject).optional(), ...listMeta })
    .passthrough(),

  get_call: callObject,

  make_call: callObject,

  make_conversation_call: callObject,

  list_agents: z
    .object({ data: z.array(agentObject).optional(), ...listMeta })
    .passthrough(),

  create_agent: agentObject,

  update_agent: agentObject,

  delete_agent: z
    .object({ success: z.boolean().optional(), id: z.string().optional(), name: z.string().optional() })
    .passthrough(),

  get_agent: agentObject,

  attach_number: z
    .object({ agentId: z.string().optional(), number: agentNumber.optional() })
    .passthrough(),

  detach_number: z.object({ success: z.boolean().optional() }).passthrough(),

  list_voices: z.object({ data: z.array(voiceEntry).optional() }).passthrough(),

  list_conversations: z
    .object({ data: z.array(z.object(conversationFields).passthrough()).optional(), ...listMeta })
    .passthrough(),

  get_conversation: z
    .object({ ...conversationFields, messages: z.array(messageEntry).optional() })
    .passthrough(),

  update_conversation: z.object(conversationFields).passthrough(),

  list_contacts: z
    .object({ data: z.array(z.object(contactFields).passthrough()).optional(), ...listMeta })
    .passthrough(),

  manage_contact: z
    .object({ ...contactFields, success: z.boolean().optional() })
    .passthrough(),

  get_usage: z
    .object({
      // summary shape
      numbers: usageNumbers.optional(),
      stats: z.record(z.string(), z.number()).optional(),
      periodStart: z.string().optional(),
      periodEnd: z.string().optional(),
      // time-series shape
      breakdown: z.string().optional(),
      data: z
        .array(
          z
            .object({
              date: z.string().optional(),
              month: z.string().optional(),
              messages: z.number().optional(),
              calls: z.number().optional(),
              webhooks: z.number().optional(),
            })
            .passthrough()
        )
        .optional(),
      days: z.number().optional(),
      months: z.number().optional(),
    })
    .passthrough(),

  get_webhook: z
    .object({ ...webhookFields, configured: z.boolean().optional() })
    .passthrough(),

  set_webhook: z.object(webhookFields).passthrough(),

  delete_webhook: z.object({ success: z.boolean().optional() }).passthrough(),

  test_webhook: z
    .object({
      success: z.boolean().optional(),
      statusCode: z.number().nullable().optional(),
      responseMs: z.number().nullable().optional(),
      error: z.string().nullable().optional(),
    })
    .passthrough(),

  list_webhook_deliveries: z
    .object({ data: z.array(deliveryEntry).optional(), ...listMeta })
    .passthrough(),
};
