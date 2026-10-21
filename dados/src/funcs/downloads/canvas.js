import https from 'https';
import fs from 'fs';
import verificarAPI, { carregarConfigLocal } from '../API.js';
import { runBrat, toUserMessage } from '../api/index.js';

const CONFIG_FILE = carregarConfigLocal();;

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

/**
 * Gera imagem estática Brat (buffer local ou URL da Vex)
 */
async function gerarbrat(query, bg, text_color, blur) {
    try {
        return await runBrat({ query, bg, text_color, blur });
    } catch (err) {
        return { ok: false, msg: toUserMessage(err) };
    }
}


async function gerarbratvid(query, bg, text_color, bpm, blur) {
    const checkAPI = await verificarAPI();
    if (checkAPI !== true) return { ok: false, msg: checkAPI };

    try {
        if (!query) return { ok: false, msg: 'O texto (query) é obrigatório' };

        const cacheKey = `bratvid:${query.toLowerCase()}:${bg}:${text_color}:${bpm}:${blur}`;
        const cached = getCached(cacheKey);
        if (cached) return { ok: true, ...cached, cached: true };

        const { apikey_vex, site_vex } = CONFIG_FILE;


        let url = `${site_vex}/api/canvas/bratvideo?apikey=${apikey_vex}&query=${encodeURIComponent(query)}`;
        if (bg) url += `&bg=${encodeURIComponent(bg)}`;
        if (text_color) url += `&text_color=${encodeURIComponent(text_color)}`;
        if (bpm) url += `&bpm=${encodeURIComponent(bpm)}`;
        if (blur) url += `&blur=${encodeURIComponent(blur)}`;

        const result = {
            criador: 'Tokyo',
            type: 'video',
            mime: 'image/webp',
            query,
            url: url
        };

        setCache(cacheKey, result);
        return { ok: true, ...result };

    } catch (err) {
        return { ok: false, msg: err.message };
    }
}


async function gerarwelcomecard(avatar, nome, texto, fundo, corMoldura, corLinhas, glow) {
    const checkAPI = await verificarAPI();
    if (checkAPI !== true) return { ok: false, msg: checkAPI };

    try {

        if (!avatar || !nome) {
            return { ok: false, msg: 'Avatar e Nome são obrigatórios para o Welcome Card' };
        }

        const { apikey_vex, site_vex } = CONFIG_FILE;


        let url = `${site_vex}/api/canvas/welcome2?apikey=${apikey_vex}` +
            `&avatar=${encodeURIComponent(avatar)}` +
            `&nome=${encodeURIComponent(nome)}` +
            `&texto=${encodeURIComponent(texto || '')}` +
            `&fundo=${encodeURIComponent(fundo || '')}` +
            `&corMoldura=${encodeURIComponent(corMoldura || '')}` +
            `&corLinhas=${encodeURIComponent(corLinhas || '')}` +
            `&glow=${glow || 'false'}`;

        const result = {
            criador: 'Tokyo',
            type: 'image',
            mime: 'image/png',
            nome,
            url: url
        };


        return { ok: true, ...result };

    } catch (err) {
        return { ok: false, msg: err.message };
    }
}




export {
    gerarbrat,
    gerarbratvid,
    gerarwelcomecard
};
