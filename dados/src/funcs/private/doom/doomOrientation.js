function buildDoomOrientationCss() {
  return `
html,body{margin:0;width:100%;height:100%;background:#0d1116;color:#fff;font-family:Arial,sans-serif;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;overflow:hidden}
*{box-sizing:border-box}
:root{--doom-btn:clamp(40px,11vmin,56px);--doom-rail:clamp(116px,24vmin,180px);--doom-cvw:100vw;--doom-cvh:100vh;--doom-gap:clamp(3px,1.2vmin,10px)}
.doom-app{position:relative;width:var(--doom-cvw,100vw);height:var(--doom-cvh,100vh);overflow:hidden;padding:calc(env(safe-area-inset-top,0px) + 2px) calc(env(safe-area-inset-right,0px) + 2px) calc(env(safe-area-inset-bottom,0px) + 2px) calc(env(safe-area-inset-left,0px) + 2px);background:radial-gradient(ellipse at 50% 30%,#1b242e 0%,#0c1015 80%)}
.doom-app{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) auto auto;grid-template-areas:"stage stage" "dpad actions" "sys sys";gap:var(--doom-gap);align-items:center;justify-items:center}
html.doom-landscape .doom-app{grid-template-columns:var(--doom-rail) minmax(0,1fr) var(--doom-rail);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"dpad stage actions" "sys sys sys";gap:var(--doom-gap);align-items:center;justify-items:center}
@media (min-aspect-ratio:1/1){.doom-app{grid-template-columns:var(--doom-rail) minmax(0,1fr) var(--doom-rail);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"dpad stage actions" "sys sys sys";gap:var(--doom-gap);align-items:center;justify-items:center}}
.doom-status{position:absolute;top:calc(env(safe-area-inset-top,0px) + 4px);left:50%;transform:translateX(-50%);z-index:20;background:rgba(8,12,16,0.74);color:#eaf6ff;padding:5px 16px;border-radius:999px;font-size:12px;letter-spacing:0.3px;white-space:nowrap}
.doom-status[data-state="error"]{color:#ffb3ab;background:rgba(60,20,16,0.82)}
.doom-status[data-state="ready"]{color:#b7f0c0}
.stage{position:relative;width:100%;height:100%;min-width:0;min-height:0;grid-area:stage;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#000;box-shadow:0 0 0 1px rgba(120,160,190,0.18),0 8px 22px rgba(0,0,0,0.5)}
#dosbox{position:relative;width:100%;height:100%;min-width:0;min-height:0;image-rendering:pixelated}
.dpad{grid-area:dpad;display:grid;grid-template-columns:repeat(3,var(--doom-btn));grid-template-rows:repeat(3,var(--doom-btn));gap:var(--doom-gap);justify-items:center;align-items:center;max-width:100%}
.actions{grid-area:actions;display:grid;grid-template-columns:repeat(3,var(--doom-btn));grid-auto-rows:var(--doom-btn);gap:var(--doom-gap);justify-items:center;align-items:center;max-width:100%}
button{border:0;width:var(--doom-btn);height:var(--doom-btn);border-radius:clamp(8px,var(--doom-btn) * 0.22,14px);background:linear-gradient(180deg,#f2b90a,#d99a05);color:#161a14;font-weight:800;font-size:clamp(12px,var(--doom-btn) * 0.32,17px);touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:0 3px 0 rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.35);line-height:1}
button.pressed,button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,0.35);background:linear-gradient(180deg,#ff5a3c,#d93a28);color:#fff}
button.sys{width:auto;min-width:calc(var(--doom-btn) * 0.8);height:calc(var(--doom-btn) * 0.62);font-size:clamp(10px,var(--doom-btn) * 0.22,13px);padding:0 10px}
[data-input="strafeLeft"],[data-input="strafeRight"]{background:#2f4b5e;color:#dbeaf2}
[data-input="fire"]{background:#c2333a;color:#fff}
[data-input="up"]{grid-column:2;grid-row:1}
[data-input="left"]{grid-column:1;grid-row:2}
[data-input="down"]{grid-column:2;grid-row:3}
[data-input="right"]{grid-column:3;grid-row:2}
.pad-center{grid-column:2;grid-row:2;width:clamp(10px,var(--doom-btn) * 0.5,22px);height:clamp(10px,var(--doom-btn) * 0.5,22px);border-radius:50%;background:rgba(255,255,255,0.14)}
[data-input="strafeLeft"]{grid-column:1;grid-row:1}
[data-input="weapon1"]{grid-column:2;grid-row:1}
[data-input="weapon2"]{grid-column:3;grid-row:1}
[data-input="weapon3"]{grid-column:1;grid-row:2}
[data-input="weapon4"]{grid-column:2;grid-row:2}
[data-input="weapon5"]{grid-column:3;grid-row:2}
[data-input="strafeRight"]{grid-column:1;grid-row:3}
[data-input="weapon6"]{grid-column:2;grid-row:3}
[data-input="weapon7"]{grid-column:3;grid-row:3}
[data-input="fire"]{grid-column:1;grid-row:4}
[data-input="run"]{grid-column:2;grid-row:4}
[data-input="use"]{grid-column:3;grid-row:4}
.system{grid-area:sys;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px;z-index:5;padding:2px 0}
.system button{background:rgba(42,60,74,0.85);color:#cfe1ec}
.hidden{display:none}`;
}

