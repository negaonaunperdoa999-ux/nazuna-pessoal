import test from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveCommandPrefix,
    shouldIgnoreSystemMessage,
    isRevokeProtocolMessage,
    PROTOCOL_MESSAGE_TYPE
} from '../../dados/src/utils/messageFilters.js';

test('o prefixo nunca é undefined, mesmo sem configuração', () => {
    const groupPrefix = resolveCommandPrefix({}, undefined);

    assert.equal(typeof groupPrefix, 'string');
    assert.ok(groupPrefix.length > 0);
    // O crash original era exatamente neste acesso:
    assert.doesNotThrow(() => groupPrefix.length);
});

test('o prefixo customizado do grupo tem precedência', () => {
    assert.equal(resolveCommandPrefix({ customPrefix: '#' }, '!'), '#');
});

test('sem prefixo customizado, usa o prefixo global e depois o padrão', () => {
    assert.equal(resolveCommandPrefix({}, '#'), '#');
    assert.equal(resolveCommandPrefix({ customPrefix: '' }, '#'), '#');
    assert.equal(resolveCommandPrefix({}, undefined), '!');
    assert.equal(resolveCommandPrefix(undefined, null), '!');
});

test('mensagem comum é processada', () => {
    assert.equal(shouldIgnoreSystemMessage({ conversation: '!menu' }), false);
    assert.equal(shouldIgnoreSystemMessage({ extendedTextMessage: { text: 'Trabalhando no bot' } }), false);
    assert.equal(shouldIgnoreSystemMessage({ imageMessage: { caption: 'oi' } }), false);
});

test('mensagem de sistema (protocolMessage sem revogação) é ignorada', () => {
    assert.equal(shouldIgnoreSystemMessage({ protocolMessage: { type: 3 } }), true);
    assert.equal(shouldIgnoreSystemMessage({ protocolMessage: { type: 2, key: {} } }), true);
});

test('revogação é processada porque o anti-delete depende dela', () => {
    const revogacao = { protocolMessage: { type: PROTOCOL_MESSAGE_TYPE.REVOKE, key: { id: 'X' } } };

    assert.equal(isRevokeProtocolMessage(revogacao), true);
    assert.equal(shouldIgnoreSystemMessage(revogacao), false);
});

test('mensagem editada é processada', () => {
    assert.equal(
        shouldIgnoreSystemMessage({ editedMessage: { message: { conversation: 'editado' } } }),
        false
    );
});

test('solicitação de entrada em grupo (stub) é processada', () => {
    assert.equal(
        shouldIgnoreSystemMessage({ messageStubType: 172, messageStubParameters: [1] }),
        false
    );
});

test('mensagem própria (fromMe) continua sendo processada', () => {
    // fromMe é tratado em index.js como owner: o dono usa o celular dele.
    // O filtro de sistema não pode interromper esse fluxo.
    assert.equal(shouldIgnoreSystemMessage({ conversation: '!menu' }), false);
});
