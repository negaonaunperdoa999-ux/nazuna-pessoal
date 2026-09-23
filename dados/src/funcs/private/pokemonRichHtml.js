import { sendAIRichHtml } from './airich/sendAIRichHtml.js';
import { buildRichTestHtml } from './airich/richTestHtml.js';
import { buildAirichProbeTextHtml, inspectAirichProbePayload, sendAirichProbe } from './airich/airichProbe.js';

export {
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats
} from './airich/sendAIRichHtml.js';

async function sendRichHtmlTest(sock, jid) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  return sendAIRichHtml(sock, jid, buildRichTestHtml(), { label: 'Rich HTML Test' });
}

export {
  buildAirichProbeTextHtml,
  buildRichTestHtml,
  inspectAirichProbePayload,
  sendAirichProbe,
  sendRichHtmlTest
};