function buildDoomOrientationScript() {
  return `(function () {
var root=document.documentElement;
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function measure(){
  var vw=window.innerWidth||root.clientWidth||320;
  var vh=window.innerHeight||root.clientHeight||480;
  if(window.visualViewport){
    var vv=window.visualViewport;
    if(vv.width&&vv.width>0)vw=Math.min(vw,vv.width);
    if(vv.height&&vv.height>0)vh=Math.min(vh,vv.height);
  }
  var r=root.getBoundingClientRect();
  if(r.width>0)vw=Math.min(vw,r.width);
  if(r.height>0)vh=Math.min(vh,r.height);
  return {vw:Math.round(vw),vh:Math.round(vh)};
}
function apply(){
  var m=measure();
  if(!m.vw||!m.vh)return;
  var landscape=m.vw>m.vh;
  root.classList.toggle('doom-landscape',landscape);
  root.classList.toggle('doom-portrait',!landscape);
  root.style.setProperty('--doom-cvw',m.vw+'px');
  root.style.setProperty('--doom-cvh',m.vh+'px');
  var btn;
  if(landscape){
    btn=clamp(Math.min(Math.round(m.vh*0.16),Math.round(m.vw*0.075)),40,64);
    var railMin=Math.round(3.28*btn);
    var rail=clamp(Math.round(Math.min(m.vw*0.28,m.vh*0.9)),railMin,Math.round(m.vw*0.34));
    root.style.setProperty('--doom-rail',rail+'px');
  }else{
    btn=clamp(Math.round(m.vw*0.14),40,56);
    var hMax=Math.round((m.vh*0.50-32)/4.62);
    var wMax=Math.round((m.vw*0.50-16)/3);
    var bMax=Math.min(hMax,wMax);
    if(btn>bMax)btn=clamp(Math.max(32,bMax),36,56);
    root.style.setProperty('--doom-rail','auto');
  }
  root.style.setProperty('--doom-btn',btn+'px');
}
var already=false;
function schedule(){
  if(already)return;already=true;
  apply();
  window.addEventListener('resize',apply);
  window.addEventListener('orientationchange',function(){setTimeout(apply,150)});
  if(window.visualViewport&&window.visualViewport.addEventListener){
    window.visualViewport.addEventListener('resize',apply);
    window.visualViewport.addEventListener('scroll',apply);
  }
  setInterval(apply,600);
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',schedule)}else{schedule()}
}());`;
}

export { buildDoomOrientationCss, buildDoomOrientationScript };