import { readFileSync } from 'fs';
import { buildAIRichMessageContent, checkAirichPayloadWithinLimit, createId, logAirichPayloadStats } from './airich/sendAIRichHtml.js';
import { buildDoomOrientationCss, buildDoomOrientationScript } from './doom/doomOrientation.js';

const JSDOS_ROOT = new URL('./doom/vendor/jsdos/', import.meta.url);
const DOOM_ASSETS_ROOT = new URL('./doom/assets/', import.meta.url);

function readDoomAsset(relativePath) {
  return readFileSync(new URL(relativePath, JSDOS_ROOT), 'utf8')
    .replace(/<\/script/gi, '<\\/script');
}

function readDoomAssetB64(relativePath) {
  return readFileSync(new URL(relativePath, JSDOS_ROOT)).toString('base64');
}

function readDoomBundleB64() {
  const minimal = new URL('doom-minimal.jsdos', DOOM_ASSETS_ROOT);
  const original = new URL('doom.jsdos', DOOM_ASSETS_ROOT);
  let bundleUrl = original;
  try {
    if (readFileSync(minimal, { flag: 'r' })) bundleUrl = minimal;
  } catch (_) {
    bundleUrl = original;
  }
  return readFileSync(bundleUrl).toString('base64');
}

function toJsStringLiteral(value) {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/`/g, '\\u0060')
    .replace(/\$\{/g, '$\\u007b');
}

const JSDOS_JS = readDoomAsset('js-dos.js');
const JSDOS_CSS = readDoomAsset('js-dos.css');
const WDOSBOX_JS = readDoomAsset('wdosbox.js');
const WDOSBOX_WASM_B64 = readDoomAssetB64('wdosbox.wasm');

const DOOM_WASM_PREFIX = 'https://cdn.jsdelivr.net/npm/js-dos@7.5.0/dist/';
const DOOM_BUNDLE_URL = 'https://cdn.dos.zone/custom/dos/doom.jsdos';
const DOOM_TRUSTED_SOURCES = [
  'https://cdn.jsdelivr.net',
  'https://cdn.dos.zone'
];

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
function updateReadout(){if(lastEl)lastEl.textContent=lastEvent;if(countEl)countEl.textContent=String(eventCount);if(stateEl)stateEl.textContent=Object.keys(inputState).filter(k=>inputState[k]).join(', ')||'none'}
function emitInput(key,pressed,source){if(!inputMap[key])return;inputState[key]=pressed;eventCount+=1;lastEvent=inputMap[key].label+' '+(pressed?'DOWN':'UP')+' ('+source+')';const btn=document.querySelector('[data-input="'+key+'"]');if(btn)btn.classList.toggle('pressed',pressed);if(window.doomInputBridge)window.doomInputBridge(inputMap[key],pressed,inputState);updateReadout()}
function bindButton(btn){const key=btn.getAttribute('data-input');if(!key)return;btn.addEventListener('pointerdown',e=>{e.preventDefault();try{btn.setPointerCapture(e.pointerId)}catch{}emitInput(key,true,'pointerdown')});['pointerup','pointercancel','pointerleave'].forEach(n=>btn.addEventListener(n,e=>{e.preventDefault();emitInput(key,false,n)}));btn.addEventListener('touchstart',e=>{e.preventDefault();emitInput(key,true,'touchstart')},{passive:false});btn.addEventListener('touchend',e=>{e.preventDefault();emitInput(key,false,'touchend')},{passive:false});btn.addEventListener('click',e=>{e.preventDefault();if(!inputState[key]){emitInput(key,true,'click');setTimeout(()=>emitInput(key,false,'click'),80)}})}
document.querySelectorAll('[data-input]').forEach(bindButton);
window.addEventListener('keydown',e=>{const key=codeToKey[e.code];if(key&&!inputState[key]){e.preventDefault();emitInput(key,true,'keyDown')}},true);
window.addEventListener('keyup',e=>{const key=codeToKey[e.code];if(key){e.preventDefault();emitInput(key,false,'keyUp')}},true);
function refreshLayout(){root.classList.toggle('landscape',window.matchMedia&&window.matchMedia('(orientation: landscape)').matches)}
window.addEventListener('resize',refreshLayout);window.addEventListener('orientationchange',refreshLayout);refreshLayout();
function setExpanded(on){root.classList.toggle('expanded',on);if(fsBtn)fsBtn.textContent=on?'SAIR DA TELA CHEIA':'TELA CHEIA'}
if(fsBtn)fsBtn.addEventListener('click',async()=>{try{if(document.fullscreenEnabled){if(!document.fullscreenElement){await document.documentElement.requestFullscreen();setExpanded(true)}else{await document.exitFullscreen();setExpanded(false)}}else{setExpanded(!root.classList.contains('expanded'))}}catch{setExpanded(!root.classList.contains('expanded'))}});
if(fsBtn)document.addEventListener('fullscreenchange',()=>setExpanded(!!document.fullscreenElement));
if(landBtn)landBtn.addEventListener('click',async()=>{try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock('landscape')}catch{}refreshLayout();});
${engineBridge}
updateReadout();
}());
</script>`;
}

function buildDoomTestHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${buildDoomControlStyles()}</style></head><body><main class="app"><h2>DOOM Input Test</h2><section class="stage"><canvas id="screen" width="320" height="200"></canvas></section><section class="readout"><span>Ultimo evento: <b id="lastEvent">none</b></span><span>Eventos recebidos: <b id="eventCount">0</b></span><span>Pressionados: <b id="stateView">none</b></span><span>Orientacao: responsiva</span></section>${buildDoomControlsHtml()}</main>${buildDoomInputScript("const c=document.getElementById('screen'),x=c.getContext('2d');window.doomInputBridge=function(info,pressed,state){x.fillStyle='#071018';x.fillRect(0,0,c.width,c.height);x.fillStyle=pressed?'#f05a28':'#ffcb05';x.fillRect(36,36,248,96);x.fillStyle='#101820';x.font='22px Arial';x.textAlign='center';x.fillText(info.label+' '+(pressed?'DOWN':'UP'),160,92);};window.doomInputBridge({label:'READY'},false,inputState);")}</body></html>`;
}

function buildDoomPlayerControlsHtml() {
  const button = (key, label, cls = '') => `<button type="button" class="${cls}" data-input="${key}" aria-label="${label}">${label}</button>`;
  return `<div class="dpad" aria-label="Direcional">
  <div class="pad-center" aria-hidden="true"></div>
  ${button('up', 'â†‘')}
  ${button('left', 'â†')}
  ${button('down', 'â†“')}
  ${button('right', 'â†’')}
</div>
<div class="actions" aria-label="Acoes">
  ${button('strafeLeft', 'â—€')}
  ${button('weapon1', '1')}
  ${button('weapon2', '2')}
  ${button('weapon3', '3')}
  ${button('weapon4', '4')}
  ${button('weapon5', '5')}
  ${button('strafeRight', 'â–¶')}
  ${button('weapon6', '6')}
  ${button('weapon7', '7')}
  ${button('use', 'USE')}
  ${button('fire', 'FIRE')}
  ${button('run', 'RUN')}
</div>`;
}

function buildDoomDiagnosticCss() {
  return `
