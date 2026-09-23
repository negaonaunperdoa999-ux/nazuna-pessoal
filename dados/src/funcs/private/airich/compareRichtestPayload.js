import { buildRichTestHtml, buildAIRichMessageContent as buildLegacyAIRichMessageContent } from '../pokemonRichHtml.js';
import { DEFAULT_BOT_JID, HTML_PRIMITIVE, buildAIRichMessageContent, sendAIRichHtml } from './sendAIRichHtml.js';

function parseUnified(richContent) {
  const richResponse = richContent.botForwardedMessage.message.richResponseMessage;
  return JSON.parse(Buffer.from(richResponse.unifiedResponse.data).toString('utf8'));
}

function shapeOf(value) {
  if (Buffer.isBuffer(value)) return 'Buffer';
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, shapeOf(value[key])]));
  }
  return typeof value;
}

function normalizeUnified(unified) {
  return { ...unified, response_id: '<id>' };
}

const html = buildRichTestHtml();
const legacyContent = buildLegacyAIRichMessageContent(html, { label: 'Rich HTML Test' });
const helperContent = buildAIRichMessageContent(html, { label: 'Rich HTML Test' });

const legacyUnified = parseUnified(legacyContent);
const helperUnified = parseUnified(helperContent);
const legacyShape = JSON.stringify(shapeOf(legacyContent));
const helperShape = JSON.stringify(shapeOf(helperContent));
const legacyNormalized = JSON.stringify(normalizeUnified(legacyUnified));
const helperNormalized = JSON.stringify(normalizeUnified(helperUnified));

const captured = [];
const sock = {
  relayMessage: async (jid, content, options) => {
    captured.push({ jid, content, options });
    return { ok: true };
  }
};

await sendAIRichHtml(sock, '120363000000000000@g.us', html, { label: 'Rich HTML Test' });

const relay = captured[0];
const relayUnified = parseUnified(relay.content);
const primitive = relayUnified.sections?.[0]?.view_model?.primitive;
const botJid = relay.content?.botForwardedMessage?.message?.richResponseMessage?.contextInfo?.forwardedAiBotMessageInfo?.botJid;
const messageId = relay.options?.messageId;

const report = {
  htmlBytes: Buffer.byteLength(html, 'utf8'),
  legacyUnifiedResponseBytes: legacyContent.botForwardedMessage.message.richResponseMessage.unifiedResponse.data.length,
  helperUnifiedResponseBytes: helperContent.botForwardedMessage.message.richResponseMessage.unifiedResponse.data.length,
  shapeEqual: legacyShape === helperShape,
  unifiedStructureEqual: legacyNormalized === helperNormalized,
  primitiveTypename: primitive?.__typename,
  primitiveMatches: primitive?.__typename === HTML_PRIMITIVE,
  botJid,
  botJidMatches: botJid === DEFAULT_BOT_JID,
  hasMessageId: typeof messageId === 'string' && messageId.length > 0,
  messageId,
  relayCalls: captured.length,
  relayJid: relay.jid
};

console.log(JSON.stringify(report, null, 2));

if (!report.shapeEqual || !report.unifiedStructureEqual) {
  console.error('Payload mudou estruturalmente.');
  process.exit(1);
}

if (!report.primitiveMatches || !report.botJidMatches || !report.hasMessageId) {
  console.error('Validacao de primitive, JID ou messageId falhou.');
  process.exit(1);
}

console.log('compareRichtestPayload: OK');
