import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import { randomUUID } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError, ErrorCodes } from './errors.js';

export const DEFAULT_MEDIA_TIMEOUT_MS = 120000;
export const DEFAULT_MAX_REDIRECTS = 3;
export const DEFAULT_TEMP_DIR = path.join(os.tmpdir(), 'nazuna-youtube');

function toBytes(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.floor(parsed);
}

function normalizeExtension(extension) {
    const value = String(extension || '.bin').trim().toLowerCase();
    const normalized = value.startsWith('.') ? value : `.${value}`;
    return /^\.[a-z0-9]+$/.test(normalized) ? normalized : '.bin';
}

function isPrivateIpv4(hostname) {
    const parts = hostname.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }

    const [first, second] = parts;
    return first === 0
        || first === 10
        || first === 127
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isPrivateHostname(hostname) {
    const normalized = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
    if (!normalized) return true;
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80')) return true;
    return isPrivateIpv4(normalized);
}

export function validateRemoteMediaUrl(value) {
    let url;
    try {
        url = new URL(String(value || ''));
    } catch {
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'URL de mídia inválida',
            userMessage: 'A URL de mídia retornada pelo provedor é inválida.',
            recoverable: false
        });
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'Protocolo de mídia não permitido',
            userMessage: 'A URL de mídia retornada pelo provedor não usa HTTP ou HTTPS.',
            recoverable: false
        });
    }

    if (url.username || url.password) {
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'Credenciais não permitidas na URL de mídia',
            userMessage: 'A URL de mídia retornada pelo provedor é inválida.',
            recoverable: false
        });
    }

    if (isPrivateHostname(url.hostname)) {
        throw new ApiError(ErrorCodes.INPUT_INVALID, {
            message: 'Host de mídia não permitido',
            userMessage: 'A URL de mídia retornada pelo provedor aponta para um host não permitido.',
            recoverable: false
        });
    }

    return url;
}

function statusError(status) {
    if (status === 401 || status === 403) {
        return new ApiError(ErrorCodes.AUTH_INVALID, { details: { status } });
    }
    if (status === 429) {
        return new ApiError(ErrorCodes.RATE_LIMITED, { details: { status } });
    }
    if (status === 413) {
        return new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, { details: { status } });
    }
    if (status === 404) {
        return new ApiError(ErrorCodes.UNSUPPORTED, { details: { status } });
    }
    if (status === 408) {
        return new ApiError(ErrorCodes.TIMEOUT, { details: { status } });
    }
    if (status >= 500) {
        return new ApiError(ErrorCodes.UPSTREAM, { details: { status } });
    }
    return new ApiError(ErrorCodes.UPSTREAM, {
        recoverable: false,
        details: { status }
    });
}

function abortError(signal) {
    const reason = signal?.reason;
    if (reason instanceof ApiError) return reason;
    if (reason instanceof Error && reason.name === 'AbortError') {
        return new ApiError(ErrorCodes.TIMEOUT, {
            message: 'Download cancelado',
            userMessage: 'Download cancelado.',
            recoverable: false,
            cause: reason
        });
    }
    return new ApiError(ErrorCodes.TIMEOUT, {
        message: 'Download cancelado',
        userMessage: 'Download cancelado.',
        recoverable: false,
        cause: reason
    });
}

function requestOnce(url, options) {
    return new Promise((resolve, reject) => {
        const transport = url.protocol === 'https:' ? https : http;
        const request = transport.get(url, {
            headers: options.headers,
            signal: options.signal
        }, (response) => {
            resolve(response);
        });

        request.on('error', (error) => {
            if (options.signal?.aborted) {
                reject(abortError(options.signal));
                return;
            }
            reject(error);
        });
    });
}

async function openResponse(url, options) {
    const validator = options.validateUrl || validateRemoteMediaUrl;
    const validate = (value) => {
        const result = validator(value);
        if (result instanceof URL) return result;
        return new URL(String(result || value));
    };
    let current = validate(url);

    for (let redirect = 0; redirect <= options.maxRedirects; redirect++) {
        const response = await requestOnce(current, options);
        const status = Number(response.statusCode || 0);

        if (status >= 300 && status < 400 && response.headers.location) {
            response.resume();
            if (redirect === options.maxRedirects) {
                throw new ApiError(ErrorCodes.UPSTREAM, {
                    message: 'Muitos redirecionamentos no download',
                    userMessage: 'O servidor redirecionou o download vezes demais.',
                    recoverable: false
                });
            }
            current = validate(new URL(response.headers.location, current).toString());
            continue;
        }

        if (status !== 200) {
            response.resume();
            throw statusError(status);
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        if (contentType.startsWith('text/html') || contentType.startsWith('application/json') || contentType.startsWith('text/plain')) {
            response.resume();
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: `Resposta de mídia inválida (${contentType || 'sem content-type'})`,
                userMessage: 'O servidor retornou uma resposta que não é de mídia.',
                recoverable: false
            });
        }

        return {
            response,
            finalUrl: current.toString(),
            contentType
        };
    }

    throw new ApiError(ErrorCodes.UPSTREAM, {
        message: 'Muitos redirecionamentos no download',
        userMessage: 'O servidor redirecionou o download vezes demais.',
        recoverable: false
    });
}

