/**
 * Regras de filtragem e de calculo do prefixo usadas no processamento de
 * mensagens (index.js).
 *
 * Motivo: com o config.json incompleto (ex.: "{}"), `config.prefixo` chega
 * indefinido e `groupPrefix.length` estoura em toda mensagem. Aqui o prefixo
 * e resolvido de forma previsivel e as mensagens de sistema do WhatsApp sao
 * identificadas sem desligar o tratamento das mensagens proprias.
 */

import { DEFAULT_CONFIG } from './defaultConfig.js';

// Tipos de protocolMessage do Baileys (0 = revogacao, usada pelo anti-delete).
export const PROTOCOL_MESSAGE_TYPE = Object.freeze({
    REVOKE: 0
});

export function isRevokeProtocolMessage(message) {
    const protocol = message?.protocolMessage;
    return Boolean(protocol) && protocol.type === PROTOCOL_MESSAGE_TYPE.REVOKE;
}

/**
 * Mensagens de sistema do WhatsApp (protocolMessage) nao tem conteudo do
 * usuario e nao geram comando: devem ser ignoradas.
 *
 * Ficam de fora:
 *  - revogacao (type 0): o anti-delete precisa do evento;
 *  - revisoes (editedMessage): o conteudo editado precisa ser processado;
 *  - stubs (messageStubType): solicitacao de entrada em grupo, tratada antes.
 */
export function shouldIgnoreSystemMessage(message) {
    if (!message || typeof message !== 'object') return true;
    if (message.messageStubType) return false;
    if (message.editedMessage) return false;
    if (!message.protocolMessage) return false;
    if (isRevokeProtocolMessage(message)) return false;
    return true;
}

/**
 * Prefixo usado para detectar comandos.
 *
 * Ordem de precedencia:
 *  1. prefixo customizado do grupo (groupData.customPrefix);
 *  2. prefixo global configurado (config.prefixo);
 *  3. prefixo padrao do bot ("!"), para nunca devolver undefined.
 */
export function resolveCommandPrefix(groupData, prefixo) {
    const custom = typeof groupData?.customPrefix === 'string' && groupData.customPrefix.trim()
        ? groupData.customPrefix
        : null;

    if (custom) return custom;

    if (typeof prefixo === 'string' && prefixo.length) return prefixo;

    return DEFAULT_CONFIG.prefixo;
}
