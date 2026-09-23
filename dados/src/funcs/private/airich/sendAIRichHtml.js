import crypto from 'crypto';

const AI_RICH_RESPONSE_TYPE_STANDARD = 1;
const DEFAULT_BOT_JID = '867051314767696@bot';
const HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function buildHtmlSection(html, trustedSources = []) {
  return { __typename: 'GenAIUnifiedResponseSection', view_model: { __typename: 'GenAISingleLayoutViewModel', primitive: { __typename: HTML_PRIMITIVE, payload: html, trusted_sources: trustedSources } } };
}

function buildUnifiedResponse(html, trustedSources = []) {
  return { __typename: 'GenAIUnifiedResponse', response_id: createId(), sections: [buildHtmlSection(html, trustedSources)] };
}

function buildAIRichMessageContent(html, options = {}) {
  const { label = 'Rich HTML Test', botJid = DEFAULT_BOT_JID, trustedSources = [] } = options;
  const unifiedData = Buffer.from(JSON.stringify(buildUnifiedResponse(html, trustedSources)), 'utf-8');
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

async function sendAIRichHtml(sock, jid, html, options = {}) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const { label = 'Rich HTML Test', trustedSources = [], botJid = DEFAULT_BOT_JID, messageId = createId(), logLabel = 'richtest' } = options;
  const richContent = buildAIRichMessageContent(html, { label, trustedSources, botJid });
  logAirichPayloadStats(logLabel, html, richContent);
  console.log(`[${logLabel}] Enviando uma unica botForwardedMessage.richResponseMessage...`);
  return sock.relayMessage(jid, richContent, { messageId });
}

export {
  AI_RICH_RESPONSE_TYPE_STANDARD,
  DEFAULT_BOT_JID,
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats,
  sendAIRichHtml
};
