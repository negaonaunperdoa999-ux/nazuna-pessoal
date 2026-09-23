import { buildAIRichMessageContent, createId, logAirichPayloadStats } from './airich/sendAIRichHtml.js';

const DOOM_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/js-dos@7.5.0/dist/js-dos.js';
const DOOM_CSS_URL = 'https://cdn.jsdelivr.net/npm/js-dos@7.5.0/dist/js-dos.css';
const DOOM_WASM_PREFIX = 'https://cdn.jsdelivr.net/npm/js-dos@7.5.0/dist/';

const DOOM_INPUTS = [
  ['up', 'UP', 'ArrowUp', 38],
  ['down', 'DOWN', 'ArrowDown', 40],
  ['left', 'LEFT', 'ArrowLeft', 37],
  ['right', 'RIGHT', 'ArrowRight', 39],
  ['strafeLeft', 'STRAFE_LEFT', 'KeyA', 65],
  ['strafeRight', 'STRAFE_RIGHT', 'KeyD', 68],
  ['run', 'RUN', 'Space', 32],
  ['fire', 'FIRE', 'KeyS', 83],
  ['use', 'USE', 'KeyW', 87],
  ['weapon1', '1', 'Digit1', 49],
  ['weapon2', '2', 'Digit2', 50],
  ['weapon3', '3', 'Digit3', 51],
  ['weapon4', '4', 'Digit4', 52],
  ['weapon5', '5', 'Digit5', 53],
  ['weapon6', '6', 'Digit6', 54],
  ['weapon7', '7', 'Digit7', 55],
  ['tab', 'TAB', 'Tab', 9],
  ['escape', 'ESC', 'Escape', 27],
  ['enter', 'ENTER', 'Enter', 13]
];

function buildInputStateLiteral() {
  return DOOM_INPUTS.map(([key]) => `${key}: false`).join(',');
}

function buildDoomControlStyles(extra = '') {
  return `
html,body{margin:0;min-height:100%;background:#101820;color:#fff;font-family:Arial,sans-serif;overscroll-behavior:none;touch-action:none}
*{box-sizing:border-box}
.app{width:100%;min-height:560px;padding:10px;display:grid;gap:8px;align-content:start}
h2{margin:0;font-size:19px;text-align:center}
.stage{display:grid;place-items:center;min-height:160px;border:2px solid #3b5361;border-radius:8px;background:#05080b;overflow:hidden}
canvas,#dosbox{width:min(100%,480px);aspect-ratio:16/10;max-height:42vh;background:#000;object-fit:contain;image-rendering:pixelated}
.readout{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:#c5d7df}
.readout span{padding:6px;border-radius:6px;background:#1d303b}
.controls{display:grid;gap:8px;grid-template-areas:"move actions" "weapons weapons" "system system";grid-template-columns:1fr 1fr}
.move{grid-area:move;display:grid;grid-template-columns:repeat(3,44px);grid-template-rows:repeat(3,38px);gap:4px;justify-content:center}
.actions{grid-area:actions;display:grid;grid-template-columns:repeat(3,1fr);gap:5px;align-content:center}
.weapons{grid-area:weapons;display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.system{grid-area:system;display:grid;grid-template-columns:repeat(5,1fr);gap:5px}
button{border:0;border-radius:6px;min-height:36px;padding:0 8px;background:#ffcb05;color:#19212a;font-weight:700;font-size:12px;touch-action:none;user-select:none}
button.pressed{background:#f05a28;color:#fff;transform:translateY(1px)}
button.wide{font-size:11px}
[data-input="up"]{grid-column:2;grid-row:1}
[data-input="left"]{grid-column:1;grid-row:2}
[data-input="down"]{grid-column:2;grid-row:2}
[data-input="right"]{grid-column:3;grid-row:2}
.expanded .app{min-height:760px}.expanded .stage{min-height:260px}.expanded canvas,.expanded #dosbox{max-height:58vh}
@media (orientation:landscape){
  .app{min-height:360px;grid-template-columns:minmax(120px,1fr) minmax(260px,2.2fr) minmax(120px,1fr);grid-template-areas:"title title title" "left stage right" "readout stage right";align-items:center}
  h2{grid-area:title}
  .stage{grid-area:stage;min-height:220px}
  canvas,#dosbox{max-height:70vh}
  .controls{display:contents}
  .move{grid-area:left}
  .actions{grid-area:right;grid-template-columns:1fr 1fr}
  .weapons{grid-area:readout;grid-template-columns:repeat(4,1fr)}
  .system{grid-area:right;align-self:end;grid-template-columns:1fr 1fr}
  .readout{grid-area:readout;align-self:start;grid-template-columns:1fr}
}
@media (orientation:portrait){
  .app{min-height:560px}
}
${extra}`;
}