export async function ensureMediaTempDir(tempDir = DEFAULT_TEMP_DIR) {
    const target = tempDir || DEFAULT_TEMP_DIR;
    await fsp.mkdir(target, { recursive: true, mode: 0o700 });
    return target;
}

export async function cleanupFile(filePath) {
    if (!filePath) return;
    try {
        await fsp.rm(filePath, { force: true });
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
    }
}

export async function downloadToTemp(options = {}) {
    const maxBytes = toBytes(options.maxBytes);
    const timeoutMs = Math.max(1, Number(options.timeoutMs) || DEFAULT_MEDIA_TIMEOUT_MS);
    const maxRedirects = Math.max(0, Number(options.maxRedirects ?? DEFAULT_MAX_REDIRECTS));
    const extension = normalizeExtension(options.extension);
    const tempDir = await ensureMediaTempDir(options.tempDir || DEFAULT_TEMP_DIR);
    const finalPath = path.join(tempDir, `${randomUUID()}${extension}`);
    const partPath = `${finalPath}.part`;
    const externalSignal = options.signal;
    const controller = new AbortController();
    let timedOut = false;

    const onExternalAbort = () => {
        controller.abort(abortError(externalSignal));
    };

    if (externalSignal?.aborted) {
        throw abortError(externalSignal);
    }
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort(new ApiError(ErrorCodes.TIMEOUT, {
            message: 'Tempo limite do download excedido',
            userMessage: 'O download demorou demais para terminar.',
            recoverable: true
        }));
    }, timeoutMs);

    try {
        const opened = await openResponse(options.url, {
            headers: {
                Accept: 'audio/*, video/*, application/octet-stream, */*',
                'User-Agent': 'NazunaBot/youtube',
                ...(options.headers || {})
            },
            maxRedirects,
            signal: controller.signal,
            validateUrl: options.validateUrl
        });

        const declaredSize = Number(opened.response.headers['content-length'] || 0);
        if (maxBytes > 0 && declaredSize > maxBytes) {
            opened.response.resume();
            throw new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, {
                details: { declaredSize, maxBytes }
            });
        }

        let receivedBytes = 0;
        const limiter = new Transform({
            transform(chunk, encoding, callback) {
                receivedBytes += chunk.length;
                if (maxBytes > 0 && receivedBytes > maxBytes) {
                    callback(new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, {
                        details: { receivedBytes, maxBytes }
                    }));
                    return;
                }
                callback(null, chunk);
            }
        });

        const writeStream = fs.createWriteStream(partPath, {
            flags: 'wx',
            mode: 0o600
        });

        try {
            await pipeline(opened.response, limiter, writeStream, {
                signal: controller.signal
            });
            await fsp.rename(partPath, finalPath);
        } catch (error) {
            await cleanupFile(partPath);
            await cleanupFile(finalPath);
            throw error;
        }

        return {
            filePath: finalPath,
            sizeBytes: receivedBytes,
            contentType: opened.contentType,
            finalUrl: opened.finalUrl
        };
    } catch (error) {
        if (timedOut) {
            throw new ApiError(ErrorCodes.TIMEOUT, {
                message: 'Tempo limite do download excedido',
                userMessage: 'O download demorou demais para terminar.',
                recoverable: true,
                cause: error
            });
        }
        if (controller.signal.aborted) {
            throw abortError(controller.signal);
        }
        if (error instanceof ApiError) throw error;
        throw new ApiError(ErrorCodes.NETWORK, {
            message: error?.message || 'Falha no download',
            cause: error
        });
    } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', onExternalAbort);
        await cleanupFile(partPath).catch(() => {});
    }
}

export function createMediaSource(options = {}) {
    const filePath = options.filePath;
    const cleanupPaths = Array.isArray(options.cleanupPaths) ? options.cleanupPaths : [];
    let cleaned = false;

    return {
        filePath,
        sizeBytes: Number(options.sizeBytes || 0),
        meta: options.meta || {},
        mimetype: options.mimetype || 'application/octet-stream',
        fileName: options.fileName || path.basename(filePath || 'media.bin'),
        openStream() {
            return fs.createReadStream(filePath);
        },
        async cleanup() {
            if (cleaned) return;
            cleaned = true;
            await cleanupFile(filePath);
            for (const target of cleanupPaths) {
                if (!target) continue;
                await fsp.rm(target, { recursive: true, force: true }).catch((error) => {
                    if (error?.code !== 'ENOENT') throw error;
                });
            }
        }
    };
}
