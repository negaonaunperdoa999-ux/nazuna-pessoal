import {
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats
} from './airich/sendAIRichHtml.js';
import { buildRichTestHtml } from './airich/richTestHtml.js';

async function sendRichHtmlTest(sock, jid) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const html = buildRichTestHtml();
  const richContent = buildAIRichMessageContent(html, { label: 'Rich HTML Test' });
  logAirichPayloadStats('richtest', html, richContent);
  console.log('[richtest] Enviando uma unica botForwardedMessage.richResponseMessage...');
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

function buildAirichProbeTextHtml(label) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main>${label}</main></body></html>`;
}

function inspectAirichProbePayload(label, richContent, relayCalls, hasMessageId) {
  const richResponse = richContent.botForwardedMessage.message.richResponseMessage;
  const unifiedResponse = JSON.parse(Buffer.from(richResponse.unifiedResponse.data).toString('utf8'));
  const primitive = unifiedResponse.sections?.[0]?.view_model?.primitive;
  console.log(`[airichprobe] ${label}`);
  console.log(`[airichprobe] htmlBytes=${Buffer.byteLength(primitive?.payload || '', 'utf8')}`);
  console.log(`[airichprobe] unifiedResponseBytes=${richResponse.unifiedResponse.data.length}`);
  console.log(`[airichprobe] primitiveTypename=${primitive?.__typename || 'missing'}`);
  console.log(`[airichprobe] trustedSourcesCount=${primitive?.trusted_sources?.length ?? 0}`);
  console.log(`[airichprobe] relayCalls=${relayCalls}`);
  console.log(`[airichprobe] hasMessageId=${hasMessageId}`);
}

async function sendAirichProbe(sock, jid) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');

  const probes = [
    {
      label: 'TESTE 1 - trusted_sources vazio',
      trustedSources: []
    },
    {
      label: 'TESTE 2 - trusted_sources nixel.dev',
      trustedSources: ['nixel.dev']
    }
  ];

  const results = [];
  for (const probe of probes) {
    const richContent = buildAIRichMessageContent(buildAirichProbeTextHtml(probe.label), {
      label: probe.label,
      trustedSources: probe.trustedSources
    });
    const messageId = createId();
    const result = await sock.relayMessage(jid, richContent, { messageId });
    inspectAirichProbePayload(probe.label, richContent, 1, typeof messageId === 'string' && messageId.length > 0);
    results.push(result);
  }

  return results;
}

export {
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  buildRichTestHtml,
  buildUnifiedResponse,
  createId,
  getAirichPayloadStats,
  logAirichPayloadStats,
  sendAirichProbe,
  sendRichHtmlTest
};
