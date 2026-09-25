import { buildAIRichMessageContent, sendAIRichHtml } from './sendAIRichHtml.js';

const SEND_INTERVAL_MS = 2500;

const MIN_HTML = '<html><body><h1>AIRICH SIZE TEST</h1><p>OK</p></body></html>';

const SIZE_PRESETS = [
  { label: 'MIN', bytes: null },
  { label: '10KB', bytes: 10 * 1024 },
  { label: '100KB', bytes: 100 * 1024 },
  { label: '500KB', bytes: 500 * 1024 },
  { label: '1MB', bytes: 1024 * 1024 },
  { label: '1.5MB', bytes: Math.round(1.5 * 1024 * 1024) },
  { label: '2MB', bytes: 2 * 1024 * 1024 },
  { label: '2.5MB', bytes: Math.round(2.5 * 1024 * 1024) },
  { label: '2.7MB', bytes: Math.round(2.7 * 1024 * 1024) },
  { label: '3MB', bytes: 3 * 1024 * 1024 },
  { label: '4MB', bytes: 4 * 1024 * 1024 },
  { label: '5MB', bytes: 5 * 1024 * 1024 }
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseRequestedSize(input) {
  const m = String(input || '').trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb)$/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (m[2] === 'kb') return { label: `${m[1]}KB`, bytes: Math.round(value * 1024) };
  if (m[2] === 'b') return { label: `${m[1]}B`, bytes: Math.round(value) };
  return { label: `${m[1]}MB`, bytes: Math.round(value * 1024 * 1024) };
}

function buildSizeTestHtml(targetBytes, displayLabel) {
  if (targetBytes === null || targetBytes === undefined || targetBytes <= 0) return MIN_HTML;
  const header = `<html><body><h1>AIRICH SIZE TEST</h1><p>TAMANHO: ${displayLabel} | `;
  const footer = ` | FIM</p></body></html>`;
  const prefixLen = Buffer.byteLength(header, 'utf8');
  const footerLen = Buffer.byteLength(footer, 'utf8');
  const fill = Math.max(0, targetBytes - prefixLen - footerLen);
  return header + 'A'.repeat(fill) + footer;
}

function measureAirichHtml(html, label) {
  const richContent = buildAIRichMessageContent(html, { label: `TAMANHO: ${label}` });
  const richResponse = richContent?.botForwardedMessage?.message?.richResponseMessage;
  const unifiedData = richResponse?.unifiedResponse?.data;
  const jsonBytes = Buffer.byteLength(JSON.stringify(richContent), 'utf8');
  return {
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    jsonBytes,
    base64Bytes: Buffer.byteLength(Buffer.from(html, 'utf8').toString('base64'), 'utf8'),
    unifiedResponseBytes: unifiedData ? unifiedData.length : 0,
    totalEstimatedBytes: jsonBytes
  };
}

async function sendAirichSizeTest(sock, jid, input = '') {
  if (!sock?.relayMessage) {
    console.log('[AIRICH-SIZE] TEST SUITE ERROR: socket sem relayMessage; impossivel enviar.');
    return [];
  }

  const requested = parseRequestedSize(input);
  const tests = requested
    ? [{ label: requested.label, bytes: requested.bytes }]
    : [...SIZE_PRESETS];

  const results = [];
  console.log(`[AIRICH-SIZE] TEST SUITE INICIO | testes: ${tests.map(t => t.label).join(', ')} | jid=${String(jid).slice(0, 15)}`);

  for (const t of tests) {
    const displayLabel = t.label;
    const html = buildSizeTestHtml(t.bytes, displayLabel);
    const m = measureAirichHtml(html, displayLabel);

    console.log('[AIRICH-SIZE]');
    console.log(`label=${displayLabel}`);
    console.log(`htmlBytes=${m.htmlBytes}`);
    console.log(`jsonBytes=${m.jsonBytes}`);
    console.log(`base64Bytes=${m.base64Bytes}`);
    console.log(`unifiedResponseBytes=${m.unifiedResponseBytes}`);
    console.log(`totalEstimatedBytes=${m.totalEstimatedBytes}`);

    console.log(`[AIRICH-SIZE] SEND START ${displayLabel}`);
    try {
      await sendAIRichHtml(sock, jid, html, { label: `TAMANHO: ${displayLabel}`, logLabel: `airich-sizetest-${displayLabel.toLowerCase()}` });
      console.log(`[AIRICH-SIZE] SEND DONE ${displayLabel}`);
      results.push({ label: displayLabel, htmlBytes: m.htmlBytes, jsonBytes: m.jsonBytes, base64Bytes: m.base64Bytes, unifiedResponseBytes: m.unifiedResponseBytes, relayResult: 'OK' });
    } catch (e) {
      console.log(`[AIRICH-SIZE] SEND ERROR ${displayLabel}`);
      console.log(`error=${(e && (e.stack || e.message)) || e}`);
      results.push({ label: displayLabel, htmlBytes: m.htmlBytes, jsonBytes: m.jsonBytes, base64Bytes: m.base64Bytes, unifiedResponseBytes: m.unifiedResponseBytes, relayResult: 'ERROR: ' + ((e && e.message) || e) });
    }

    if (tests.length > 1) {
      console.log(`[AIRICH-SIZE] aguardando ${SEND_INTERVAL_MS}ms ate o proximo teste...`);
      await sleep(SEND_INTERVAL_MS);
    }
  }

  console.log('[AIRICH-SIZE] RESULTADOS');
  console.log('tamanho | htmlBytes | jsonBytes | base64Bytes | unifiedResponseBytes | relayResult');
  for (const r of results) {
    console.log(`${r.label} | ${r.htmlBytes} | ${r.jsonBytes} | ${r.base64Bytes} | ${r.unifiedResponseBytes} | ${r.relayResult}`);
  }
  console.log('[AIRICH-SIZE] NOTA: relayMessage retornou sem exception, mas isso NAO garante que o WhatsApp renderizou. Verifique cada mensagem visualmente.');
  console.log('[AIRICH-SIZE] TEST SUITE FINISHED');
  return results;
}

export {
  MIN_HTML,
  SIZE_PRESETS,
  buildSizeTestHtml,
  measureAirichHtml,
  parseRequestedSize,
  sendAirichSizeTest
};