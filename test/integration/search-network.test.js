import test from 'node:test';
import assert from 'node:assert/strict';

import { searchPinterestLocal } from '../../dados/src/funcs/api/providers/local/pinterestSearch.js';
import { searchTikTokLocal } from '../../dados/src/funcs/api/providers/local/tiktokSearch.js';

const enabled = process.env.NAZUNA_NETWORK_TESTS === '1';
const skip = enabled ? false : 'defina NAZUNA_NETWORK_TESTS=1 para rodar os testes de rede';

test('busca real do Pinterest entrega pins para "flores"', { skip }, async () => {
    const resultado = await searchPinterestLocal('flores');

    assert.equal(resultado.ok, true);
    assert.ok(resultado.results.length > 0);
    assert.ok(resultado.results.every((item) => item.url.startsWith('https://i.pinimg.com/')));
});

test('busca real do Pinterest não devolve pins genéricos para termo inexistente', { skip }, async () => {
    const resultado = await searchPinterestLocal('xyzabc987654');

    assert.equal(resultado.ok, false);
    assert.match(resultado.msg, /não retornou resultados acessíveis/i);
});

test('busca real do TikTok entrega vídeos para "baralho" pela página de descoberta', { skip }, async () => {
    const resultado = await searchTikTokLocal('baralho');

    assert.equal(resultado.ok, true);
    assert.ok(resultado.results.length > 0);
    assert.ok(resultado.results.every((item) => /^https:\/\/www\.tiktok\.com\/@[^/]+\/video\/\d+$/.test(item.url)));
});
