import {
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats
} from './airich/sendAIRichHtml.js';
import { buildRichTestHtml } from './airich/richTestHtml.js';
import { buildAirichProbeTextHtml, inspectAirichProbePayload, sendAirichProbe } from './airich/airichProbe.js';

async function sendRichHtmlTest(sock, jid) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const html = buildRichTestHtml();
  const richContent = buildAIRichMessageContent(html, { label: 'Rich HTML Test' });
  logAirichPayloadStats('richtest', html, richContent);
  console.log('[richtest] Enviando uma unica botForwardedMessage.richResponseMessage...');
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

export {
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildRichTestHtml,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats,
  buildAirichProbeTextHtml,
  inspectAirichProbePayload,
  sendAirichProbe,
  sendRichHtmlTest
};