.doom-diagnostics{grid-area:diag;display:flex;flex-direction:column;align-items:center;gap:2px;min-height:14px}
.doom-dbg{display:none;width:100%;max-height:120px;overflow:auto;-webkit-overflow-scrolling:touch;text-align:left;color:#9fb6c3;font:10px/1.4 Consolas,Monaco,monospace;background:rgba(0,0,0,0.55);border:1px solid #2a3c49;border-radius:6px;padding:4px 6px;white-space:pre-wrap;word-break:break-word}
.doom-dbg.show{display:block}`;
}

function buildDoomPlayerBridge(bundleUrl, options) {
  const embedWdosbox = options.embedWdosbox !== false;
  let embedBundle = false;
  let bundleB64 = null;
  if (embedWdosbox && options.embedBundle !== false) {
    try {
      bundleB64 = readDoomBundleB64();
      embedBundle = true;
    } catch (_) {
      embedBundle = false;
    }
  }
  const wdosboxJsLiteral = embedWdosbox ? toJsStringLiteral(WDOSBOX_JS) : 'null';
  const wasmB64Literal = embedWdosbox ? JSON.stringify(WDOSBOX_WASM_B64) : 'null';
  const bundleB64Literal = embedBundle ? JSON.stringify(bundleB64) : 'null';
  const bundleLiteral = JSON.stringify(bundleUrl);
  return `
try{document.getElementById('doomStatus').setAttribute('data-bridge','inicio')}catch(_){}
const doomStatus=document.getElementById('doomStatus');
const dosbox=document.getElementById('dosbox');
const __L=window.__doomLocal={};
__L.embedded=${embedWdosbox?true:false};
__L.wdosboxJs=${wdosboxJsLiteral};
__L.wasmB64=${wasmB64Literal};
__L.bundleB64=${bundleB64Literal};
__L.bundleUrl=${bundleLiteral};

var __netDedup={};
function mrk(m){if(__netDedup['M:'+m])return;__netDedup['M:'+m]=1;dbg('[DOOM-REMOTE] '+m);try{console.log('[DOOM-REMOTE] '+m)}catch(_){}}
function __netMark(kind,phase,extra){const k=kind+'|'+phase;if(__netDedup[k])return;__netDedup[k]=1;const l='[DOOM-REMOTE] '+kind+'_'+phase+(extra?' '+extra:'');dbg(l);try{console.log(l)}catch(_){}}
mrk('HTML_LOADED');
const R_PREFIX=${JSON.stringify(DOOM_WASM_PREFIX)};
const R_PROBES={WDOSBOX:String(R_PREFIX)+'wdosbox.js',WASM:String(R_PREFIX)+'wdosbox.wasm',BUNDLE:__L.bundleUrl};
var __workerStart=0,__workerErr=false,__sawWasmReq=false,__sawWasmOk=false;
function kindOf(url){
  const u=String(url||'').toLowerCase();
  if(/wdosbox\\.wasm/.test(u))return 'WASM';
  if(/wdosbox\\.js($|[?#])/.test(u))return 'WDOSBOX';
  if(/wlibzip\\.js/.test(u))return 'WLIBZIP';
  if(/\\.jsdos/.test(u))return 'BUNDLE';
  return 'OTHER';
}
function hookFetch(){
  if(typeof window.fetch!=='function')return;
  const orig=window.fetch;
  window.fetch=function(input,init){
    const url=typeof input==='string'?input:((input&&input.url)||'');
    const kind=kindOf(url);
    if(kind==='WASM'){__sawWasmReq=true}
    if(kind!=='OTHER'){__netMark(kind,'REQUEST',url)}
    const p=orig.apply(this,arguments);
    if(kind!=='OTHER'){
      p.then(function(r){
        const code=(r&&typeof r.status==='number')?r.status:0;
        const ok=code>0&&code<400;
        if(kind==='WASM'&&ok){__sawWasmOk=true}
        __netMark(kind,ok?'OK':'FAIL',url+(code?' status='+code:''));
      },function(e){
        const msg=(e&&(e.name?e.name+': ':'')+(e.message||''))||String(e);
        if(kind==='OTHER'){dbg('[DOOM-REMOTE] OTHER_FAIL '+url+' '+msg)}
        __netMark(kind,'FAIL',url+' '+msg);
      });
    }
    return p;
  };
}
function hookXHR(){
  if(typeof XMLHttpRequest==='undefined')return;
  const proto=XMLHttpRequest.prototype;
  const open=proto.open,send=proto.send;
  proto.open=function(m,u){this.__du=String(u||'');this.__dk=kindOf(this.__du);if(this.__dk==='WASM'){__sawWasmReq=true}if(this.__dk!=='OTHER'){__netMark(this.__dk,'REQUEST',this.__du)}return open.apply(this,arguments)};
  proto.send=function(){
    const self=this;
    if(self.__dk&&self.__dk!=='OTHER'){
      const done=function(){
        if(self.__dxhrDone)return;self.__dxhrDone=true;
        const st=self.status,ok=st>0&&st<400;
        if(self.__dk==='WASM'&&ok){__sawWasmOk=true}
        __netMark(self.__dk,ok?'OK':'FAIL',self.__du+(st?' status='+st:' status=0'));
      };
      const fail=function(e){if(self.__dxhrDone)return;self.__dxhrDone=true;__netMark(self.__dk,'FAIL',self.__du+' '+(e&&e.type?e.type:'network'))};
      const abrt=function(){if(self.__dxhrDone)return;self.__dxhrDone=true;__netMark(self.__dk,'FAIL',self.__du+' abort')};
      self.addEventListener('load',done);
      self.addEventListener('error',fail);
      self.addEventListener('abort',abrt);
    }
    return send.apply(this,arguments);
  };
}
function hookWorker(){
  if(typeof window.Worker!=='function')return;
  const Orig=window.Worker;
  function W(url,opts){
    const u=String(url||'');
    const kind=kindOf(u);
    if(kind==='WDOSBOX'){__workerStart=Date.now()}
    if(kind!=='OTHER'){__netMark(kind,'REQUEST',u)}
    const w=new Orig(url,opts);
    if(kind==='WDOSBOX'){
      w.addEventListener('error',function(e){__workerErr=true;__netMark('WDOSBOX','FAIL','worker error')});
    }
    return w;
  }
  W.prototype=Orig.prototype;
  window.Worker=W;
}
function hookScript(){
  try{
    const proto=HTMLScriptElement&&HTMLScriptElement.prototype;
    if(!proto)return;
    const cur=Object.getOwnPropertyDescriptor(proto,'src');
    if(!cur||!cur.set)return;
    Object.defineProperty(proto,'src',{set:function(v){
      const u=String(v||'');const kind=kindOf(u);
      if(kind!=='OTHER'){__netMark(kind,'REQUEST',u)}
      cur.set.call(this,v);
      if(kind!=='OTHER'){
        const el=this;
        el.addEventListener('load',function(){__netMark(kind,'OK',u)},true);
        el.addEventListener('error',function(){__netMark(kind,'FAIL',u+' script elem err')},true);
      }
    },get:cur.get});
  }catch(_){}
}
function installNetDiag(){hookFetch();hookXHR();hookWorker();hookScript()}
installNetDiag();
function probeOne(url){
  return new Promise(function(resolve){
    let done=false,timer=null;
    const fin=function(r){if(done)return;done=true;if(timer)clearTimeout(timer);resolve(r)};
    const tryRange=function(){
      if(typeof window.fetch==='function'){
        const ctrl=(typeof AbortController==='function')?new AbortController():null;
        if(ctrl)timer=setTimeout(function(){try{ctrl.abort()}catch(_){}fin({ok:false,err:'timeout (RANGE)'})},20000);
        window.fetch(url,{method:'GET',cache:'no-store',headers:{Range:'bytes=0-0'},signal:ctrl&&ctrl.signal}).then(function(r){
          const st=r&&typeof r.status==='number'?r.status:0;
          if(st===0){fin({ok:false,err:'opaque/cors status 0 (RANGE)'})}
          else{fin({ok:st<400,status:st,via:'RANGE'})}
        },function(e){fin({ok:false,err:(((e&&e.name)?e.name+': ':'')+((e&&e.message)||''))||String(e)+' (RANGE)'})});
      }else{
        try{
          const x=new XMLHttpRequest();
          x.open('GET',url,true);x.timeout=20000;
          x.setRequestHeader('Range','bytes=0-0');
          let sett=false;
          x.onreadystatechange=function(){if(x.readyState===4&&!sett){sett=true;const st=x.status;fin({ok:st>0&&st<400,status:st,via:'XHR-RANGE'})}};
          x.onerror=function(){if(!sett){sett=true;fin({ok:false,err:'xhr network (RANGE)'})}};
          x.send(null);
        }catch(e){fin({ok:false,err:'xhr '+((e&&e.message)||e)})}
      }
    };
    const tryHead=function(){
      if(typeof window.fetch==='function'){
        const ctrl=(typeof AbortController==='function')?new AbortController():null;
        if(ctrl)timer=setTimeout(function(){try{ctrl.abort()}catch(_){}fin({ok:false,err:'timeout (HEAD)'})},15000);
        window.fetch(url,{method:'HEAD',cache:'no-store',signal:ctrl&&ctrl.signal}).then(function(r){
          const st=r&&typeof r.status==='number'?r.status:0;
          if(st===0){fin({ok:false,err:'opaque/cors status 0 (HEAD)'})}
          else if(st===405||st===501){tryRange()}
          else{fin({ok:st<400,status:st,via:'HEAD'})}
        },function(e){
          const msg=(((e&&e.name)?e.name+': ':'')+((e&&e.message)||''))||String(e);
          if(/405|not.?allowed|range/i.test(msg)){tryRange();return}
          fin({ok:false,err:msg+' (HEAD)'});
        });
      }else{
        try{
          const x=new XMLHttpRequest();
          x.open('HEAD',url,true);x.timeout=15000;
          let sett=false;
          x.onreadystatechange=function(){if(x.readyState===4&&!sett){sett=true;const st=x.status;fin({ok:st>0&&st<400,status:st,via:'XHR-HEAD'})}};
          x.onerror=function(){if(!sett){sett=true;fin({ok:false,err:'xhr network (HEAD)'})}};
          x.send(null);
        }catch(e){fin({ok:false,err:'xhr '+((e&&e.message)||e)})}
      }
    };
    tryHead();
  });
}
function runNetCheck(){
  const names=['WDOSBOX','WASM','BUNDLE'];
  let failed=[],n=0;
  return new Promise(function(resolve){
    names.forEach(function(name){
      probeOne(R_PROBES[name]).then(function(info){
        dbg('[DOOM-REMOTE] PROBE '+name+' '+(info.ok?'OK':'FAIL')+' ('+R_PROBES[name]+')'+(info.status?(' status='+info.status):'')+(info.via?(' via '+info.via):'')+(info.err?(' '+info.err):''));
        try{console.log('[DOOM-REMOTE] PROBE '+name+' '+(info.ok?'OK':'FAIL')+' ('+R_PROBES[name]+')')}catch(_){}
        if(!info.ok)failed.push(name);
        n+=1;
        if(n===names.length)resolve({ok:failed.length===0,failed:failed});
      });
    });
  });
}

function pad2(v){v=String(v);return v.length<2?'0'+v:v}
function dbg(msg){
  const dbgEl=document.getElementById('doomDbg');
  if(!dbgEl)return;
  try{
    if(msg&&typeof msg==='object'){msg=(msg.name?msg.name+': ':'')+(msg.message||String(msg))}
    const line=String(msg);
    if(dbgEl.childElementCount>200){dbgEl.textContent=''}
    const t=new Date();
    const stamp='['+pad2(t.getHours())+':'+pad2(t.getMinutes())+':'+pad2(t.getSeconds())+'] ';
    dbgEl.textContent+=stamp+line+'\\n';
    dbgEl.scrollTop=dbgEl.scrollHeight;
    if(!dbgEl.classList.contains('show'))dbgEl.classList.add('show');
  }catch(_){}
}
function setStatus(t,s){if(!doomStatus)return;doomStatus.textContent=t;doomStatus.setAttribute('data-state',s||'');dbg('status: '+t)}
dbg('[TEMP-DIAG] HTML carregado | readyState='+document.readyState+' | scripts='+document.scripts.length);
var __idbOK=false;try{__idbOK=!!window.indexedDB&&typeof window.indexedDB.open==='function'}catch(_){}
dbg('[TEMP-DIAG] IndexedDB: '+(__idbOK?'disponivel':'INDISPONIVEL/bloqueado'));
var __xhrSeq=0,__wd=0,__wl=0,__lastMsg='';
function sendKey(keyCode,down){const type=down?'keydown':'keyup';const ev=new KeyboardEvent(type,{keyCode:keyCode,which:keyCode,bubbles:true});Object.defineProperty(ev,'keyCode',{get:()=>keyCode});Object.defineProperty(ev,'which',{get:()=>keyCode});window.dispatchEvent(ev);document.dispatchEvent(ev)}
window.doomInputBridge=function(info,pressed){sendKey(info.keyCode,pressed)};
[['esc',27],['tab',9],['enter',13]].forEach(function(pair){const el=document.getElementById(pair[0]);if(!el)return;el.addEventListener('pointerdown',e=>{e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch{}sendKey(pair[1],true)});const up=e=>{e.preventDefault();sendKey(pair[1],false)};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('click',e=>{e.preventDefault();setTimeout(()=>sendKey(pair[1],false),80)})});

function fromB64(b64){let bin;try{bin=atob(b64)}catch(e){return null}const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++){u[i]=bin.charCodeAt(i)}return u}
if(__L.wasmB64){try{__L.wasmBytes=fromB64(__L.wasmB64);dbg('wdosbox.wasm embutido: '+((__L.wasmBytes&&__L.wasmBytes.length)||0)+' bytes')}catch(e){dbg('wasm decode falhou: '+((e&&e.message)||String(e)))}}
if(__L.bundleB64){try{__L.bundleBytes=fromB64(__L.bundleB64);dbg('bundle embutido: '+((__L.bundleBytes&&__L.bundleBytes.length)||0)+' bytes')}catch(e){dbg('bundle decode falhou: '+((e&&e.message)||String(e)))}}

window.addEventListener('error',function(e){dbg('global error: '+((e&&e.message)||String(e)))},true);
window.addEventListener('unhandledrejection',function(e){const r=e&&e.reason;dbg('promise rejection: '+((r&&r.message)?(r.name?r.name+': ':'')+r.message:String(r)))},true);
(function(){
  const oe=console.error,ow=console.warn;
  console.error=function(){const a=[].slice.call(arguments);try{dbg('console.error: '+a.map(function(x){try{return x&&x.message?(x.name?x.name+': ':'')+x.message:String(x)}catch(_){return String(x)}}).join(' | '))}catch(_){};oe.apply(console,arguments)};
  console.warn=function(){const a=[].slice.call(arguments);try{dbg('console.warn: '+a.map(function(x){try{return String(x)}catch(_){return String(x)}}).join(' | '))}catch(_){};ow.apply(console,arguments)};
})();

let wasmOK=false,wasmErr='';
try{
  if(typeof WebAssembly!=='object'||typeof WebAssembly.instantiate!=='function'||typeof WebAssembly.compile!=='function'){throw new Error('WebAssembly invalido neste WebView')}
  new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));
  wasmOK=true;
}catch(e){wasmErr=(e&&e.message)||String(e)}
dbg('WASM: '+(wasmOK?'disponivel':'FALHA - '+wasmErr));
(function(){
  var realCompile=WebAssembly.compile;
  if(typeof realCompile!=='function')return;
  WebAssembly.compile=function(mod){
    var sz=0;
    try{sz=(mod&&typeof mod.byteLength==='number')?mod.byteLength:(mod&&mod.buffer&&typeof mod.buffer.byteLength==='number')?mod.buffer.byteLength:0}catch(_){}
    dbg('[TEMP-DIAG] WebAssembly.compile(byteLength='+sz+')');
    try{
      return realCompile.call(WebAssembly,mod).then(function(m){dbg('[TEMP-DIAG] compile OK (byteLength='+sz+')');return m});
    }catch(e){dbg('[TEMP-DIAG] compile THROW: '+((e&&e.message)||String(e)));throw e}
  };
})();

let workerOK=false,workerErr='';
try{
  if(typeof Worker!=='function'||typeof Blob!=='function'||typeof URL!=='object'||typeof URL.createObjectURL!=='function'){throw new Error('Worker/Blob/URL indisponiveis')}
  const wProbe=new Worker(URL.createObjectURL(new Blob([''],{type:'text/javascript'})));
  wProbe.terminate();
  workerOK=true;
}catch(e){workerErr=(e&&e.message)||String(e)}
dbg('Worker: '+(workerOK?'disponivel':'FALHA - '+workerErr));
const emuFn=workerOK?'dosboxWorker':'dosboxDirect';
dbg('emulatorFunction: '+emuFn);

const OrigXHR=window.XMLHttpRequest;
if(__L.embedded&&OrigXHR&&(__L.wdosboxJs||__L.wasmBytes||__L.bundleBytes)){
  window.XMLHttpRequest=(function(){
    function Fake(){
      this._listeners={};
      this.readyState=0;this.status=0;this.statusText='';
      this.responseType='';this.response=null;this.responseText='';
      this.onreadystatechange=null;this.onerror=null;this.onload=null;this.onabort=null;this.onprogress=null;
      this.upload={addEventListener:function(){},removeEventListener:function(){}};
      this._url='';this._method='GET';this._sent=false;this._done=false;this._aborted=false;this._real=null;
    }
    Fake.prototype.addEventListener=function(t,cb){(this._listeners[t]=this._listeners[t]||[]).push(cb)};
    Fake.prototype.removeEventListener=function(t,cb){const a=this._listeners[t];if(!a)return;const i=a.indexOf(cb);if(i>=0)a.splice(i,1)};
    Fake.prototype._fire=function(t){
      const ev={type:t,target:this,currentTarget:this};
      if(t==='progress'){ev.total=this.total||0;ev.loaded=this.loaded||0;ev.lengthComputable=true}
      const h=this['on'+t];
      if(typeof h==='function'){try{h.call(this,ev)}catch(_){}}
      const a=this._listeners[t]||[];
      for(let i=0;i<a.length;i++){try{a[i].call(this,ev)}catch(_){}}
    };
    Fake.prototype.open=function(m,u){this._method=m||'GET';this._url=String(u||'');this.readyState=1};
    Fake.prototype.setRequestHeader=function(){};
    Fake.prototype.overrideMimeType=function(){};
    Fake.prototype.abort=function(){this._aborted=true;if(this._sent&&!this._done){this.readyState=4;this._fire('abort')}};
    Fake.prototype.send=function(){
      this._sent=true;
      const self=this;
      const url=self._url;
      const lower=String(url).toLowerCase().replace(/[?#].*$/,'');
      let localKind=null;
      if(__L.wasmBytes&&/wdosbox\\.wasm$/i.test(lower)){localKind='wasm'}
      else if(__L.wdosboxJs&&/wdosbox\\.js$/i.test(lower)){localKind='js'}
      else if(__L.bundleBytes&&/\\.jsdos$/i.test(lower)){localKind='bundle'}
      __xhrSeq+=1;
      dbg('[TEMP-DIAG] XHR#'+__xhrSeq+' '+url);
      if(localKind){
        dbg('[TEMP-DIAG] XHR local ['+localKind+']: '+url);
        setTimeout(function(){
          if(self._aborted)return;
          self.readyState=4;self.status=200;self.statusText='OK';self._done=true;
          if(localKind==='js'){self.responseText=__L.wdosboxJs;self.response=__L.wdosboxJs}
          else{
            const u=localKind==='wasm'?__L.wasmBytes:__L.bundleBytes;
            try{self.response=u.buffer.slice(u.byteOffset,u.byteOffset+u.byteLength)}catch(_){self.response=u}
          }
          self.total=1;self.loaded=1;
          dbg('[TEMP-DIAG] XHR local ok ['+localKind+'] -> '+(typeof self.response==='string'?self.response.length:(self.response&&self.response.byteLength?self.response.byteLength:0))+'B');
          self._fire('progress');
          self._fire('readystatechange');
          self._fire('load');
        },0);
        return;
      }
      dbg('[TEMP-DIAG] XHR remoto (nao embutido): '+url);
      dbg('XHR remoto: '+url);
      try{
        const real=new OrigXHR();
        self._real=real;
        real.open(self._method||'GET',url,true);
        if(self.responseType){try{real.responseType=self.responseType}catch(_){}}
        real.onreadystatechange=function(){
          self.readyState=real.readyState;self.status=real.status;self.statusText=real.statusText;
          if(real.readyState===4){self.response=real.response;self.responseText=real.responseText;self._done=true;dbg('[TEMP-DIAG] XHR remoto readyState=4 status='+real.status+' ('+url+')')}
          self._fire('readystatechange');
        };
        real.onerror=function(){dbg('[TEMP-DIAG] XHR remoto ERRO '+url);self._fire('error')};
        real.onabort=function(){dbg('[TEMP-DIAG] XHR remoto ABORT '+url);self._fire('abort')};
        real.onprogress=function(e){self.total=e.total;self.loaded=e.loaded;self._fire('progress')};
        real.send(null);
      }catch(e){dbg('[TEMP-DIAG] XHR remoto EXCECAO: '+((e&&e.message)||String(e))+url);dbg('XHR remoto falhou: '+((e&&e.message)||String(e)));self._fire('error')}
    };
    return Fake;
  })();
}

const OrigWorker=window.Worker;
if(__L.embedded&&typeof OrigWorker==='function'&&__L.wdosboxJs){
  window.Worker=function(url,opts){
    const u=String(url||'');
    if(/wdosbox\\.js(?:[?#].*)?$/i.test(u)){
      dbg('Worker local: wdosbox.js via Blob');
      try{
        const blob=new Blob([__L.wdosboxJs],{type:'text/javascript'});
        const w=new OrigWorker(URL.createObjectURL(blob),opts);
        dbg('[TEMP-DIAG] worker blob criado (glue '+__L.wdosboxJs.length+'B)');
        w.addEventListener('error',function(e){dbg('[TEMP-DIAG] WORKER ERROR: '+((e&&e.message)||'erro'))});
        return w;
      }catch(e){dbg('Worker blob FALHOU: '+((e&&e.message)||String(e)))}
    }
    dbg('Worker remoto: '+u);
    return new OrigWorker(url,opts);
  };
  window.Worker.prototype=OrigWorker.prototype;
}

const OrigFetch=window.fetch;
if(__L.embedded&&typeof OrigFetch==='function'){
  window.fetch=function(u){dbg('fetch: '+String(u));return OrigFetch.apply(window,arguments)};
}

let finished=false;
var __runResolved=false,__canvasSeen=false,__gameMark=false;
function startDoom(){
  mrk('JS_DOS_LOADING');
  setStatus('Iniciando DOOM...','');
  if(typeof Dos==='undefined'){setStatus('js-dos nao carregou','error');dbg('ERRO: global Dos ausente - js-dos.js nao executou?');return}
  mrk('JS_DOS_LOADED');
  try{
    window.emulators=window.emulators||{};
    window.emulators.pathPrefix='${DOOM_WASM_PREFIX}';
    dbg('pathPrefix='+window.emulators.pathPrefix+' | modo='+(__L.embedded?'EMBUTIDO':'REMOTO')+' | bundle='+__L.bundleUrl);
    setStatus('Verificando rede e trusted_sources...','');
    runNetCheck().then(function(res){
      dbg('[DOOM-REMOTE] NETCHECK '+(res.ok?'OK':'FAIL')+(res.failed.length?(' -> '+res.failed.join(',')):''));
      if(!res.ok){
        setStatus('Rede/trusted_sources impediram: '+res.failed.join(','),'error');
        dbg('[DOOM-REMOTE] Jogo NAO iniciado de proposito (falha de rede/trusted_sources). Markers D-H nao aplicaveis ainda.');
        return;
      }
      bootDoom();
    });
  }catch(e){setStatus('Erro: '+((e&&e.message)||String(e)),'error');dbg('Erro sincrono: '+((e&&e.message)||String(e)))}
}
function bootDoom(){
  const t0=Date.now();
  var pollN=0,wdOK=0;
  var poll=setInterval(function(){
    if(++pollN>360){clearInterval(poll);return}
    if(typeof window.WDOSBOX==='function'){if(!wdOK){wdOK=1;__netMark('WDOSBOX','OK','script carregou (window.WDOSBOX)')}}
    var lm=document.querySelector('.emulator-js-loading-message, .loading-message, .jsdos-loading, .loading-label');
    if(lm&&lm.textContent){var tt=String(lm.textContent).trim();if(tt&&tt!==__lastMsg){__lastMsg=tt;dbg('js-dos msg: '+tt)}}
    if(__workerStart&&!__workerErr){
      if(Date.now()-__workerStart>1000&&!__sawWasmReq){__sawWasmReq=true;mrk('WASM_REQUEST');dbg('WASM_REQUEST (inferido: dentro do Worker, nao visivel da thread principal)')}
      if(Date.now()-__workerStart>5000&&!__sawWasmOk){__sawWasmOk=true;mrk('WASM_OK');dbg('WASM_OK (inferido: Worker vivo 5s sem erro de rede)')}
    }
    var cv=document.querySelector('#dosbox canvas');
    if(cv){
      if(!__canvasSeen){__canvasSeen=true;mrk('CANVAS_READY');dbg('canvas em #dosbox: '+cv.width+'x'+cv.height)}
      if(cv.width>0&&cv.height>0&&!__gameMark&&!__runResolved){__gameMark=true;mrk('GAME_STARTED');dbg('canvas com tamanho real (jogo renderizando)')}
    }
    if(__runResolved&&!__gameMark){__gameMark=true;mrk('GAME_STARTED');dbg('run() resolveu (sessao de jogo ativa)')}
  },250);
  const watchdog=setTimeout(function(){
    if(!finished){finished=true;clearInterval(poll);setStatus('Timeout '+Math.round((Date.now()-t0)/1000)+'s (rede/wasm?)','error');dbg('[DOOM-REMOTE] TIMEOUT em '+((Date.now()-t0)/1000).toFixed(1)+'s (90s sem progresso)')}
  },90000);
  try{
    setStatus('Criando Dos()...','');
    const __di=Dos(dosbox,{emulatorFunction:emuFn});
    mrk('DOS_CREATED');
    setStatus('Baixando o jogo...','');
    mrk('DOS_RUN');
    __di.run(__L.bundleUrl).then(function(){
      __runResolved=true;
      if(!finished){finished=true;clearTimeout(watchdog);clearInterval(poll);setStatus('DOOM pronto','ready');dbg('DOOM inicializado em '+((Date.now()-t0)/1000).toFixed(1)+'s')}
      mrk('GAME_STARTED');
    }).catch(function(e){
      if(!finished){finished=true;clearTimeout(watchdog);clearInterval(poll)}
      const msg=(e&&e.name?e.name+': ':'')+(e&&e.message?e.message:String(e));
      setStatus('Erro: '+msg,'error');
      dbg('[DOOM-REMOTE] FALHA em run(): '+msg);
      if(e&&e.stack){try{dbg('stack: '+String(e.stack).split('\\n').slice(0,5).join(' ~ '))}catch(_){}}
      if(/network|download|fetch|xhr|cors/i.test(String(e&&e.message))){dbg('[DOOM-REMOTE] Dica: rede externa/trusted_sources podem estar bloqueando os CDNs')}
    });
  }catch(e){setStatus('Erro: '+((e&&e.message)||String(e)),'error');dbg('Erro sincrono: '+((e&&e.message)||String(e)))}
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',startDoom)}else{startDoom()}
dbg('[TEMP-DIAG] fim do script bridge');`;
}

function buildDoomPlayerHtml(bundleUrl = '', opts) {
  const options = opts || {};
  const bundle = /^https:\/\/\S+\.jsdos(?:[?#].*)?$/.test(String(bundleUrl || '').trim()) ? String(bundleUrl).trim() : DOOM_BUNDLE_URL;
  const bridge = buildDoomPlayerBridge(bundle, options);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><style>${JSDOS_CSS}
${buildDoomOrientationCss()}
${buildDoomDiagnosticCss()}</style></head><body><main class="doom-app">
<div class="doom-status" id="doomStatus" data-state="">Carregando DOOM...</div>
<section class="stage" aria-label="Jogo"><div id="dosbox"></div></section>
${buildDoomPlayerControlsHtml()}
<div class="system">
  <button type="button" class="sys" id="fullscreenBtn">TELA CHEIA</button>
  <button type="button" class="sys" id="landscapeBtn">PAISAGEM</button>
  <button type="button" class="sys" id="esc">ESC</button>
  <button type="button" class="sys" id="tab">TAB</button>
  <button type="button" class="sys" id="enter">ENTER</button>
</div>
<div class="doom-diagnostics"><div class="doom-diag" id="doomDiag"></div><div class="doom-dbg" id="doomDbg"></div></div>
</main><script>${JSDOS_JS}
</script>
<script>${buildDoomOrientationScript()}</script>
${buildDoomInputScript(bridge)}</body></html>`;
}

function normalizeDoomBundleUrl(bundleUrl = '') {
  const trimmed = String(bundleUrl || '').trim();
  if (!trimmed) return '';
  if (!/^https:\/\//i.test(trimmed)) return '';
  if (!/\.jsdos(?:[?#].*)?$/i.test(trimmed) && !/\.zip(?:[?#].*)?$/i.test(trimmed)) return '';
  return trimmed;
}

async function sendDoomRichHtml(sock, jid, label, html, trustedSources = []) {
  if (!sock?.relayMessage) throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  const richContent = buildAIRichMessageContent(html, { label, trustedSources });
  const check = checkAirichPayloadWithinLimit(html, richContent);
  if (!check.ok) {
    console.log(`[${label}] htmlBytes=${check.metrics.htmlBytes}`);
    console.log(`[${label}] base64Bytes=${check.metrics.base64Bytes}`);
    console.log(`[${label}] jsonBytes=${check.metrics.jsonBytes}`);
    console.log(`[${label}] unifiedResponseBytes=${check.metrics.unifiedResponseBytes}`);
    console.log(`[DOOM] Payload bloqueado por limite AIRich: unifiedResponseBytes (${check.metrics.unifiedResponseBytes}) > AIRICH_SAFE_MAX_BYTES (${check.limitBytes}). Nenhum relayMessage enviado (sem retry, sem queda de socket, sem remoÃ§Ã£o de sessÃ£o).`);
    return {
      ok: false,
      blocked: 'size_limit',
      reason: `unifiedResponseBytes (${check.metrics.unifiedResponseBytes}) > AIRICH_SAFE_MAX_BYTES (${check.limitBytes})`,
      limitBytes: check.limitBytes,
      metrics: check.metrics,
      relayResult: 'BLOCKED'
    };
  }
  logAirichPayloadStats(label.toLowerCase().replace(/\s+/g, ''), html, richContent);
  console.log(`[${label}] Enviando botForwardedMessage.richResponseMessage...`);
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

function sendDoomInputTest(sock, jid) {
  return sendDoomRichHtml(sock, jid, 'DOOM Input Test', buildDoomTestHtml());
}

function sendDoomExperimental(sock, jid, bundleUrl = '', opts) {
  const remoteOpts = { embedWdosbox: false, embedBundle: false, ...(opts || {}) };
  const url = bundleUrl ? String(bundleUrl).trim() : DOOM_BUNDLE_URL;
  const html = buildDoomPlayerHtml(url, remoteOpts);
  const trustedSources = remoteOpts.embedWdosbox || remoteOpts.embedBundle ? [] : [...DOOM_TRUSTED_SOURCES];
  return sendDoomRichHtml(sock, jid, 'DOOM', html, trustedSources);
}

export { DOOM_BUNDLE_URL, DOOM_INPUTS, DOOM_TRUSTED_SOURCES, DOOM_WASM_PREFIX, buildDoomPlayerHtml, buildDoomTestHtml, normalizeDoomBundleUrl, sendDoomExperimental, sendDoomInputTest };

const buildDoomExperimentalHtml = buildDoomPlayerHtml;
export { buildDoomExperimentalHtml };