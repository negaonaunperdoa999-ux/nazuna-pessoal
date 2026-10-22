import { downloadPinterestPin, isPinterestPinUrl } from '../api/providers/local/pinterest.js';
import { searchPinterestLocal } from '../api/providers/local/pinterestSearch.js';

const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

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
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { val, ts: Date.now() });
}

async function search(query, options = {}) {
  const text = String(query ?? '').trim();
  if (!text) {
    return { ok: false, msg: 'Digite um termo para pesquisar no Pinterest.' };
  }

  const cacheKey = `search:${text.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return { ok: true, ...cached, cached: true };

  const local = await searchPinterestLocal(text, options);
  if (!local.ok) return local;

  const result = {
    type: 'image',
    query: local.query,
    count: local.count,
    urls: local.results.map(item => item.url),
    results: local.results,
    fonte: 'local'
  };

  setCache(cacheKey, result);

  return { ok: true, ...result };
}

async function dl(url, options = {}) {
  if (!url) {
    return { ok: false, msg: 'URL inválida' };
  }

  if (!isPinterestPinUrl(url)) {
    return { ok: false, msg: 'Envie um link de pin do Pinterest (ou use o comando com um termo de busca).' };
  }

  const local = await downloadPinterestPin(url, options);

  if (!local.ok) {
    return { ok: false, msg: local.msg, etapa: local.etapa, code: local.code };
  }

  return {
    ok: true,
    type: local.type,
    buffer: local.buffer,
    mimetype: local.mimetype,
    fileName: local.fileName,
    title: local.title,
    sizeBytes: local.sizeBytes,
    urls: local.type === 'image' && local.thumbnail ? [local.thumbnail] : [],
    local: true
  };
}

export {
  search,
  dl
};
