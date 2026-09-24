function buildDoomOrientationCss() {
  return `
html,body{margin:0;width:100%;height:100%;background:#0d1116;color:#fff;font-family:Arial,sans-serif;overscroll-behavior:none;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
*{box-sizing:border-box}
:root{--doom-btn:56px;--doom-rail:200px}
.doom-app{position:relative;width:100%;height:100%;overflow:hidden;padding:calc(env(safe-area-inset-top,0px) + 2px) calc(env(safe-area-inset-right,0px) + 2px) calc(env(safe-area-inset-bottom,0px) + 2px) calc(env(safe-area-inset-left,0px) + 2px);background:radial-gradient(ellipse at 50% 36%,#1b242e 0%,#0c1015 80%)}
@supports (height:100dvh){.doom-app{height:100dvh}}
.doom-status{position:absolute;top:calc(env(safe-area-inset-top,0px) + 4px);left:50%;transform:translateX(-50%);z-index:20;background:rgba(8,12,16,0.74);color:#eaf6ff;padding:5px 16px;border-radius:999px;font-size:12px;letter-spacing:0.3px;white-space:nowrap}
.doom-status[data-state="error"]{color:#ffb3ab;background:rgba(60,20,16,0.82)}
.doom-status[data-state="ready"]{color:#b7f0c0}
html.doom-landscape .doom-app{display:grid;grid-template-columns:var(--doom-rail) minmax(0,1fr) var(--doom-rail);grid-template-areas:"dpad stage actions";gap:clamp(2px,1vmin,10px);align-items:center;justify-items:center}
html.doom-portrait .doom-app{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"stage stage" "dpad actions";gap:8px;align-items:center}
.stage{position:relative;width:100%;height:100%;min-height:0;grid-area:stage;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#000;box-shadow:0 0 0 1px rgba(120,160,190,0.18),0 8px 22px rgba(0,0,0,0.5)}
#dosbox{position:relative;width:100%;height:100%;image-rendering:pixelated;object-fit:contain}
.dpad{grid-area:dpad;display:grid;grid-template-columns:repeat(3,var(--doom-btn));grid-template-rows:repeat(3,var(--doom-btn));gap:calc(var(--doom-btn) * 0.14);justify-items:center;align-items:center}
.actions{grid-area:actions;display:grid;grid-template-columns:repeat(3,var(--doom-btn));grid-auto-rows:var(--doom-btn);gap:calc(var(--doom-btn) * 0.14);justify-items:center;align-items:center}
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
.system{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 4px);transform:translateX(-50%);z-index:5;display:flex;gap:8px;align-items:center}
.system button{background:rgba(42,60,74,0.85);color:#cfe1ec}
.hidden{display:none}`;
}

function buildDoomOrientationScript() {
  return `(function () {
var root=document.documentElement;
function orientation(){
  if(window.matchMedia&&window.matchMedia('(orientation: landscape)').matches)return 'landscape';
  return (window.innerHeight>=window.innerWidth)?'portrait':'landscape';
}
function apply(){
  var o=orientation();
  var vw=window.innerWidth||0,vh=window.innerHeight||0;
  root.classList.toggle('doom-landscape',o==='landscape');
  root.classList.toggle('doom-portrait',o!=='landscape');
  var btn;
  if(o==='landscape'){
    btn=Math.max(44,Math.min(Math.round(vh*0.17),Math.round(vw*0.09)));
    root.style.setProperty('--doom-rail',Math.round(Math.min(vw*0.24,vh*0.92))+'px');
  }else{
    btn=Math.max(44,Math.min(Math.round(vw*0.14),62));
    root.style.setProperty('--doom-rail','auto');
  }
  root.style.setProperty('--doom-btn',btn+'px');
  root.style.setProperty('--doom-vh',vh+'px');
  root.style.setProperty('--doom-vw',vw+'px');
}
function bind(){
  apply();
  var tick=function(){if(window.requestAnimationFrame){window.requestAnimationFrame(apply)}else{apply()}};
  window.addEventListener('resize',tick);
  window.addEventListener('orientationchange',function(){setTimeout(apply,120)});
  if(window.visualViewport&&window.visualViewport.addEventListener){
    window.visualViewport.addEventListener('resize',tick);
    window.visualViewport.addEventListener('scroll',tick);
  }
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',bind)}else{bind()}
}());`;
}

export { buildDoomOrientationCss, buildDoomOrientationScript };