import { DUAL_RENDERERS } from './dual.js';
import { SINGLE_RENDERERS } from './singles.js';
import { EXTRA_SINGLE_RENDERERS } from './singles-extra.js';

export const RENDERERS = Object.freeze({
    ...DUAL_RENDERERS,
    ...SINGLE_RENDERERS,
    ...EXTRA_SINGLE_RENDERERS
});

export function getRenderer(type) {
    return RENDERERS[type] || null;
}
