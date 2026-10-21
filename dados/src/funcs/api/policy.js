import { ApiError, ErrorCodes, isRecoverable } from './errors.js';
import { getConfiguredBratProvider, getConfiguredYoutubeProvider } from './config.js';

export const PROVIDERS = Object.freeze(['local', 'vex', 'auto']);

export function normalizeProvider(value) {
    const provider = String(value ?? 'vex').trim().toLowerCase();

    if (!PROVIDERS.includes(provider)) {
        throw new ApiError(ErrorCodes.CONFIG_INVALID, {
            message: `Provedor inválido: ${provider}`,
            userMessage: `Provedor inválido: ${provider}. Use local, vex ou auto.`,
            recoverable: false
        });
    }

    return provider;
}

export function getBratProvider(config = {}, env = process.env) {
    return normalizeProvider(getConfiguredBratProvider(config, env));
}

export function getYoutubeProvider(config = {}, env = process.env) {
    return normalizeProvider(getConfiguredYoutubeProvider(config, env));
}

export function resolveProviderChain(provider) {
    const normalized = normalizeProvider(provider);
    return normalized === 'auto' ? ['local', 'vex'] : [normalized];
}

export function resolveYoutubeProviderChain(provider, options = {}) {
    const normalized = normalizeProvider(provider);
    if (normalized !== 'auto') return [normalized];
    return options.allowVexFallback === true ? ['local', 'vex'] : ['local'];
}

export function shouldFallback(provider, error, index, chain) {
    return provider === 'auto'
        && index < chain.length - 1
        && isRecoverable(error);
}
