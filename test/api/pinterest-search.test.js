import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    PINTEREST_SEARCH_UNAVAILABLE_MESSAGE,
    extractPinterestSearchResults,
    searchPinterestLocal,
    validatePinterestQuery
} from '../../dados/src/funcs/api/providers/local/pinterestSearch.js';
import { search, dl } from '../../dados/src/funcs/downloads/pinterest.js';

const PINTEREST_WRAPPER_SOURCE = fileURLToPath(new URL(
    '../../dados/src/funcs/downloads/pinterest.js',
    import.meta.url
));

const HASH_A = 'aabbccddeeff00112233445566778899';
const HASH_B = '11223344556677889900aabbccddeeff';

function pinterestHtml({ results = [], guides = [{ term: 'flores' }], vertical = [], modules = [] } = {}) {
    const data = {
        initialReduxState: {
            resources: {
                BaseSearchResource: {
                    '["query","flores"]': {
                        data: {
                            rankedGuides: guides,
                            queryL1VerticalIds: vertical,
                            oneBarModules: modules,
                            results
                        }
                    }
                }
            }
        }
    };
    return `<html><script id="__PWS_INITIAL_PROPS__" type="application/json">${JSON.stringify(data)}</script></html>`;
}

function pin(hash, id = hash) {
    return {
        id,
        image_signature: hash,
        images: {
            '236x': { width: 236, height: 400, url: `https://i.pinimg.com/236x/aa/bb/cc/${hash}.jpg` },
            '736x': { width: 736, height: 1200, url: `https://i.pinimg.com/736x/aa/bb/cc/${hash}.jpg` },
            orig: { width: 900, height: 1500, url: `https://i.pinimg.com/originals/aa/bb/cc/${hash}.jpg` }
        }
    };
}

test('valida o termo da busca do Pinterest', () => {
    assert.equal(validatePinterestQuery('').ok, false);
    assert.equal(validatePinterestQuery('   ').ok, false);
    assert.equal(validatePinterestQuery('flores').ok, true);
    assert.equal(validatePinterestQuery('x'.repeat(200)).ok, false);
});

test('extrai a maior imagem e deduplica os pins', () => {
    const html = pinterestHtml({
        results: [
            pin(HASH_A),
            pin(HASH_A),
            pin(HASH_B, 'outro'),
            { id: 'invalido', images: { orig: { url: 'https://exemplo.com/imagem.jpg' } } }
        ]
    });

    const resultado = extractPinterestSearchResults(html);

    assert.equal(resultado.ok, true);
    assert.equal(resultado.results.length, 2);
    assert.equal(resultado.results[0].url, `https://i.pinimg.com/originals/aa/bb/cc/${HASH_A}.jpg`);
    assert.equal(resultado.results[0].width, 900);
    assert.equal(resultado.results[1].url, `https://i.pinimg.com/originals/aa/bb/cc/${HASH_B}.jpg`);
});

test('não devolve pins genéricos quando a página não confirma a busca', () => {
    const html = pinterestHtml({ results: [pin(HASH_A)], guides: [] });

    const resultado = extractPinterestSearchResults(html);

    assert.equal(resultado.ok, false);
    assert.equal(resultado.code, 'no_results');
    assert.equal(resultado.msg, PINTEREST_SEARCH_UNAVAILABLE_MESSAGE);
});

test('a fonte local usa a página móvel pública e devolve URLs do pinimg', async () => {
    let requestedUrl = '';
    const fetchImpl = async (url, options) => {
        requestedUrl = url;
        assert.match(options.headers['user-agent'], /iPhone/);
        return {
            ok: true,
            status: 200,
            text: async () => pinterestHtml({ results: [pin(HASH_A)] })
        };
    };

    const resultado = await searchPinterestLocal('flores', { fetchImpl });

    assert.match(requestedUrl, /^https:\/\/www\.pinterest\.com\/search\/pins\/\?q=flores$/);
    assert.equal(resultado.ok, true);
    assert.equal(resultado.fonte, 'local');
    assert.equal(resultado.count, 1);
    assert.equal(resultado.results[0].url, `https://i.pinimg.com/originals/aa/bb/cc/${HASH_A}.jpg`);
});

test('a busca textual não exige chave e informa a limitação', async () => {
    const resultado = await searchPinterestLocal('xyzabc987654', {
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => pinterestHtml({ results: [pin(HASH_A)], guides: [] })
        })
    });

    assert.equal(resultado.ok, false);
    assert.equal(resultado.etapa, 'busca');
    assert.equal(resultado.msg, PINTEREST_SEARCH_UNAVAILABLE_MESSAGE);
    assert.doesNotMatch(resultado.msg, /vex|api-key|apikey|chave/i);
});

test('o wrapper de busca usa o provider local e devolve urls', async () => {
    const resultado = await search('flores-wrapper', {
        fetchImpl: async () => ({
            ok: true,
            status: 200,
            text: async () => pinterestHtml({ results: [pin(HASH_B)] })
        })
    });

    assert.equal(resultado.ok, true);
    assert.equal(resultado.type, 'image');
    assert.equal(resultado.urls.length, 1);
    assert.equal(resultado.urls[0], `https://i.pinimg.com/originals/aa/bb/cc/${HASH_B}.jpg`);
});

test('o wrapper não chama a VexAPI e rejeita link que não é pin', async () => {
    const fonte = fs.readFileSync(PINTEREST_WRAPPER_SOURCE, 'utf8');
    assert.doesNotMatch(fonte, /verificarAPI|carregarConfigLocal|site_vex|apikey_vex|downloadViaVex|api\/pesquisa\/pinterest/i);

    const resultado = await dl('https://www.pinterest.com/search/pins/?q=flores');
    assert.equal(resultado.ok, false);
    assert.match(resultado.msg, /link de pin/i);
    assert.doesNotMatch(resultado.msg, /vex|apikey|chave/i);
});
