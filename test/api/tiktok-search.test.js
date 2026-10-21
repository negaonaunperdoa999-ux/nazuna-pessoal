import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TIKTOK_SEARCH_BLOCKED_MESSAGE,
    dedupeResults,
    normalizeSearchResult,
    searchTikTok,
    searchTikTokLocal,
    validateSearchQuery
} from '../../dados/src/funcs/api/providers/local/tiktokSearch.js';

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

test('a fonte local extrai resultados reais da página pública', async () => {
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

test('a fonte local informa o bloqueio concreto quando o TikTok não devolve itens', async () => {
    const fetchImpl = async () => ({
        ok: true,
        status: 200,
        text: async () => '<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{}}</script></html>'
    });

    const resultado = await searchTikTokLocal('billie jean', { fetchImpl });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.etapa, 'busca');
    assert.match(resultado.msg, /não está disponível localmente/i);
    assert.equal(resultado.msg, TIKTOK_SEARCH_BLOCKED_MESSAGE);
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

test('a VexAPI não é chamada quando o dono não configurou a chave', async () => {
    let fallbackChamado = false;
    const resultado = await searchTikTok('billie jean', {
        config: { site_vex: '', apikey_vex: '' },
        fallbackSearch: async () => {
            fallbackChamado = true;
            return { ok: true, urls: ['https://www.tiktok.com/@x/video/1'], type: 'video', title: 'x' };
        },
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => '<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{}}</script></html>'
        })
    });

    assert.equal(fallbackChamado, false, 'a VexAPI não pode ser chamada sem chave configurada');
    assert.equal(resultado.ok, false);
    assert.equal(resultado.fonte, 'local');
    assert.match(resultado.msg, /não está disponível localmente/i);
});

test('a fonte legada só entra com chave configurada e a origem fica explícita', async () => {
    let fallbackChamado = false;
    const resultado = await searchTikTok('billie jean', {
        config: { site_vex: 'https://vex.example', apikey_vex: 'chave' },
        fallbackSearch: async () => {
            fallbackChamado = true;
            return { ok: true, urls: ['https://www.tiktok.com/@x/video/1'], type: 'video', title: 'x' };
        },
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => '<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">{"__DEFAULT_SCOPE__":{}}</script></html>'
        })
    });

    assert.equal(fallbackChamado, true);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.fonte, 'vex');
    assert.equal(resultado.urls[0], 'https://www.tiktok.com/@x/video/1');
});

test('a busca local devolve o formato esperado pelo comando', async () => {
    const resultado = await searchTikTok('billie jean', {
        config: {},
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => htmlComResultados([
                { id: '7333333333333333333', desc: 'Billie Jean', autor: 'artista3' }
            ])
        })
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.fonte, 'local');
    assert.equal(resultado.urls[0], 'https://www.tiktok.com/@artista3/video/7333333333333333333');
    assert.equal(resultado.title, 'Billie Jean');
    assert.equal(resultado.type, 'video');
});
