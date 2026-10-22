import https from 'https';
import verificarAPI, { carregarConfigLocal } from '../API.js';

const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.val;
}

function setCache(key, val) {
  if (cache.size >= 1000) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
  cache.set(key, { val, ts: Date.now() });
}

function requestJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        reject(new Error(`A API respondeu HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          // Endpoint de imagem: o corpo nao e JSON. O conteudo real e lido
          // pelo requestBuffer abaixo.
          resolve(null);
        }
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Tempo limite excedido ao consultar a API de logos'));
    });
    req.on('error', reject);
  });
}

function requestBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        reject(new Error(`A API respondeu HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Tempo limite excedido ao baixar o logo'));
    });
    req.on('error', reject);
  });
}

/**
 * Confere os magic bytes antes de entregar o buffer ao Baileys. Sem isso,
 * uma resposta JSON/HTML de erro (HTTP 200) era enviada como se fosse imagem.
 */
export function isImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;

  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true; // JPEG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true; // PNG
  const head6 = buffer.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return true; // GIF
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return true; // WebP

  return false;
}

function buildLogoUrl({ site, apikey, type, query, query2 }) {
  const base = String(site || '').replace(/\/+$/, '');
  const encodedType = encodeURIComponent(type);

  if (query2 === undefined) {
    return `${base}/api/logos/${encodedType}?apikey=${encodeURIComponent(apikey)}&query=${encodeURIComponent(query)}`;
  }

  return `${base}/api/duallogos/${encodedType}?apikey=${encodeURIComponent(apikey)}&query=${encodeURIComponent(query)}&text2=${encodeURIComponent(query2)}`;
}

async function generateLogo({ query, type, query2 }, options = {}) {
  const verify = options.verify || verificarAPI;
  const requestJson = options.requestJSON || requestJSON;
  const requestBinary = options.requestBuffer || requestBuffer;
  const config = options.config || carregarConfigLocal();

  const checkAPI = await verify();
  if (checkAPI !== true) return { ok: false, msg: checkAPI };

  try {
    if (!query || !type) {
      return { ok: false, msg: '❌ Parâmetros obrigatórios não informados.' };
    }

    if (query2 !== undefined && !query2) {
      return { ok: false, msg: '❌ Parâmetros obrigatórios não informados.' };
    }

    const cacheKey = query2 === undefined
      ? `logo:${type}:${query}`
      : `logo:${type}:${query}:${query2}`;
    const cached = getCached(cacheKey);
    if (cached) return { ok: true, ...cached, cached: true };

    const url = buildLogoUrl({
      site: config.site_vex,
      apikey: config.apikey_vex,
      type,
      query,
      query2
    });

    let json = null;
    try {
      json = await requestJson(url);
    } catch (error) {
      // Alguns erros de HTTP sao mascarados pelo endpoint de imagem; o
      // requestBuffer abaixo ainda pode obter a imagem. Se nao obtiver,
      // devolvemos o erro real.
      json = null;
    }

    if (json) {
      const checkAfter = await verify(json);
      if (checkAfter !== true) {
        return { ok: false, msg: checkAfter };
      }
    }

    const buffer = await requestBinary(url);

    if (!buffer || buffer.length === 0) {
      return { ok: false, msg: '❌ Resposta não é uma imagem válida.' };
    }

    if (!isImageBuffer(buffer)) {
      return { ok: false, msg: '❌ A API não retornou uma imagem válida.' };
    }

    const response = { buffer };
    setCache(cacheKey, response);

    return { ok: true, ...response };
  } catch (err) {
    return { ok: false, msg: `❌ Erro ao gerar o logo: ${err.message}` };
  }
}

async function gerarLogo({ query, type }, options = {}) {
  return generateLogo({ query, type }, options);
}

async function gerarLogo2({ query, query2, type }, options = {}) {
  return generateLogo({ query, query2, type }, options);
}

export { gerarLogo, gerarLogo2 };
