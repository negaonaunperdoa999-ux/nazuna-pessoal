import crypto from 'crypto';
import { readFileSync } from 'fs';
import { buildAIRichMessageContent } from '../pokemonRichHtml.js';

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

function createId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return crypto.randomBytes(16).toString('hex');
}

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
    html, body { margin: 0; min-height: 560px; background: #101820; color: #ffffff; font-family: Arial, sans-serif; }
    .app { box-sizing: border-box; min-height: 560px; padding: 12px 10px 18px; text-align: center; }
    h2 { margin: 0 0 5px; font-size: 21px; }
    .status { min-height: 18px; margin: 0 0 10px; color: #b9d5e2; font-size: 13px; }
    #gbaScreen { display: block; width: 240px; height: 160px; margin: 0 auto 10px; border: 3px solid #4c6a7a; border-radius: 7px; background: #000000; image-rendering: pixelated; }
    button { border: 0; border-radius: 7px; min-height: 38px; padding: 0 13px; background: #ffcb05; color: #1f2937; font-size: 15px; font-weight: 700; touch-action: none; }
    button:active { background: #f2b807; transform: translateY(1px); }
    .system { margin-bottom: 9px; }
    .pad { display: grid; grid-template-columns: 54px 54px 54px 18px 64px 64px; grid-template-rows: 42px 42px 42px; gap: 4px; justify-content: center; }
    .pad button { min-width: 0; padding: 0; }
    [data-key="UP"] { grid-column: 2; grid-row: 1; }
    [data-key="LEFT"] { grid-column: 1; grid-row: 2; }
    [data-key="DOWN"] { grid-column: 2; grid-row: 2; }
    [data-key="RIGHT"] { grid-column: 3; grid-row: 2; }
    [data-key="B"] { grid-column: 5; grid-row: 2; background: #d34d75; color: #fff; }
    [data-key="A"] { grid-column: 6; grid-row: 1; background: #d34d75; color: #fff; }
    .meta { display: flex; gap: 7px; justify-content: center; margin-top: 9px; }
    .meta button { min-height: 34px; font-size: 12px; background: #4c6a7a; color: #fff; }
    .credit { margin: 10px 0 0; color: #a7bdc8; font-size: 11px; }
  </style>
</head>
<body>
  <main class="app">
    <h2>GBA Test — ROM livre</h2>
    <p class="status" id="status">Demo local carregada. Toque em Iniciar.</p>
    <canvas id="gbaScreen" width="240" height="160" aria-label="Tela Game Boy Advance"></canvas>
    <div class="system"><button type="button" id="runButton">Iniciar</button></div>
    <div class="pad" aria-label="Controles virtuais GBA">
      <button type="button" data-key="UP">↑</button>
      <button type="button" data-key="LEFT">←</button>
      <button type="button" data-key="DOWN">↓</button>
      <button type="button" data-key="RIGHT">→</button>
      <button type="button" data-key="A">A</button>
      <button type="button" data-key="B">B</button>
    </div>
    <div class="meta">
      <button type="button" data-key="SELECT">SELECT</button>
      <button type="button" data-key="START">START</button>
    </div>
    <p class="credit">Emulador GBA.js (BSD-2-Clause), empacotado localmente. Sem rede e sem ROM comercial.</p>
  </main>
  <script>${GBAJS_SOURCE}</script>
  <script>
    (function () {
      const BIOS_BASE64 = '${BIOS_BASE64}';
      const ROM_BASE64 = '${TEST_ROM_BASE64}';
      const keys = { A: 0, B: 1, SELECT: 2, START: 3, RIGHT: 4, LEFT: 5, UP: 6, DOWN: 7 };
      const status = document.getElementById('status');
      const runButton = document.getElementById('runButton');
      let gba;
      let running = false;

      function decodeBase64(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes.buffer;
      }

      function press(name) { gba.keypad.currentDown &= ~(1 << keys[name]); }
      function release(name) { gba.keypad.currentDown |= (1 << keys[name]); }

      try {
        gba = new GameBoyAdvance();
        gba.setCanvas(document.getElementById('gbaScreen'));
        gba.setBios(decodeBase64(BIOS_BASE64), false);
        if (!gba.setRom(decodeBase64(ROM_BASE64))) throw new Error('A ROM de teste foi recusada pelo emulador.');

        runButton.addEventListener('click', function () {
          if (running) {
            gba.pause();
            running = false;
            runButton.textContent = 'Continuar';
            status.textContent = 'Demo pausada.';
            return;
          }
          gba.runStable();
          running = true;
          runButton.textContent = 'Pausar';
          status.textContent = 'Demo local em execucao.';
        });

        Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), function (button) {
          const name = button.getAttribute('data-key');
          button.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
            press(name);
          });
          ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (eventName) {
            button.addEventListener(eventName, function (event) {
              event.preventDefault();
              release(name);
            });
          });
        });
      } catch (error) {
        status.textContent = 'Falha ao iniciar a demo: ' + error.message;
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

  const richContent = buildAIRichMessageContent(buildGbaTestHtml(), {
    label: 'GBA Test'
  });

  console.log('[gbatest] Enviando uma unica botForwardedMessage.richResponseMessage...');
  return sock.relayMessage(jid, richContent, { messageId: createId() });
}

export { buildGbaTestHtml, buildGbaTestRom, sendGbaTest };
