import crypto from 'crypto';

const AI_RICH_RESPONSE_TYPE_STANDARD = 1;
const DEFAULT_BOT_JID = '867051314767696@bot';
const HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

function buildRichTestHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
html,body{margin:0;height:430px;overflow:hidden;font-family:Arial,sans-serif;background:#101820;color:#fff}.app{height:430px;display:grid;place-items:center;text-align:center;padding:12px}h2{margin:0 0 8px;font-size:22px}.ok{margin:0 0 12px;font-size:15px}#counter{margin:0 0 8px;font-size:32px;font-weight:700}#canvasTest{display:block;width:240px;height:160px;margin:0 auto 10px;border:1px solid #4c6a7a;border-radius:8px;background:#172a35}.buttons{display:flex;gap:10px;justify-content:center}button{min-width:90px;min-height:42px;border:0;border-radius:6px;background:#ffcb05;color:#1f2937;font-size:17px;font-weight:700}button:active{background:#f2b807;transform:translateY(1px)}
</style></head><body><div class="app"><div><h2>Rich HTML Test</h2><p class="ok">HTML funcionando!</p><p id="counter">0</p><canvas id="canvasTest" width="240" height="160" aria-label="Teste de Canvas"></canvas><div class="buttons"><button type="button" onclick="add()">+1</button><button type="button" onclick="resetCounter()">Reset</button><button type="button" id="animationButton">Pausar</button></div></div></div><script>
let value=0;const counter=document.getElementById('counter');const canvas=document.getElementById('canvasTest');const context=canvas.getContext('2d');const animationButton=document.getElementById('animationButton');let animationRunning=true;let squareX=0;let direction=1;function render(){counter.textContent=String(value)}function add(){value+=1;render()}function resetCounter(){value=0;render()}function drawCanvas(){context.fillStyle='#172a35';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#2b4655';for(let x=0;x<canvas.width;x+=24){context.fillRect(x,0,1,canvas.height)}context.fillStyle='#ffcb05';context.fillRect(squareX,64,28,28);context.fillStyle='#101820';context.fillRect(squareX+18,72,4,4)}function animateCanvas(){if(animationRunning){squareX+=direction*1.5;if(squareX+28>=canvas.width||squareX<=0){direction*=-1;squareX=Math.max(0,Math.min(canvas.width-28,squareX))}drawCanvas()}requestAnimationFrame(animateCanvas)}animationButton.addEventListener('click',function(){animationRunning=!animationRunning;animationButton.textContent=animationRunning?'Pausar':'Iniciar';if(!animationRunning)drawCanvas()});render();drawCanvas();requestAnimationFrame(animateCanvas);
</script></body></html>`;
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

export { HTML_PRIMITIVE, buildAIRichMessageContent, buildRichTestHtml, buildUnifiedResponse, createId, getAirichPayloadStats, logAirichPayloadStats, sendAirichProbe, sendRichHtmlTest };
