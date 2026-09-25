import { buildAIRichMessageContent, getAirichSafeMaxBytes, sendAIRichHtml } from './sendAIRichHtml.js';

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

function classifyEntry(label, targetBytes, limitBytes) {
  const html = buildSizeTestHtml(targetBytes, label);
  const m = measureAirichHtml(html, label);
  return {
    label,
    targetBytes,
    htmlBytes: m.htmlBytes,
    jsonBytes: m.jsonBytes,
    base64Bytes: m.base64Bytes,
    unifiedResponseBytes: m.unifiedResponseBytes,
    totalEstimatedBytes: m.totalEstimatedBytes,
    blocked: m.unifiedResponseBytes > limitBytes,
    limitBytes
  };
}

async function runLiveTests(sock, jid, entries, limitBytes) {
  const results = [];
  console.log(`[AIRICH-SIZE] LIVE INICIO | testes: ${entries.map(t => t.label).join(', ')} | jid=${String(jid).slice(0, 15)} | limite=${limitBytes}`);

  for (const m of entries) {
    const html = buildSizeTestHtml(m.targetBytes, m.label);
    console.log(`[AIRICH-SIZE] SEND START ${m.label}`);
    try {
      const res = await sendAIRichHtml(sock, jid, html, { label: `TAMANHO: ${m.label}`, logLabel: `airich-sizetest-${m.label.toLowerCase()}` });
      const blocked = res?.blocked === 'size_limit';
      console.log(`[AIRICH-SIZE] SEND ${blocked ? 'BLOCKED' : 'DONE'} ${m.label}`);
      results.push({ ...m, relayResult: blocked ? 'BLOCKED (size_limit, antes do relayMessage)' : 'OK' });
    } catch (e) {
      console.log(`[AIRICH-SIZE] SEND ERROR ${m.label}`);
      console.log(`error=${(e && (e.stack || e.message)) || e}`);
      results.push({ ...m, relayResult: 'ERROR: ' + ((e && e.message) || e) });
    }

    if (entries.length > 1) {
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

async function sendAirichSizeTest(sock, jid, input = '') {
  if (!sock?.relayMessage) {
    console.log('[AIRICH-SIZE] TEST SUITE ERROR: socket sem relayMessage; impossivel enviar.');
    return [];
  }

  const tokens = String(input || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isDry = !tokens.some(t => t === 'live' || t === 'real');
  const sizeToken = tokens.find(t => t !== 'live' && t !== 'real' && t !== 'dry');
  const requested = sizeToken ? parseRequestedSize(sizeToken) : null;
  const limitBytes = getAirichSafeMaxBytes();

  if (requested) {
    const entry = classifyEntry(requested.label, requested.bytes, limitBytes);
    console.log(`[AIRICH-SIZE] solicitado=${requested.label} | modo=${isDry ? 'DRY-RUN' : 'LIVE'} | AIRICH_SAFE_MAX_BYTES=${limitBytes}`);
    console.log(`[AIRICH-SIZE] label=${entry.label} htmlBytes=${entry.htmlBytes} jsonBytes=${entry.jsonBytes} base64Bytes=${entry.base64Bytes} unifiedResponseBytes=${entry.unifiedResponseBytes}`);

    if (entry.blocked) {
      console.log(`[AIRICH-SIZE] BLOCKED ${entry.label}: unifiedResponseBytes (${entry.unifiedResponseBytes}) > AIRICH_SAFE_MAX_BYTES (${limitBytes}). NENHUM relayMessage sera enviado (bloqueio antes do relay).`);
      console.log(`[AIRICH-SIZE] RESULTADO: ${entry.label} | blocked=size_limit`);
      return [{ ...entry, relayResult: 'BLOCKED (size_limit, antes do relayMessage)' }];
    }

    if (isDry) {
      console.log(`[AIRICH-SIZE] DRY-RUN: ${entry.label} esta DENTRO do limite e seria enviado apenas em modo live.`);
      console.log(`[AIRICH-SIZE] Para enviar de verdade use: airichsizetest ${sizeToken} live`);
      console.log(`[AIRICH-SIZE] RESULTADO: ${entry.label} | blocked=no (dry-run, nao enviado)`);
      return [{ ...entry, relayResult: 'DRY-RUN (nao enviado)' }];
    }

    return await runLiveTests(sock, jid, [entry], limitBytes);
  }

  console.log(`[AIRICH-SIZE] TEST SUITE VALIDACAO (DRY-RUN) | AIRICH_SAFE_MAX_BYTES=${limitBytes}`);
  console.log('tamanho | htmlBytes | unifiedResponseBytes | dentro_do_limite | obs');
  const table = SIZE_PRESETS.map(t => {
    const entry = classifyEntry(t.label, t.bytes, limitBytes);
    const obs = entry.blocked ? 'BLOQUEADO (acima do limite)' : 'ok';
    console.log(`${t.label} | ${entry.htmlBytes} | ${entry.unifiedResponseBytes} | ${!entry.blocked} | ${obs}`);
    return entry;
  });
  console.log('[AIRICH-SIZE] DRY-RUN: nenhum relayMessage sera enviado neste modo.');
  console.log('[AIRICH-SIZE] Para enviar um tamanho especifico real, use: airichsizetest <tamanho> live (ex: airichsizetest 1mb live).');
  console.log('[AIRICH-SIZE] Nota: tamanhos acima do limite sao bloqueados antes do relayMessage mesmo em modo live.');
  return table.map(e => ({ ...e, relayResult: 'DRY-RUN (nao enviado)' }));
}

export {
  MIN_HTML,
  SIZE_PRESETS,
  buildSizeTestHtml,
  classifyEntry,
  measureAirichHtml,
  parseRequestedSize,
  sendAirichSizeTest
};