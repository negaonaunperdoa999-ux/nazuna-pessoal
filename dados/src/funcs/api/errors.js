export const ErrorCodes = Object.freeze({
    INPUT_INVALID: 'INPUT_INVALID',
    CONFIG_MISSING: 'CONFIG_MISSING',
    CONFIG_INVALID: 'CONFIG_INVALID',
    AUTH_INVALID: 'AUTH_INVALID',
    RATE_LIMITED: 'RATE_LIMITED',
    TIMEOUT: 'TIMEOUT',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    NETWORK: 'NETWORK',
    UPSTREAM: 'UPSTREAM',
    UNSUPPORTED: 'UNSUPPORTED',
    DEPENDENCY_MISSING: 'DEPENDENCY_MISSING',
    OVERLOADED: 'OVERLOADED',
    INTERNAL: 'INTERNAL'
});

const RECOVERABLE_CODES = new Set([
    ErrorCodes.RATE_LIMITED,
    ErrorCodes.TIMEOUT,
    ErrorCodes.NETWORK,
    ErrorCodes.UPSTREAM,
    ErrorCodes.UNSUPPORTED,
    ErrorCodes.DEPENDENCY_MISSING
]);

const USER_MESSAGES = Object.freeze({
    [ErrorCodes.INPUT_INVALID]: 'Entrada inválida.',
    [ErrorCodes.CONFIG_MISSING]: 'Configuração da API ausente.',
    [ErrorCodes.CONFIG_INVALID]: 'Configuração da API inválida.',
    [ErrorCodes.AUTH_INVALID]: 'Api-key inválida ou sem plano ativo.',
    [ErrorCodes.RATE_LIMITED]: 'Limite de uso da API atingido.',
    [ErrorCodes.TIMEOUT]: 'A API demorou demais para responder.',
    [ErrorCodes.PAYLOAD_TOO_LARGE]: 'O conteúdo excede o limite permitido.',
    [ErrorCodes.NETWORK]: 'Não foi possível conectar à API.',
    [ErrorCodes.UPSTREAM]: 'A API retornou um erro.',
    [ErrorCodes.UNSUPPORTED]: 'Recurso não suportado.',
    [ErrorCodes.DEPENDENCY_MISSING]: 'Dependência local não instalada.',
    [ErrorCodes.OVERLOADED]: 'Muitas solicitações ao mesmo tempo. Tente novamente.',
    [ErrorCodes.INTERNAL]: 'Erro interno ao processar a solicitação.'
});

export class ApiError extends Error {
    constructor(code, options = {}) {
        const userMessage = options.userMessage || USER_MESSAGES[code] || USER_MESSAGES[ErrorCodes.INTERNAL];
        super(options.message || userMessage);
        this.name = 'ApiError';
        this.code = code;
        this.userMessage = userMessage;
        this.recoverable = options.recoverable ?? RECOVERABLE_CODES.has(code);
        this.details = options.details || null;
        if (options.cause) this.cause = options.cause;
    }
}

export function inputError(message) {
    return new ApiError(ErrorCodes.INPUT_INVALID, {
        message,
        userMessage: message,
        recoverable: false
    });
}

export function toApiError(error) {
    if (error instanceof ApiError) return error;

    const code = error?.code;
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || error?.name === 'AbortError') {
        return new ApiError(ErrorCodes.TIMEOUT, { cause: error });
    }

    if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ERR_NETWORK'].includes(code)) {
        return new ApiError(ErrorCodes.NETWORK, { cause: error });
    }

    return new ApiError(ErrorCodes.INTERNAL, {
        message: error?.message || 'Erro interno ao processar a solicitação.',
        cause: error
    });
}

export function isRecoverable(error) {
    return error instanceof ApiError && error.recoverable === true;
}

export function toUserMessage(error) {
    const normalized = toApiError(error);
    return normalized.userMessage;
}
