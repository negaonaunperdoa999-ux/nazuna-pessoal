import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import { ApiError, ErrorCodes } from './errors.js';

function createAgents() {
    return {
        httpAgent: new http.Agent({
            keepAlive: true,
            maxSockets: 8,
            maxFreeSockets: 4,
            timeout: 30000,
            scheduling: 'lifo'
        }),
        httpsAgent: new https.Agent({
            keepAlive: true,
            maxSockets: 8,
            maxFreeSockets: 4,
            timeout: 30000,
            scheduling: 'lifo',
            rejectUnauthorized: true
        })
    };
}

function createDefaultTransport(timeoutMs, maxBytes) {
    const { httpAgent, httpsAgent } = createAgents();

    return axios.create({
        httpAgent,
        httpsAgent,
        timeout: timeoutMs,
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        validateStatus: () => true,
        headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'NazunaBot/api'
        }
    });
}

function dataSize(data) {
    if (data === null || data === undefined) return 0;
    if (Buffer.isBuffer(data)) return data.length;
    if (data instanceof ArrayBuffer) return data.byteLength;
    if (ArrayBuffer.isView(data)) return data.byteLength;
    if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');

    try {
        return Buffer.byteLength(JSON.stringify(data), 'utf8');
    } catch {
        return 0;
    }
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

function mapTransportError(error) {
    if (error instanceof ApiError) return error;

    const code = error?.code;
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || error?.name === 'AbortError') {
        return new ApiError(ErrorCodes.TIMEOUT, { cause: error });
    }
    if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ERR_NETWORK'].includes(code)) {
        return new ApiError(ErrorCodes.NETWORK, { cause: error });
    }
    if (
        error?.message?.includes('maxContentLength')
        || error?.message?.includes('maxBodyLength')
    ) {
        return new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, { cause: error });
    }
    if (error?.response?.status) return statusError(error.response.status);

    return new ApiError(ErrorCodes.NETWORK, { cause: error });
}

export class HttpClient {
    constructor(options = {}) {
        this.timeoutMs = Math.max(1, options.timeoutMs ?? 15000);
        this.maxBytes = Math.max(1, options.maxBytes ?? 5 * 1024 * 1024);
        this.transport = options.transport || createDefaultTransport(this.timeoutMs, this.maxBytes);
    }

    async request(options = {}) {
        const {
            throwOnHttpError = true,
            timeoutMs = this.timeoutMs,
            maxBytes = this.maxBytes,
            validateStatus,
            ...requestOptions
        } = options;

        let response;
        try {
            response = await this.transport.request({
                method: 'GET',
                timeout: timeoutMs,
                maxContentLength: maxBytes,
                maxBodyLength: maxBytes,
                validateStatus: validateStatus || (() => true),
                ...requestOptions
            });
        } catch (error) {
            throw mapTransportError(error);
        }

        const declaredSize = Number(response?.headers?.['content-length'] || 0);
        const receivedSize = dataSize(response?.data);
        if (declaredSize > maxBytes || receivedSize > maxBytes) {
            throw new ApiError(ErrorCodes.PAYLOAD_TOO_LARGE, {
                details: { declaredSize, receivedSize, maxBytes }
            });
        }

        const status = Number(response?.status || 0);
        if (throwOnHttpError && status >= 400) {
            throw statusError(status);
        }

        return response;
    }

    async getText(url, options = {}) {
        const response = await this.request({
            ...options,
            url,
            method: 'GET',
            responseType: 'text'
        });
        return response;
    }

    async getJson(url, options = {}) {
        const response = await this.getText(url, options);
        if (response.data && typeof response.data === 'object') {
            return { ...response, data: response.data };
        }

        const text = String(response.data ?? '').trim();
        if (!text) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: 'Resposta JSON vazia'
            });
        }

        try {
            return { ...response, data: JSON.parse(text) };
        } catch (error) {
            throw new ApiError(ErrorCodes.UPSTREAM, {
                message: 'Resposta JSON inválida',
                cause: error
            });
        }
    }

    async getBuffer(url, options = {}) {
        const response = await this.request({
            ...options,
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        return {
            ...response,
            data: Buffer.isBuffer(response.data)
                ? response.data
                : Buffer.from(response.data ?? [])
        };
    }
}

export function createHttpClient(options = {}) {
    return new HttpClient(options);
}

export { dataSize as estimatePayloadSize };
