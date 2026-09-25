import crypto from 'crypto';

const AI_RICH_RESPONSE_TYPE_STANDARD = 1;
const DEFAULT_BOT_JID = '867051314767696@bot';
const HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';
const DEFAULT_AIRICH_SAFE_MAX_BYTES = 2 * 1024 * 1024;

function getAirichSafeMaxBytes() {
  const raw = process.env.AIRICH_SAFE_MAX_BYTES;
  if (!raw) return DEFAULT_AIRICH_SAFE_MAX_BYTES;
  const m = String(raw).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb)?$/);
  if (!m) return DEFAULT_AIRICH_SAFE_MAX_BYTES;
  const v = parseFloat(m[1]);
  if (m[2] === 'kb') return Math.round(v * 1024);
  if (m[2] === 'mb') return Math.round(v * 1024 * 1024);
  return Math.round(v);
}

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function buildHtmlSection(html, trustedSources = [], url = '') {
  const primitive = { __typename: HTML_PRIMITIVE, payload: html, trusted_sources: trustedSources };
  if (url) primitive.url = url;
  return { __typename: 'GenAIUnifiedResponseSection', view_model: { __typename: 'GenAISingleLayoutViewModel', primitive } };
}

function buildUnifiedResponse(html, trustedSources = [], url = '') {
  return { __typename: 'GenAIUnifiedResponse', response_id: createId(), sections: [buildHtmlSection(html, trustedSources, url)] };
}

function buildAIRichMessageContent(html, options = {}) {
  const { label = 'Rich HTML Test', botJid = DEFAULT_BOT_JID, trustedSources = [], url = '' } = options;
  const unifiedData = Buffer.from(JSON.stringify(buildUnifiedResponse(html, trustedSources, url)), 'utf-8');
  return { botForwardedMessage: { message: { richResponseMessage: { messageType: AI_RICH_RESPONSE_TYPE_STANDARD, submessages: label ? [{ messageType: 2, messageText: label }] : [], unifiedResponse: { data: unifiedData }, contextInfo: { mentionedJid: [], groupMentions: [], statusAttributions: [], forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid }, forwardOrigin: 4 } } } } };
}

function getAirichPayloadStats(html, richContent) {
  const richResponse = richContent?.botForwardedMessage?.message?.richResponseMessage;
  const unifiedBytes = richResponse?.unifiedResponse?.data?.length || 0;
  return {
    htmlBytes: Buffer.byteLength(html || '', 'utf8'),
    unifiedResponseBytes: unifiedBytes,
    hasRichResponseMessage: !!richResponse,
    hasHtmlPrimitive: (() => {
      try {
        const unified = JSON.parse(Buffer.from(richResponse.unifiedResponse.data).toString('utf8'));
        return unified.sections?.[0]?.view_model?.primitive?.__typename === HTML_PRIMITIVE;
      } catch {
        return false;
      }
    })()
  };
}

function logAirichPayloadStats(label, html, richContent) {
  const stats = getAirichPayloadStats(html, richContent);
  console.log(`[${label}] htmlBytes=${stats.htmlBytes}`);
  console.log(`[${label}] unifiedResponseBytes=${stats.unifiedResponseBytes}`);
  console.log(`[${label}] hasRichResponseMessage=${stats.hasRichResponseMessage}`);
  console.log(`[${label}] hasHtmlPrimitive=${stats.hasHtmlPrimitive}`);
  if (stats.htmlBytes > 900000 || stats.unifiedResponseBytes > 1000000) {
    console.warn(`[${label}] Payload grande para AIRich/WebView; teste pode falhar no cliente.`);
  }
  return stats;
}

function buildAirichPayloadMetrics(html, richContent) {
  const stats = getAirichPayloadStats(html, richContent);
  const jsonBytes = Buffer.byteLength(JSON.stringify(richContent), 'utf8');
  return {
    ...stats,
    jsonBytes,
    base64Bytes: Buffer.byteLength(Buffer.from(html || '', 'utf8').toString('base64'), 'utf8'),
    totalEstimatedBytes: jsonBytes,
    limitBytes: getAirichSafeMaxBytes()
  };
}

function checkAirichPayloadWithinLimit(html, richContent) {
  const metrics = buildAirichPayloadMetrics(html, richContent);
  const limitBytes = getAirichSafeMaxBytes();
  return {
    ok: metrics.unifiedResponseBytes <= limitBytes,
    limitBytes,
    metrics
  };
}

function logAirichBlocked(logLabel, check) {
  console.log(`[${logLabel}] htmlBytes=${check.metrics.htmlBytes}`);
  console.log(`[${logLabel}] base64Bytes=${check.metrics.base64Bytes}`);
  console.log(`[${logLabel}] jsonBytes=${check.metrics.jsonBytes}`);
  console.log(`[${logLabel}] unifiedResponseBytes=${check.metrics.unifiedResponseBytes}`);
  console.log(`[${logLabel}] hasRichResponseMessage=${check.metrics.hasRichResponseMessage}`);
  console.log(`[${logLabel}] hasHtmlPrimitive=${check.metrics.hasHtmlPrimitive}`);
  console.log(`[AIRICH] Payload bloqueado por segurança: unifiedResponseBytes=${check.metrics.unifiedResponseBytes} > limitBytes=${check.limitBytes}. Nenhum relayMessage enviado (sem retry, sem queda de socket, sem remoção de sessão).`);
}

async function sendAIRichHtml(sock, jid, html, options = {}) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const { label = 'Rich HTML Test', trustedSources = [], botJid = DEFAULT_BOT_JID, messageId = createId(), logLabel = 'richtest', url = '' } = options;
  const richContent = buildAIRichMessageContent(html, { label, trustedSources, botJid, url });

  const check = checkAirichPayloadWithinLimit(html, richContent);
  console.log(`[${logLabel}] htmlBytes=${check.metrics.htmlBytes}`);
  console.log(`[${logLabel}] unifiedResponseBytes=${check.metrics.unifiedResponseBytes}`);
  if (!check.ok) {
    logAirichBlocked(logLabel, check);
    return {
      ok: false,
      blocked: 'size_limit',
      reason: `unifiedResponseBytes (${check.metrics.unifiedResponseBytes}) > AIRICH_SAFE_MAX_BYTES (${check.limitBytes})`,
      limitBytes: check.limitBytes,
      metrics: check.metrics,
      relayResult: 'BLOCKED'
    };
  }

  console.log(`[${logLabel}] Enviando uma unica botForwardedMessage.richResponseMessage...`);
  const relayResult = await sock.relayMessage(jid, richContent, { messageId });
  return { ok: true, blocked: null, limitBytes: check.limitBytes, metrics: check.metrics, relayResult };
}

export {
  AI_RICH_RESPONSE_TYPE_STANDARD,
  DEFAULT_BOT_JID,
  DEFAULT_AIRICH_SAFE_MAX_BYTES,
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildAirichPayloadMetrics,
  buildUnifiedResponse,
  checkAirichPayloadWithinLimit,
  createId,
  getAirichPayloadStats,
  getAirichSafeMaxBytes,
  logAirichBlocked,
  logAirichPayloadStats,
  sendAIRichHtml
};
