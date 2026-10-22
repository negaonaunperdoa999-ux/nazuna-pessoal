/**
 * Traduz o retorno do adaptador de midias sociais (downloadSocialMedia) e da
 * busca do TikTok (searchTikTok) para o payload aceito pelo Baileys.
 *
 * Contrato do Baileys (lib/Utils/messages-media.js, getStream):
 *   - Buffer cru            -> { stream: toReadable(buffer) }
 *   - { stream: Readable }  -> usado como esta
 *   - { url }               -> http/https/data URL ou caminho de arquivo
 *
 * O formato { buffer } NAO e aceito: o getStream cai no ramo `item.url.toString()`
 * e estoura com "Cannot read properties of undefined (reading 'toString')".
 */

export const DEFAULT_MEDIA_TYPE = 'video';

export const MEDIA_TYPES = Object.freeze(['video', 'audio', 'image']);

export function resolveMediaType(type) {
    const value = String(type || '').trim().toLowerCase();
    return MEDIA_TYPES.includes(value) ? value : DEFAULT_MEDIA_TYPE;
}

/**
 * @param {object} result retorno do downloader ou da busca
 * @returns {{ok: boolean, etapa?: string, msg?: string, type?: string, media?: any,
 *            mimetype?: string, fileName?: string, caption?: string, sizeBytes?: number}}
 */
export function buildSocialMediaPayload(result) {
    if (!result || typeof result !== 'object') {
        return {
            ok: false,
            etapa: 'validacao',
            msg: 'Não foi possível obter a mídia do vídeo.'
        };
    }

    if (result.ok === false) {
        return {
            ok: false,
            etapa: result.etapa || 'download',
            msg: result.msg || 'Não foi possível obter a mídia do vídeo.'
        };
    }

    const type = resolveMediaType(result.type);

    // 1) Midia ja baixada pelo adaptador: chega como Buffer.
    if (result.buffer !== undefined && result.buffer !== null) {
        if (!Buffer.isBuffer(result.buffer)) {
            return {
                ok: false,
                etapa: 'validacao',
                msg: 'A mídia baixada veio em formato inesperado.'
            };
        }

        if (result.buffer.length === 0) {
            return {
                ok: false,
                etapa: 'validacao',
                msg: 'A mídia baixada veio vazia.'
            };
        }

        return {
            ok: true,
            type,
            media: result.buffer,
            mimetype: result.mimetype || undefined,
            fileName: result.fileName || result.filename || undefined,
            caption: result.title || undefined,
            sizeBytes: result.buffer.length
        };
    }

    // 2) Busca textual: devolve URLs prontas para o WhatsApp baixar.
    const url = Array.isArray(result.urls) ? result.urls[0] : result.url;
    if (typeof url === 'string' && url.trim()) {
        return {
            ok: true,
            type,
            media: { url: url.trim() },
            mimetype: result.mimetype || undefined,
            fileName: result.fileName || result.filename || undefined,
            caption: result.title || undefined,
            sizeBytes: 0
        };
    }

    return {
        ok: false,
        etapa: 'validacao',
        msg: 'Não foi possível obter a mídia do vídeo.'
    };
}
