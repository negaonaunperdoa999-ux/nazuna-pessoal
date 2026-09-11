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
html,body{margin:0;height:260px;overflow:hidden;font-family:Arial,sans-serif;background:#101820;color:#fff}.app{height:260px;display:grid;place-items:center;text-align:center;padding:16px}h2{margin:0 0 8px;font-size:22px}.ok{margin:0 0 12px;font-size:15px}#counter{margin:0 0 14px;font-size:44px;font-weight:700}.buttons{display:flex;gap:10px;justify-content:center}button{min-width:90px;min-height:42px;border:0;border-radius:6px;background:#ffcb05;color:#1f2937;font-size:17px;font-weight:700}button:active{background:#f2b807;transform:translateY(1px)}
</style></head><body><div class="app"><div><h2>Rich HTML Test</h2><p class="ok">HTML funcionando!</p><p id="counter">0</p><div class="buttons"><button type="button" onclick="add()">+1</button><button type="button" onclick="resetCounter()">Reset</button></div></div></div><script>
let value=0;const counter=document.getElementById('counter');function render(){counter.textContent=String(value)}function add(){value+=1;render()}function resetCounter(){value=0;render()}render();
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

async function sendRichHtmlTest(sock, jid) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const richContent = buildAIRichMessageContent(buildRichTestHtml(), { label: 'Rich HTML Test' });
  console.log('[richtest] Enviando uma unica botForwardedMessage.richResponseMessage...');
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

export { HTML_PRIMITIVE, buildAIRichMessageContent, buildRichTestHtml, buildUnifiedResponse, sendRichHtmlTest };
