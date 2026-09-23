import { readFileSync } from 'fs';
import { buildAIRichMessageContent, createId, logAirichPayloadStats } from '../airich/sendAIRichHtml.js';

const GBAJS_ROOT = new URL('./vendor/gbajs/', import.meta.url);
const GBAJS_FILES = [
  'js/util.js',
  'js/core.js',
  'js/arm.js',
  'js/thumb.js',
  'js/mmu.js',
  'js/io.js',
  'js/audio.js',
  'js/video.js',
  'js/video/software.js',
  'js/irq.js',
  'js/keypad.js',
  'js/sio.js',
  'js/savedata.js',
  'js/gpio.js',
  'js/gba.js'
];

function readLocalAsset(relativePath) {
  return readFileSync(new URL(relativePath, GBAJS_ROOT), 'utf8')
    .replace(/<\/script/gi, '<\\/script');
}

const GBAJS_SOURCE = GBAJS_FILES.map(readLocalAsset).join('\n');
const BIOS_BASE64 = readFileSync(new URL('resources/bios.bin', GBAJS_ROOT)).toString('base64');

function writeWord(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

// ROM livre de demonstracao: repinta continuamente o framebuffer em cores rotativas.
// O codigo ARM abaixo foi escrito para este teste; nao inclui BIOS, assets ou ROM comercial.
function buildGbaTestRom() {
  const rom = new Uint8Array(0x140);
  const title = 'NAZUNA GBA TEST';
  for (let index = 0; index < title.length; index += 1) {
    rom[0xa0 + index] = title.charCodeAt(index);
  }

  rom[0xac] = 0x4e; // game code: NZNA
  rom[0xad] = 0x5a;
  rom[0xae] = 0x4e;
  rom[0xaf] = 0x41;
  rom[0xb2] = 0x96; // Assinatura minima exigida pelo carregador do GBA.js.

  writeWord(rom, 0x00, 0xea00002e); // branch para 0x080000c0

  writeWord(rom, 0xc0, 0xe59f0044); // ldr r0, display control
  writeWord(rom, 0xc4, 0xe59f1044); // ldr r1, mode 3 + BG2
  writeWord(rom, 0xc8, 0xe1c010b0); // strh r1, [r0]
  writeWord(rom, 0xcc, 0xe59f0040); // ldr r0, VRAM
  writeWord(rom, 0xd0, 0xe59f1040); // ldr r1, cor inicial (dois pixels)
  writeWord(rom, 0xd4, 0xe59f2040); // ldr r2, 19200 palavras
  writeWord(rom, 0xd8, 0xe4801004); // str r1, [r0], #4
  writeWord(rom, 0xdc, 0xe2522001); // subs r2, r2, #1
  writeWord(rom, 0xe0, 0x1afffffc); // bne 0x080000d8
  writeWord(rom, 0xe4, 0xe1a010e1); // mov r1, r1, ror #1: proxima cor
  writeWord(rom, 0xe8, 0xe59f0024); // ldr r0, VRAM
  writeWord(rom, 0xec, 0xe59f2028); // ldr r2, 19200 palavras
  writeWord(rom, 0xf0, 0xe4801004); // str r1, [r0], #4
  writeWord(rom, 0xf4, 0xe2522001); // subs r2, r2, #1
  writeWord(rom, 0xf8, 0x1afffffc); // bne 0x080000f0
  writeWord(rom, 0xfc, 0xe59f201c); // ldr r2, atraso visivel
  writeWord(rom, 0x100, 0xe2522001); // subs r2, r2, #1
  writeWord(rom, 0x104, 0x1afffffd); // bne 0x08000100
  writeWord(rom, 0x108, 0xeafffff5); // b 0x080000e4
  writeWord(rom, 0x10c, 0x04000000);
  writeWord(rom, 0x110, 0x00000403);
  writeWord(rom, 0x114, 0x06000000);
  writeWord(rom, 0x118, 0x7c007c00);
  writeWord(rom, 0x11c, 19200);
  writeWord(rom, 0x120, 0x00010000);
  return rom;
}

const TEST_ROM_BASE64 = Buffer.from(buildGbaTestRom()).toString('base64');

function buildGbaTestHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body { margin: 0; min-height: 100%; background: #101820; color: #ffffff; font-family: Arial, sans-serif; overscroll-behavior: none; touch-action: none; }
    * { box-sizing: border-box; }
    .app { min-height: 590px; padding: 10px; display: grid; gap: 8px; align-content: start; text-align: center; }
    h2 { margin: 0; font-size: 20px; }
    .stage { display: grid; place-items: center; min-height: 172px; border: 2px solid #4c6a7a; border-radius: 8px; background: #05080b; overflow: hidden; }
    #gbaScreen { display: block; width: min(100%, 360px); aspect-ratio: 3 / 2; max-height: 44vh; border: 0; background: #000000; image-rendering: pixelated; object-fit: contain; }
    .statusGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; color: #b9d5e2; font-size: 12px; }
    .statusGrid span { min-height: 28px; display: grid; place-items: center; padding: 5px; border-radius: 6px; background: #1d303b; }
    button { border: 0; border-radius: 7px; min-height: 38px; padding: 0 10px; background: #ffcb05; color: #1f2937; font-size: 14px; font-weight: 700; touch-action: none; user-select: none; }
    button.pressed, button:active { background: #d34d75; color: #fff; transform: translateY(1px); }
    .controls { display: grid; grid-template-areas: "dpad face" "shoulders shoulders" "system system"; grid-template-columns: 1fr 1fr; gap: 8px; }
    .dpad { grid-area: dpad; display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(3, 38px); gap: 4px; justify-content: center; }
    .face { grid-area: face; display: grid; grid-template-columns: repeat(2, 58px); grid-template-rows: repeat(2, 42px); gap: 6px; justify-content: center; align-content: center; }
    .shoulders { grid-area: shoulders; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .system { grid-area: system; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    [data-key="UP"] { grid-column: 2; grid-row: 1; }
    [data-key="LEFT"] { grid-column: 1; grid-row: 2; }
    [data-key="DOWN"] { grid-column: 2; grid-row: 2; }
    [data-key="RIGHT"] { grid-column: 3; grid-row: 2; }
    [data-key="A"] { grid-column: 2; grid-row: 1; background: #d34d75; color: #fff; }
    [data-key="B"] { grid-column: 1; grid-row: 2; background: #d34d75; color: #fff; }
    .credit { margin: 0; color: #a7bdc8; font-size: 11px; }
    .expanded .app { min-height: 760px; }
    .expanded .stage { min-height: 270px; }
    .expanded #gbaScreen { max-height: 60vh; }
    @media (orientation: landscape) {
      .app { min-height: 360px; grid-template-columns: minmax(128px, 1fr) minmax(260px, 2.2fr) minmax(128px, 1fr); grid-template-areas: "title title title" "left stage right" "info stage right" "credit credit credit"; align-items: center; }
      h2 { grid-area: title; }
      .stage { grid-area: stage; min-height: 226px; }
      #gbaScreen { max-height: 72vh; width: min(100%, 540px); }
      .statusGrid { grid-area: info; grid-template-columns: 1fr; align-self: start; }
      .controls { display: contents; }
      .dpad { grid-area: left; }
      .face { grid-area: right; align-self: center; }
      .shoulders { grid-area: right; align-self: start; grid-template-columns: 1fr 1fr; }
      .system { grid-area: right; align-self: end; grid-template-columns: 1fr; }
      .credit { grid-area: credit; }
    }
    @media (orientation: portrait) {
      .app { min-height: 590px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <h2>GBA Test - ROM livre</h2>
    <section class="stage"><canvas id="gbaScreen" width="240" height="160" aria-label="Tela Game Boy Advance"></canvas></section>
    <section class="statusGrid">
      <span>Estado: <b id="status">carregado</b></span>
      <span>FPS: <b id="fps">0</b></span>
      <span>Ultimo botao: <b id="lastButton">none</b></span>
      <span>Orientacao: <b id="orientationLabel">auto</b></span>
    </section>
    <section class="controls" aria-label="Controles virtuais GBA">
      <div class="dpad">
        <button type="button" data-key="UP">UP</button>
        <button type="button" data-key="LEFT">LEFT</button>
        <button type="button" data-key="DOWN">DOWN</button>
        <button type="button" data-key="RIGHT">RIGHT</button>
      </div>
      <div class="face">
        <button type="button" data-key="A">A</button>
        <button type="button" data-key="B">B</button>
      </div>
      <div class="shoulders">
        <button type="button" data-key="L">L</button>
        <button type="button" data-key="R">R</button>
        <button type="button" data-key="SELECT">SELECT</button>
        <button type="button" data-key="START">START</button>
      </div>
      <div class="system">
        <button type="button" id="runButton">Iniciar</button>
        <button type="button" id="fullscreenBtn">TELA CHEIA</button>
        <button type="button" id="landscapeBtn">PAISAGEM</button>
      </div>
    </section>
    <p class="credit">Emulador GBA.js (BSD-2-Clause), empacotado localmente. Sem rede e sem ROM comercial.</p>
  </main>
  <script>${GBAJS_SOURCE}</script>
  <script>
    (function () {
      const BIOS_BASE64 = '${BIOS_BASE64}';
      const ROM_BASE64 = '${TEST_ROM_BASE64}';
      const keys = { A: 0, B: 1, SELECT: 2, START: 3, RIGHT: 4, LEFT: 5, UP: 6, DOWN: 7, R: 8, L: 9 };
      const keyCodes = { A: 90, B: 88, SELECT: 220, START: 13, RIGHT: 39, LEFT: 37, UP: 38, DOWN: 40, R: 83, L: 65 };
      const codeToKey = { KeyZ: 'A', KeyX: 'B', Backslash: 'SELECT', Enter: 'START', ArrowRight: 'RIGHT', ArrowLeft: 'LEFT', ArrowUp: 'UP', ArrowDown: 'DOWN', KeyS: 'R', KeyA: 'L' };
      const status = document.getElementById('status');
      const fps = document.getElementById('fps');
      const lastButton = document.getElementById('lastButton');
      const orientationLabel = document.getElementById('orientationLabel');
      const runButton = document.getElementById('runButton');
      const fullscreenBtn = document.getElementById('fullscreenBtn');
      const landscapeBtn = document.getElementById('landscapeBtn');
      const root = document.documentElement;
      let gba;
      let running = false;

      function decodeBase64(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes.buffer;
      }

      function setStatus(text) { status.textContent = text; }
      function setButtonVisual(name, pressed) {
        const button = document.querySelector('[data-key="' + name + '"]');
        if (button) button.classList.toggle('pressed', pressed);
        lastButton.textContent = name + (pressed ? ' DOWN' : ' UP');
      }
      function press(name) {
        if (!gba || keys[name] === undefined) return;
        gba.keypad.currentDown &= ~(1 << keys[name]);
        setButtonVisual(name, true);
      }
      function release(name) {
        if (!gba || keys[name] === undefined) return;
        gba.keypad.currentDown |= (1 << keys[name]);
        setButtonVisual(name, false);
      }
      function refreshLayout() {
        const landscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
        orientationLabel.textContent = landscape ? 'landscape' : 'portrait';
      }
      function setExpanded(on) {
        root.classList.toggle('expanded', on);
        fullscreenBtn.textContent = on ? 'SAIR DA TELA CHEIA' : 'TELA CHEIA';
      }
      function synthKeyboard(name, pressed) {
        const keyCode = keyCodes[name];
        if (!keyCode) return;
        const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', { keyCode, which: keyCode, bubbles: true });
        try { Object.defineProperty(event, 'keyCode', { get: function () { return keyCode; } }); } catch (e) {}
        try { Object.defineProperty(event, 'which', { get: function () { return keyCode; } }); } catch (e) {}
        window.dispatchEvent(event);
      }

      try {
        gba = new GameBoyAdvance();
        gba.setCanvas(document.getElementById('gbaScreen'));
        gba.setBios(decodeBase64(BIOS_BASE64), false);
        gba.reportFPS = function (value) { fps.textContent = value.toFixed(1); };
        if (!gba.setRom(decodeBase64(ROM_BASE64))) throw new Error('A ROM de teste foi recusada pelo emulador.');
        if (gba.keypad && gba.keypad.registerHandlers) gba.keypad.registerHandlers();

        runButton.addEventListener('click', function () {
          if (running) {
            gba.pause();
            running = false;
            runButton.textContent = 'Continuar';
            setStatus('pausado');
            return;
          }
          gba.runStable();
          running = true;
          runButton.textContent = 'Pausar';
          setStatus('executando');
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), function (button) {
          const name = button.getAttribute('data-key');
          button.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
            press(name);
            synthKeyboard(name, true);
          });
          ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (eventName) {
            button.addEventListener(eventName, function (event) {
              event.preventDefault();
              release(name);
              synthKeyboard(name, false);
            });
          });
          button.addEventListener('touchstart', function (event) {
            event.preventDefault();
            press(name);
            synthKeyboard(name, true);
          }, { passive: false });
          button.addEventListener('touchend', function (event) {
            event.preventDefault();
            release(name);
            synthKeyboard(name, false);
          }, { passive: false });
          button.addEventListener('click', function (event) {
            event.preventDefault();
            press(name);
            synthKeyboard(name, true);
            setTimeout(function () {
              release(name);
              synthKeyboard(name, false);
            }, 80);
          });
        });

        window.addEventListener('keydown', function (event) {
          const name = codeToKey[event.code];
          if (name) setButtonVisual(name, true);
        }, true);
        window.addEventListener('keyup', function (event) {
          const name = codeToKey[event.code];
          if (name) setButtonVisual(name, false);
        }, true);
        fullscreenBtn.addEventListener('click', async function () {
          try {
            if (document.fullscreenEnabled) {
              if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                setExpanded(true);
              } else {
                await document.exitFullscreen();
                setExpanded(false);
              }
            } else {
              setExpanded(!root.classList.contains('expanded'));
            }
          } catch (e) {
            setExpanded(!root.classList.contains('expanded'));
          }
        });
        document.addEventListener('fullscreenchange', function () { setExpanded(!!document.fullscreenElement); });
        landscapeBtn.addEventListener('click', async function () {
          try {
            if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
          } catch (e) {}
          refreshLayout();
        });
        window.addEventListener('resize', refreshLayout);
        window.addEventListener('orientationchange', refreshLayout);
        refreshLayout();
      } catch (error) {
        setStatus('erro: ' + error.message);
        runButton.disabled = true;
      }
    }());
  </script>
</body>
</html>`;
}

async function sendGbaTest(sock, jid) {
  if (!sock?.relayMessage) {
    throw new Error('Socket sem relayMessage; nao e possivel enviar AIRich manual.');
  }

  const html = buildGbaTestHtml();
  const richContent = buildAIRichMessageContent(html, {
    label: 'GBA Test'
  });
  logAirichPayloadStats('gbatest', html, richContent);

  console.log('[gbatest] Enviando uma unica botForwardedMessage.richResponseMessage...');
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

export { buildGbaTestHtml, buildGbaTestRom, sendGbaTest };
