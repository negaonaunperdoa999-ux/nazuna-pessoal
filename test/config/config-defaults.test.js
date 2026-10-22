import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, needsRepair } from '../../dados/src/utils/defaultConfig.js';

test('um config vazio recebe todos os valores padrão', () => {
    const { config, fixed } = normalizeConfig({});

    assert.equal(config.prefixo, '!');
    assert.equal(config.nomebot, 'Nazuna');
    assert.equal(config.numerodono, '');
    assert.equal(config.modoaluguel, false);
    assert.equal(config.site_vex, DEFAULT_CONFIG.site_vex);
    assert.ok(fixed.includes('prefixo'), 'o prefixo ausente precisa ser relatado');
});

test('o prefixo ausente nunca vira undefined (causa do crash em groupPrefix.length)', () => {
    const { config } = normalizeConfig({});

    // Reproduz o caminho do index.js: config.prefixo -> prefixo -> groupPrefix
    const prefixo = config.prefixo;
    const groupPrefix = prefixo;
    assert.equal(typeof groupPrefix, 'string');
    assert.ok(groupPrefix.length > 0);
});

test('as configurações do usuário são preservadas', () => {
    const { config, fixed, invalid } = normalizeConfig({
        prefixo: '#',
        nomebot: 'Mio',
        numerodono: '5511999999999',
        modoaluguel: true
    });

    assert.equal(config.prefixo, '#');
    assert.equal(config.nomebot, 'Mio');
    assert.equal(config.numerodono, '5511999999999');
    assert.equal(config.modoaluguel, true);
    assert.ok(!fixed.includes('prefixo'), 'o prefixo do usuário não pode ser reportado como ausente');
    assert.ok(!fixed.includes('nomebot'));
    assert.ok(!fixed.includes('modoaluguel'));
    assert.equal(invalid.length, 0);
});

test('valores com tipo errado são corrigidos e apontados', () => {
    const { config, invalid } = normalizeConfig({ prefixo: 123, modoaluguel: 'sim' });

    assert.equal(config.prefixo, '!');
    assert.equal(config.modoaluguel, false);
    assert.deepEqual(invalid.sort(), ['modoaluguel', 'prefixo']);
});

test('needsRepair indica quando o config precisa de conserto', () => {
    assert.equal(needsRepair({}), true);
    assert.equal(needsRepair({ prefixo: '!' }), true);
    assert.equal(needsRepair({ ...DEFAULT_CONFIG }), false);
});

test('o default do prefixo nunca é string vazia', () => {
    assert.ok(DEFAULT_CONFIG.prefixo.length > 0);
    assert.equal(normalizeConfig(null).config.prefixo, DEFAULT_CONFIG.prefixo);
    assert.equal(normalizeConfig(undefined).config.prefixo, DEFAULT_CONFIG.prefixo);
});