function buildDoomControlsHtml() {
  const button = (key, label, cls = '') => `<button type="button" class="${cls}" data-input="${key}">${label}</button>`;
  return `<section class="controls">
  <div class="move">
    ${button('up', 'UP')}
    ${button('left', 'LEFT')}
    ${button('down', 'DOWN')}
    ${button('right', 'RIGHT')}
  </div>
  <div class="actions">
    ${button('strafeLeft', 'STRAFE L', 'wide')}
    ${button('fire', 'FIRE')}
    ${button('strafeRight', 'STRAFE R', 'wide')}
    ${button('run', 'RUN')}
    ${button('use', 'USE')}
  </div>
  <div class="weapons">
    ${button('weapon1', '1')}${button('weapon2', '2')}${button('weapon3', '3')}${button('weapon4', '4')}${button('weapon5', '5')}${button('weapon6', '6')}${button('weapon7', '7')}
  </div>
  <div class="system">
    ${button('tab', 'TAB')}${button('escape', 'ESC')}${button('enter', 'ENTER')}
    <button type="button" class="wide" id="fullscreenBtn">TELA CHEIA</button>
    <button type="button" class="wide" id="landscapeBtn">PAISAGEM</button>
  </div>
</section>`;
}

function buildDoomInputScript(engineBridge = '') {
  const map = JSON.stringify(Object.fromEntries(DOOM_INPUTS.map(([key, label, code, keyCode]) => [key, { label, code, keyCode }])));
  const codeToKey = JSON.stringify(Object.fromEntries(DOOM_INPUTS.map(([key, , code]) => [code, key])));
  return `<script>
(function(){
const inputMap=${map};
const codeToKey=${codeToKey};
const inputState={${buildInputStateLiteral()}};
let eventCount=0,lastEvent='none';
const root=document.documentElement;
const lastEl=document.getElementById('lastEvent');
const countEl=document.getElementById('eventCount');
const stateEl=document.getElementById('stateView');
const fsBtn=document.getElementById('fullscreenBtn');
const landBtn=document.getElementById('landscapeBtn');
function updateReadout(){lastEl.textContent=lastEvent;countEl.textContent=String(eventCount);stateEl.textContent=Object.keys(inputState).filter(k=>inputState[k]).join(', ')||'none'}
function emitInput(key,pressed,source){if(!inputMap[key])return;inputState[key]=pressed;eventCount+=1;lastEvent=inputMap[key].label+' '+(pressed?'DOWN':'UP')+' ('+source+')';const btn=document.querySelector('[data-input="'+key+'"]');if(btn)btn.classList.toggle('pressed',pressed);if(window.doomInputBridge)window.doomInputBridge(inputMap[key],pressed,inputState);updateReadout()}
function bindButton(btn){const key=btn.getAttribute('data-input');if(!key)return;btn.addEventListener('pointerdown',e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId)}catch{}emitInput(key,true,'pointerdown')});['pointerup','pointercancel','pointerleave'].forEach(n=>btn.addEventListener(n,e=>{e.preventDefault();emitInput(key,false,n)}));btn.addEventListener('touchstart',e=>{e.preventDefault();emitInput(key,true,'touchstart')},{passive:false});btn.addEventListener('touchend',e=>{e.preventDefault();emitInput(key,false,'touchend')},{passive:false});btn.addEventListener('click',e=>{e.preventDefault();if(!inputState[key]){emitInput(key,true,'click');setTimeout(()=>emitInput(key,false,'click'),80)}})}
document.querySelectorAll('[data-input]').forEach(bindButton);
window.addEventListener('keydown',e=>{const key=codeToKey[e.code];if(key&&!inputState[key]){e.preventDefault();emitInput(key,true,'keyDown')}},true);
window.addEventListener('keyup',e=>{const key=codeToKey[e.code];if(key){e.preventDefault();emitInput(key,false,'keyUp')}},true);
function refreshLayout(){root.classList.toggle('landscape',window.matchMedia&&window.matchMedia('(orientation: landscape)').matches)}
window.addEventListener('resize',refreshLayout);window.addEventListener('orientationchange',refreshLayout);refreshLayout();
function setExpanded(on){root.classList.toggle('expanded',on);fsBtn.textContent=on?'SAIR DA TELA CHEIA':'TELA CHEIA'}
fsBtn.addEventListener('click',async()=>{try{if(document.fullscreenEnabled){if(!document.fullscreenElement){await document.documentElement.requestFullscreen();setExpanded(true)}else{await document.exitFullscreen();setExpanded(false)}}else{setExpanded(!root.classList.contains('expanded'))}}catch{setExpanded(!root.classList.contains('expanded'))}});
document.addEventListener('fullscreenchange',()=>setExpanded(!!document.fullscreenElement));
landBtn.addEventListener('click',async()=>{try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape')}catch{}refreshLayout();});
${engineBridge}
updateReadout();
}());
</script>`;
}

function buildDoomTestHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${buildDoomControlStyles()}</style></head><body><main class="app"><h2>DOOM Input Test</h2><section class="stage"><canvas id="screen" width="320" height="200"></canvas></section><section class="readout"><span>Ultimo evento: <b id="lastEvent">none</b></span><span>Eventos recebidos: <b id="eventCount">0</b></span><span>Pressionados: <b id="stateView">none</b></span><span>Orientacao: responsiva</span></section>${buildDoomControlsHtml()}</main>${buildDoomInputScript("const c=document.getElementById('screen'),x=c.getContext('2d');window.doomInputBridge=function(info,pressed,state){x.fillStyle='#071018';x.fillRect(0,0,c.width,c.height);x.fillStyle=pressed?'#f05a28':'#ffcb05';x.fillRect(36,36,248,96);x.fillStyle='#101820';x.font='22px Arial';x.textAlign='center';x.fillText(info.label+' '+(pressed?'DOWN':'UP'),160,92);};window.doomInputBridge({label:'READY'},false,inputState);")}</body></html>`;
}

function normalizeDoomBundleUrl(bundleUrl = '') {
  const trimmed = String(bundleUrl || '').trim();
  if (!trimmed) return '';
  if (!/^https:\/\//i.test(trimmed)) return '';
  if (!/\.jsdos(?:[?#].*)?$/i.test(trimmed) && !/\.zip(?:[?#].*)?$/i.test(trimmed)) return '';
  return trimmed;
}

function buildDoomExperimentalHtml(bundleUrl = '') {
  const safeBundleUrl = normalizeDoomBundleUrl(bundleUrl);
  const bridge = `
const status=document.getElementById('doomStatus');
const start=document.getElementById('startDoom');
const urlInput=document.getElementById('bundleUrl');
function setStatus(t){status.textContent=t}
function sendKey(keyCode,down){const type=down?'keydown':'keyup';const ev=new KeyboardEvent(type,{keyCode:keyCode,which:keyCode,bubbles:true});Object.defineProperty(ev,'keyCode',{get:()=>keyCode});Object.defineProperty(ev,'which',{get:()=>keyCode});window.dispatchEvent(ev);document.dispatchEvent(ev)}
window.doomInputBridge=function(info,pressed){sendKey(info.keyCode,pressed)};
start.addEventListener('click',function(){const bundle=(urlInput.value||'').trim();if(!/^https:\\/\\//i.test(bundle)){setStatus('Informe uma URL HTTPS de bundle .jsdos/.zip livre, ex: Freedoom empacotado para js-dos.');return}setStatus('Carregando js-dos e bundle DOOM...');if(typeof Dos==='undefined'){setStatus('js-dos nao carregou. WebView bloqueou script remoto ou rede.');return}try{window.emulators=window.emulators||{};window.emulators.pathPrefix='${DOOM_WASM_PREFIX}';Dos(document.getElementById('dosbox')).run(bundle).then(function(){setStatus('Bundle iniciado. Teste movimento/FIRE/USE.')}).catch(function(e){setStatus('Falha no bundle: '+(e&&e.message?e.message:e))})}catch(e){setStatus('Falha ao iniciar DOOM: '+e.message)}});`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${DOOM_CSS_URL}"><style>${buildDoomControlStyles('.start{display:grid;grid-template-columns:1fr;gap:6px}.status{font-size:12px;color:#c5d7df;text-align:center}input{width:100%;min-height:36px;border:1px solid #4c6a7a;border-radius:6px;background:#081118;color:#fff;padding:0 8px;font-size:12px}')}</style></head><body><main class="app"><h2>DOOM AIRich Experimental</h2><section class="stage"><div id="dosbox"></div></section><div class="start"><input id="bundleUrl" type="url" value="${safeBundleUrl}" placeholder="https://.../freedoom.jsdos"><button type="button" id="startDoom">INICIAR DOOM</button><div class="status" id="doomStatus">Loader pronto. Forneca um bundle livre .jsdos/.zip por HTTPS; nenhuma IWAD proprietaria foi embutida.</div></div><section class="readout"><span>Ultimo evento: <b id="lastEvent">none</b></span><span>Eventos recebidos: <b id="eventCount">0</b></span><span>Pressionados: <b id="stateView">none</b></span><span>WASM/rede: carregamento remoto</span></section>${buildDoomControlsHtml()}</main><script src="${DOOM_SCRIPT_URL}"></script>${buildDoomInputScript(bridge)}</body></html>`;
}

async function sendDoomRichHtml(sock, jid, label, html) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const richContent = buildAIRichMessageContent(html, { label });
  logAirichPayloadStats(label.toLowerCase().replace(/\\s+/g, ''), html, richContent);
  console.log(`[${label}] Enviando botForwardedMessage.richResponseMessage...`);
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

function sendDoomInputTest(sock, jid) {
  return sendDoomRichHtml(sock, jid, 'DOOM Input Test', buildDoomTestHtml());
}

function sendDoomExperimental(sock, jid, bundleUrl = '') {
  return sendDoomRichHtml(sock, jid, 'DOOM Experimental', buildDoomExperimentalHtml(bundleUrl));
}

export { DOOM_CSS_URL, DOOM_INPUTS, DOOM_SCRIPT_URL, DOOM_WASM_PREFIX, buildDoomExperimentalHtml, buildDoomTestHtml, normalizeDoomBundleUrl, sendDoomExperimental, sendDoomInputTest };
