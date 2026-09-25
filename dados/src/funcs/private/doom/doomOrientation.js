function buildDoomOrientationCss() {
  return `
html,body{margin:0;min-height:100%;background:#101820;color:#fff;font-family:Arial,sans-serif;overscroll-behavior:none;touch-action:pan-y;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
*{box-sizing:border-box}
.doom-app{max-width:920px;margin:0 auto;min-height:560px;padding:10px;display:grid;gap:8px;align-content:start;grid-template-columns:1fr 1fr;grid-template-areas:"status status" "stage stage" "dpad actions" "sys sys" "diag diag"}
.doom-status{grid-area:status;justify-self:center;min-height:26px;display:grid;place-items:center;padding:4px 16px;border-radius:999px;background:#1d303b;color:#dbeaf2;font-size:12px;letter-spacing:0.3px;text-align:center}
.doom-status[data-state="error"]{background:#3c1410;color:#ffb3ab}
.doom-status[data-state="ready"]{background:#0f2f1a;color:#b7f0c0}
.stage{grid-area:stage;display:grid;place-items:center;min-height:190px;border:2px solid #3b5361;border-radius:8px;background:#05080b;overflow:hidden}
#dosbox{width:min(100%,520px);aspect-ratio:16/10;max-height:420px;min-height:200px;background:#000}
.dpad{grid-area:dpad;display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:5px;justify-content:center;align-content:center}
.actions{grid-area:actions;display:grid;grid-template-columns:repeat(3,minmax(54px,1fr));gap:5px;align-content:center}
button{border:0;border-radius:7px;min-height:40px;padding:0 8px;background:#ffcb05;color:#161a14;font-weight:800;font-size:14px;line-height:1;touch-action:none;user-select:none;-webkit-tap-highlight-color:transparent;box-shadow:0 3px 0 rgba(0,0,0,0.35),inset 0 1px 0 rgba(255,255,255,0.35)}
button.pressed,button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,0.35);background:#e8552d;color:#fff}
button.sys{min-height:34px;font-size:12px;padding:0 10px;background:#2f4b5e;color:#cfe1ec}
[data-input="strafeLeft"],[data-input="strafeRight"]{background:#2f4b5e;color:#dbeaf2}
[data-input="fire"]{background:#c2333a;color:#fff}
[data-input="up"]{grid-column:2;grid-row:1}
[data-input="left"]{grid-column:1;grid-row:2}
[data-input="down"]{grid-column:2;grid-row:3}
[data-input="right"]{grid-column:3;grid-row:2}
.pad-center{grid-column:2;grid-row:2;width:18px;height:18px;border-radius:50%;background:rgba(255,255,255,0.14)}
.system{grid-area:sys;display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:8px;padding:2px 0}
.doom-diag{grid-area:diag;text-align:center;color:#7d93a0;font-size:11px;min-height:14px}
html.doom-landscape .doom-app{grid-template-columns:minmax(128px,1fr) minmax(260px,2.2fr) minmax(128px,1fr);grid-template-areas:"status status status" "dpad stage actions" "sys stage diag"}
@media (orientation:landscape){
  .doom-app{grid-template-columns:minmax(128px,1fr) minmax(260px,2.2fr) minmax(128px,1fr);grid-template-areas:"status status status" "dpad stage actions" "sys stage diag"}
  .actions{grid-template-columns:1fr 1fr}
}
html.expanded .doom-app{min-height:880px}
html.expanded .stage{min-height:300px}
html.expanded #dosbox{max-height:600px}`;
}

function buildDoomOrientationScript() {
  return `(function () {
var root=document.documentElement;
function readDims(){
  try{
    var cw=root.clientWidth||0;
    var ch=root.clientHeight||0;
    var landscape=!!(window.matchMedia&&window.matchMedia('(orientation: landscape)').matches)||(cw>ch&&cw>0);
    root.classList.toggle('doom-landscape',landscape);
    var diag=document.getElementById('doomDiag');
    if(diag)diag.textContent=viewportText(cw,ch,landscape);
  }catch(e){}
}
function viewportText(cw,ch,landscape){
  var base=cw+'x'+ch;
  if(window.visualViewport){var vv=window.visualViewport;base+=' vv:'+Math.round(vv.width)+'x'+Math.round(vv.height)}
  return 'view:'+base+' '+(landscape?'paisagem':'retrato');
}
var started=false;
function schedule(){
  if(started)return;started=true;
  readDims();
  window.addEventListener('resize',readDims);
  window.addEventListener('orientationchange',function(){setTimeout(readDims,150)});
  if(window.visualViewport&&window.visualViewport.addEventListener){window.visualViewport.addEventListener('resize',readDims)}
  setInterval(readDims,700);
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',schedule)}else{schedule()}
}());`;
}

export { buildDoomOrientationCss, buildDoomOrientationScript };