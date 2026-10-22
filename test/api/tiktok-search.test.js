import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    TIKTOK_SEARCH_BLOCKED_MESSAGE,
    dedupeResults,
    extractTikTokDiscoverResults,
    normalizeSearchResult,
    searchTikTok,
    searchTikTokLocal,
    validateSearchQuery
} from '../../dados/src/funcs/api/providers/local/tiktokSearch.js';

const TIKTOK_SEARCH_SOURCE = fileURLToPath(new URL(
    '../../dados/src/funcs/api/providers/local/tiktokSearch.js',
    import.meta.url
));

function htmlComResultados(itens) {
    const bloco = {
        __DEFAULT_SCOPE__: {
            'webapp.search-section-proxy': itens.map((item) => ({
                id: item.id,
                desc: item.desc,
                author: { uniqueId: item.autor },
                music: item.musica ? { original: true } : {}
            }))
        }
    };
    return `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(bloco)}</script></html>`;
}

function htmlDiscover(itens) {
    const cards = itens.map((item) => `
        <div data-e2e="video-item">
            <a href="https://app-va.tiktokv.com/redirect/?redirect_url=snssdk1233%3A%2F%2Faweme%2Fdetail%2F${item.id}%3Finsert_feed%3D1">
                <img alt="10K Likes, 20 Comments. TikTok video from ${item.autor} (@${item.autor}): &quot;${item.desc}&quot;">
            </a>
        </div>`).join('');
    return `<html><body>${cards}</body></html>`;
}

function semResultados() {
    return '<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{}}</script></html>';
}

test('valida a consulta textual', () => {
    assert.equal(validateSearchQuery('').ok, false);
    assert.equal(validateSearchQuery('   ').ok, false);
    assert.equal(validateSearchQuery('billie jean').ok, true);
    assert.equal(validateSearchQuery('x'.repeat(200)).ok, false);
});

test('normaliza e descarta entradas inválidas', () => {
    const valido = normalizeSearchResult({
        videoId: '7123456789012345678',
        url: 'https://www.tiktok.com/@user/video/7123456789012345678',
        title: 'Um vídeo',
        author: 'user'
    });
    assert.equal(valido.videoId, '7123456789012345678');
    assert.equal(valido.type, 'video');

    assert.equal(normalizeSearchResult({ url: 'nao-e-url' }), null);
    assert.equal(normalizeSearchResult({ url: 'https://youtube.com/watch?v=1', videoId: '1' }), null);
    assert.equal(normalizeSearchResult({ url: 'https://www.tiktok.com/@user/video/abc' }), null);
    assert.equal(normalizeSearchResult(null), null);
});

test('deduplica e limita os resultados', () => {
    const duplicados = [
        { videoId: '7111111111111111111', url: 'https://www.tiktok.com/@a/video/7111111111111111111', title: 'a' },
        { videoId: '7111111111111111111', url: 'https://www.tiktok.com/@a/video/7111111111111111111', title: 'a de novo' },
        { videoId: '7222222222222222222', url: 'https://www.tiktok.com/@b/video/7222222222222222222', title: 'b' }
    ];

    const saida = dedupeResults(duplicados, 5);
    assert.equal(saida.length, 2);
    assert.equal(saida[0].videoId, '7111111111111111111');

    assert.equal(dedupeResults(duplicados, 1).length, 1);
    assert.deepEqual(dedupeResults([], 5), []);
});

test('extrai os cards reais da página pública de descoberta', () => {
    const results = extractTikTokDiscoverResults(htmlDiscover([
        { id: '7111111111111111111', desc: 'Billie Jean', autor: 'artista1' },
        { id: '7222222222222222222', desc: 'Outro vídeo', autor: 'artista2' }
    ]));

    assert.equal(results.length, 2);
    assert.equal(results[0].url, 'https://www.tiktok.com/@artista1/video/7111111111111111111');
    assert.equal(results[0].author, 'artista1');
    assert.equal(results[0].title, 'Billie Jean');
    assert.equal(results[1].videoId, '7222222222222222222');
});

