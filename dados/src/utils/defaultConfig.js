/**
 * Configuracao padrao do bot e normalizacao do config.json.
 *
 * O config.json e criado na instalacao (launcher ou questionario) e e
 * ignorado pelo Git. Se ele ficar incompleto (por exemplo, um "{}" deixado
 * por uma execucao de teste interrompida), o bot sobe sem prefixo e qualquer
 * mensagem quebra ao calcular o comando (groupPrefix.length).
 *
 * Aqui ficam as chaves padrao, as regras de cada chave e a normalizacao usada
 * tanto pelo launcher (que repara o arquivo) quanto pelo index.js (que
 * garante que o bot nunca rode com valor obrigatorio ausente).
 */

export const DEFAULT_CONFIG = Object.freeze({
    nomedono: '',
    numerodono: '',
    nomebot: 'Nazuna',
    prefixo: '!',
    site_vex: 'https://vexapi.com.br',
    apikey_vex: '',
    github_ofc: 'https://github.com/DevTokyoVx/nazuna',
    autor: 'DevTokyoVx',
    repositorio: 'nazuna',
    modoaluguel: false,
    WA_WEB_VERSION: {
        aviso: 'Não mexa aqui, pode afetar o funcionamento do BOT.',
        value: [2, 3000, 1034740716]
    }
});

/**
 * Regras de validacao por chave: recebem o valor atual e devolvem o valor
 * valido. Um valor ausente, invalido ou do tipo errado e substituido pelo
 * padrao da chave.
 */
const CONFIG_RULES = Object.freeze({
    prefixo: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.prefixo),
    nomebot: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.nomebot),
    numerodono: (value) => (typeof value === 'string' ? value : DEFAULT_CONFIG.numerodono),
    nomedono: (value) => (typeof value === 'string' ? value : DEFAULT_CONFIG.nomedono),
    site_vex: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.site_vex),
    apikey_vex: (value) => (typeof value === 'string' ? value : DEFAULT_CONFIG.apikey_vex),
    github_ofc: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.github_ofc),
    autor: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.autor),
    repositorio: (value) => (typeof value === 'string' && value.trim() ? value : DEFAULT_CONFIG.repositorio),
    modoaluguel: (value) => (typeof value === 'boolean' ? value : DEFAULT_CONFIG.modoaluguel),
    WA_WEB_VERSION: (value) => (
        value && typeof value === 'object' && Array.isArray(value.value)
            ? value
            : DEFAULT_CONFIG.WA_WEB_VERSION
    )
});

export const CONFIG_KEYS = Object.freeze(Object.keys(DEFAULT_CONFIG));

export function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Completa um config parcial mantendo tudo o que o usuario ja configurou.
 *
 * @param {object|null|undefined} raw config lido do disco
 * @returns {{config: object, fixed: string[], invalid: string[]}}
 *   config  -> copia completa e valida
 *   fixed   -> chaves que estavam ausentes
 *   invalid -> chaves que existiam mas com tipo/valor invalido
 */
export function normalizeConfig(raw) {
    const source = isPlainObject(raw) ? raw : {};
    const config = { ...source };
    const fixed = [];
    const invalid = [];

    for (const [key, rule] of Object.entries(CONFIG_RULES)) {
        const current = source[key];

        if (current === undefined || current === null) {
            config[key] = rule(undefined);
            fixed.push(key);
            continue;
        }

        const normalized = rule(current);
        if (normalized !== current) {
            config[key] = normalized;
            invalid.push(key);
        }
    }

    return { config, fixed, invalid };
}

/**
 * Verdadeiro quando o config precisa de reparo (chave ausente ou invalida).
 */
export function needsRepair(raw) {
    const { fixed, invalid } = normalizeConfig(raw);
    return fixed.length > 0 || invalid.length > 0;
}