test('a fonte local extrai itens do JSON quando a página os embute', async () => {
    const fetchImpl = async () => ({
        ok: true,
        status: 200,
        text: async () => htmlComResultados([
            { id: '7111111111111111111', desc: 'Billie Jean', autor: 'artista1' },
            { id: '7222222222222222222', desc: 'Outro vídeo', autor: 'artista2', musica: true }
        ])
    });

    const resultado = await searchTikTokLocal('billie jean', { fetchImpl });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.results.length, 2);
    assert.equal(resultado.results[0].url, 'https://www.tiktok.com/@artista1/video/7111111111111111111');
    assert.equal(resultado.results[0].author, 'artista1');
    assert.equal(resultado.results[1].type, 'audio');
});

test('a fonte local usa /discover e devolve o formato esperado', async () => {
    let requestedUrl = '';
    const resultado = await searchTikTok('billie jean', {
        fetchImpl: async (url, options) => {
            requestedUrl = url;
            assert.match(options.headers['User-Agent'], /iPhone/);
            return {
                ok: true,
                status: 200,
                text: async () => htmlDiscover([
                    { id: '7333333333333333333', desc: 'Billie Jean', autor: 'artista3' }
                ])
            };
        }
    });

    assert.match(requestedUrl, /^https:\/\/www\.tiktok\.com\/discover\/billie%20jean$/);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.fonte, 'local');
    assert.equal(resultado.urls[0], 'https://www.tiktok.com/@artista3/video/7333333333333333333');
    assert.equal(resultado.title, 'Billie Jean');
    assert.equal(resultado.type, 'video');
});

test('a fonte local informa a indisponibilidade sem recomendar VexAPI', async () => {
    const resultado = await searchTikTokLocal('billie jean', {
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => semResultados() })
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.etapa, 'busca');
    assert.equal(resultado.msg, TIKTOK_SEARCH_BLOCKED_MESSAGE);
    assert.doesNotMatch(resultado.msg, /vex|api-key|apikey|chave/i);
});

test('nunca chama fallback externo, mesmo com chave configurada', async () => {
    let fallbackChamado = false;
    const resultado = await searchTikTok('billie jean', {
        config: { site_vex: 'https://vex.example', apikey_vex: 'chave' },
        fallbackSearch: async () => {
            fallbackChamado = true;
            return { ok: true, urls: ['https://www.tiktok.com/@x/video/1'], type: 'video', title: 'x' };
        },
        fetchImpl: async () => ({ ok: true, status: 200, text: async () => semResultados() })
    });

    assert.equal(fallbackChamado, false);
    assert.equal(resultado.ok, false);
    assert.equal(resultado.fonte, 'local');
    assert.doesNotMatch(resultado.msg, /vex|api-key|apikey|chave/i);
});

test('timeout e falha de rede viram mensagens claras', async () => {
    const timeout = await searchTikTokLocal('x', {
        fetchImpl: async () => {
            const erro = new Error('aborted');
            erro.name = 'AbortError';
            throw erro;
        }
    });
    assert.equal(timeout.ok, false);
    assert.match(timeout.msg, /demorou demais/i);

    const rede = await searchTikTokLocal('x', {
        fetchImpl: async () => { throw new Error('ECONNRESET'); }
    });
    assert.equal(rede.ok, false);
    assert.match(rede.msg, /Falha de rede/i);
});

test('o provider do TikTok não depende mais da VexAPI', () => {
    const fonte = fs.readFileSync(TIKTOK_SEARCH_SOURCE, 'utf8');
    assert.doesNotMatch(fonte, /getVexSettings|verificarAPI|carregarConfigLocal|site_vex|apikey_vex|api\/pesquisa\/tiktok/i);
});
