import { getRenderer } from './renderers/index.js';

const CANVAS_SIZE = 1024;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 200;
const MAX_TEXT_LENGTH = 80;

export const ONE_TEXT_COMMANDS = Object.freeze([
    'amongus',
    'royal',
    'mascotemetal',
    'firework',
    'summerbeach',
    'cloudsky',
    'techstyle',
    'watercolor',
    'ligatures',
    'graffitistyle',
    'frozen',
    'colorful',
    'balloon',
    'multicolor',
    'metal',
    'doubleexposure',
    'mascoteneon',
    'eraser',
    'america',
    'snow',
    'sunset',
    'halloween',
    'blood',
    'hallobat',
    'cemiterio',
    'ffavatar',
    'vintage3d',
    'hollywood',
    'glitch',
    'galaxy',
    'glossy',
    'dragonfire',
    'pubgavatar',
    'comics'
]);

export const TWO_TEXT_COMMANDS = Object.freeze([
    'pornhub',
    'avengers',
    'marvel',
    'deadpool'
]);

export const LOGO_COMMANDS = Object.freeze([...ONE_TEXT_COMMANDS, ...TWO_TEXT_COMMANDS]);

export const LOGO_STYLES = Object.freeze({
    amongus: {
        bg: ['#050816', '#1e3a8a'],
        bgAngle: 135,
        decor: ['stars', 'planet', 'crewmate'],
        font: "'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#0f172a',
        fill: ['#e0f2fe', '#38bdf8'],
        stroke: '#0f172a',
        strokeWidth: 5,
        accent: '#ef4444',
        maxChars: 14
    },
    royal: {
        bg: ['#1e0b3a', '#4c1d95'],
        bgAngle: 120,
        decor: ['crown', 'starsGold'],
        font: "'Georgia', 'Times New Roman', serif",
        weight: 700,
        effect: 'metal',
        effectColor: '#3b2300',
        fill: ['#fff7d6', '#d4af37', '#8a5a00'],
        stroke: '#6b3f00',
        strokeWidth: 3,
        accent: '#fbbf24',
        maxChars: 13
    },
    mascotemetal: {
        bg: ['#111827', '#4b5563'],
        bgAngle: 90,
        decor: ['brushed', 'rivets'],
        font: "'Arial Black', 'Impact', sans-serif",
        weight: 900,
        effect: 'metal',
        effectColor: '#1f2937',
        fill: ['#f8fafc', '#64748b', '#e2e8f0', '#334155'],
        stroke: '#1f2937',
        strokeWidth: 4,
        accent: '#f87171',
        maxChars: 14
    },
    firework: {
        bg: ['#030712', '#1e1b4b'],
        bgAngle: 160,
        decor: ['stars', 'fireworks'],
        font: "'Trebuchet MS', Arial, sans-serif",
        weight: 900,
        effect: 'glow',
        glow: '#facc15',
        fill: ['#fef08a', '#f97316', '#f43f5e'],
        stroke: '#7c2d12',
        strokeWidth: 3,
        accent: '#facc15',
        maxChars: 14
    },
    summerbeach: {
        bg: ['#fef3c7', '#38bdf8'],
        bgAngle: 180,
        decor: ['sun', 'waves'],
        font: "'Segoe Script', 'Brush Script MT', cursive",
        weight: 700,
        effect: 'shadow',
        effectColor: '#0c4a6e',
        fill: ['#ffffff', '#f97316'],
        stroke: '#0c4a6e',
        strokeWidth: 4,
        accent: '#fbbf24',
        maxChars: 15
    },
    cloudsky: {
        bg: ['#7dd3fc', '#e0f2fe'],
        bgAngle: 160,
        decor: ['clouds'],
        font: "'Trebuchet MS', 'Segoe UI', sans-serif",
        weight: 900,
        effect: 'glow',
        glow: '#ffffff',
        fill: ['#ffffff', '#bae6fd'],
        stroke: '#0369a1',
        strokeWidth: 4,
        accent: '#f0f9ff',
        maxChars: 15
    },
    techstyle: {
        bg: ['#020617', '#0f172a'],
        bgAngle: 135,
        decor: ['circuit', 'scanlines'],
        font: "'Consolas', 'Courier New', monospace",
        weight: 700,
        effect: 'neon',
        glow: '#22d3ee',
        fill: ['#67e8f9', '#22d3ee'],
        stroke: '#0891b2',
        strokeWidth: 3,
        accent: '#a3e635',
        maxChars: 18
    },
    watercolor: {
        bg: ['#f8fafc', '#fef3c7'],
        bgAngle: 145,
        decor: ['paper', 'paint'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'watercolor',
        effectColor: '#db2777',
        fill: ['#db2777', '#7c3aed', '#0ea5e9'],
        stroke: '#831843',
        strokeWidth: 2,
        accent: '#f472b6',
        maxChars: 14
    },
    ligatures: {
        bg: ['#f5f0e6', '#d6c7a1'],
        bgAngle: 180,
        decor: ['paper', 'flourish'],
        font: "'Georgia', 'Times New Roman', serif",
        fontStyle: 'italic',
        weight: 700,
        effect: 'shadow',
        effectColor: '#7c2d12',
        fill: ['#2f1b0c', '#7c2d12'],
        stroke: '#d4af37',
        strokeWidth: 2,
        accent: '#b45309',
        letterSpacing: 1,
        maxChars: 16
    },
    graffitistyle: {
        bg: ['#1f2937', '#7c2d12'],
        bgAngle: 165,
        decor: ['bricks', 'splatter'],
        font: "'Impact', 'Arial Black', sans-serif",
        weight: 900,
        effect: 'comic',
        effectColor: '#111827',
        fill: ['#fef08a', '#f97316', '#ef4444'],
        stroke: '#111827',
        strokeWidth: 8,
        accent: '#22d3ee',
        maxChars: 12
    },
    frozen: {
        bg: ['#0c4a6e', '#bae6fd'],
        bgAngle: 180,
        decor: ['frost', 'snow'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'frost',
        glow: '#a5f3fc',
        fill: ['#ffffff', '#a5f3fc', '#38bdf8'],
        stroke: '#0369a1',
        strokeWidth: 4,
        accent: '#e0f2fe',
        maxChars: 12
    },
    colorful: {
        bg: ['#0f172a', '#312e81'],
        bgAngle: 135,
        decor: ['confetti'],
        font: "'Arial Black', sans-serif",
        weight: 900,
        effect: 'glow',
        glow: '#f472b6',
        fill: ['#f472b6', '#facc15', '#4ade80', '#38bdf8'],
        stroke: '#111827',
        strokeWidth: 3,
        accent: '#f97316',
        letterColors: true,
        maxChars: 12
    },
    balloon: {
        bg: ['#fdf2f8', '#bae6fd'],
        bgAngle: 160,
        decor: ['balloons', 'sparkles'],
        font: "'Comic Sans MS', 'Trebuchet MS', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#1e3a8a',
        fill: ['#ec4899', '#f59e0b', '#3b82f6'],
        stroke: '#1e3a8a',
        strokeWidth: 4,
        accent: '#f43f5e',
        letterColors: true,
        maxChars: 13
    },
    multicolor: {
        bg: ['#020617', '#111827'],
        bgAngle: 120,
        decor: ['stars', 'sparkles'],
        font: "'Arial Black', sans-serif",
        weight: 900,
        effect: 'shadow',
        effectColor: '#000000',
        fill: ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7'],
        stroke: '#000000',
        strokeWidth: 4,
        accent: '#22d3ee',
        letterColors: true,
        maxChars: 14
    },
    metal: {
        bg: ['#0f172a', '#475569'],
        bgAngle: 90,
        decor: ['brushed', 'rivets'],
        font: "'Arial Black', 'Impact', sans-serif",
        weight: 900,
        effect: 'metal',
        effectColor: '#020617',
        fill: ['#f8fafc', '#94a3b8', '#e2e8f0', '#475569'],
        stroke: '#020617',
        strokeWidth: 5,
        accent: '#cbd5e1',
        maxChars: 13
    },
    doubleexposure: {
        bg: ['#0f172a', '#334155'],
        bgAngle: 180,
        decor: ['mountains', 'fog', 'birds'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'watercolor',
        effectColor: '#e2e8f0',
        fill: ['#f8fafc', '#94a3b8'],
        stroke: '#0f172a',
        strokeWidth: 2,
        accent: '#e2e8f0',
        textOpacity: 0.88,
        maxChars: 14
    },
    mascoteneon: {
        bg: ['#111827', '#1f2937'],
        bgAngle: 145,
        decor: ['bricks', 'neonTubes'],
        font: "'Arial Black', sans-serif",
        weight: 900,
        effect: 'neon',
        glow: '#e879f9',
        fill: ['#f0abfc', '#22d3ee'],
        stroke: '#a21caf',
        strokeWidth: 5,
        accent: '#22d3ee',
        maxChars: 12
    },
    eraser: {
        bg: ['#f8fafc', '#e2e8f0'],
        bgAngle: 180,
        decor: ['paper', 'eraser'],
        font: "'Comic Sans MS', 'Segoe UI', sans-serif",
        weight: 700,
        effect: 'shadow',
        effectColor: '#94a3b8',
        fill: ['#1e293b', '#334155'],
        stroke: '#94a3b8',
        strokeWidth: 3,
        accent: '#f43f5e',
        maxChars: 16
    },
    america: {
        bg: ['#1e3a8a', '#dc2626'],
        bgAngle: 160,
        decor: ['flag', 'starsWhite'],
        font: "'Impact', 'Arial Black', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#1e3a8a',
        fill: ['#ffffff', '#f8fafc'],
        stroke: '#b91c1c',
        strokeWidth: 5,
        accent: '#fbbf24',
        maxChars: 12
    },
    snow: {
        bg: ['#0f172a', '#64748b'],
        bgAngle: 180,
        decor: ['mountains', 'snow'],
        font: "'Trebuchet MS', sans-serif",
        weight: 900,
        effect: 'frost',
        glow: '#e0f2fe',
        fill: ['#ffffff', '#e0f2fe'],
        stroke: '#93c5fd',
        strokeWidth: 4,
        accent: '#f8fafc',
        maxChars: 14
    },
    sunset: {
        bg: ['#fb923c', '#7c2d12'],
        bgAngle: 180,
        decor: ['sun', 'mountains', 'birds'],
        font: "'Georgia', serif",
        fontStyle: 'italic',
        weight: 700,
        effect: 'glow',
        glow: '#fde68a',
        fill: ['#fef3c7', '#f97316'],
        stroke: '#7c2d12',
        strokeWidth: 4,
        accent: '#fde68a',
        maxChars: 14
    },
    halloween: {
        bg: ['#2e1065', '#7c2d12'],
        bgAngle: 145,
        decor: ['moon', 'bats', 'pumpkin'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'glow',
        glow: '#fdba74',
        fill: ['#fdba74', '#f97316'],
        stroke: '#431407',
        strokeWidth: 4,
        accent: '#a3e635',
        maxChars: 13
    },
    blood: {
        bg: ['#0f0a0a', '#450a0a'],
        bgAngle: 180,
        decor: ['bloodSplatter', 'drips'],
        font: "'Impact', sans-serif",
        weight: 900,
        effect: 'shadow',
        effectColor: '#000000',
        fill: ['#dc2626', '#7f1d1d'],
        stroke: '#000000',
        strokeWidth: 6,
        accent: '#ef4444',
        maxChars: 12
    },
    hallobat: {
        bg: ['#020617', '#3b0764'],
        bgAngle: 135,
        decor: ['moon', 'bats', 'web'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'neon',
        glow: '#a855f7',
        fill: ['#e9d5ff', '#a855f7'],
        stroke: '#4c1d95',
        strokeWidth: 4,
        accent: '#f59e0b',
        maxChars: 13
    },
    cemiterio: {
        bg: ['#111827', '#4b5563'],
        bgAngle: 180,
        decor: ['moon', 'fog', 'tombstones'],
        font: "'Georgia', serif",
        weight: 700,
        effect: 'shadow',
        effectColor: '#000000',
        fill: ['#e5e7eb', '#9ca3af'],
        stroke: '#111827',
        strokeWidth: 3,
        accent: '#84cc16',
        maxChars: 13
    },
    ffavatar: {
        bg: ['#0f172a', '#7c2d12'],
        bgAngle: 145,
        decor: ['avatar', 'fireParticles'],
        font: "'Impact', 'Arial Black', sans-serif",
        weight: 900,
        effect: 'fire',
        glow: '#f97316',
        fill: ['#fef08a', '#f97316'],
        stroke: '#111827',
        strokeWidth: 5,
        accent: '#38bdf8',
        maxChars: 12
    },
    vintage3d: {
        bg: ['#1e1b4b', '#be185d'],
        bgAngle: 180,
        decor: ['synthGrid', 'sunStripes', 'stars'],
        font: "'Arial Black', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#1e1b4b',
        fill: ['#fef08a', '#f472b6', '#22d3ee'],
        stroke: '#1e1b4b',
        strokeWidth: 5,
        accent: '#facc15',
        maxChars: 12
    },
    hollywood: {
        bg: ['#111827', '#78350f'],
        bgAngle: 135,
        decor: ['marquee', 'starsGold'],
        font: "'Copperplate', 'Georgia', serif",
        weight: 700,
        effect: 'metal',
        effectColor: '#451a03',
        fill: ['#fef3c7', '#d4af37'],
        stroke: '#451a03',
        strokeWidth: 3,
        accent: '#fbbf24',
        letterSpacing: 4,
        maxChars: 14
    },
    glitch: {
        bg: ['#030712', '#0f172a'],
        bgAngle: 135,
        decor: ['scanlines', 'glitchBars'],
        font: "'Consolas', monospace",
        weight: 700,
        effect: 'glitch',
        effectColor: '#f43f5e',
        fill: ['#ffffff', '#22d3ee'],
        stroke: '#111827',
        strokeWidth: 2,
        accent: '#f43f5e',
        maxChars: 16
    },
    galaxy: {
        bg: ['#020617', '#4c1d95'],
        bgAngle: 145,
        decor: ['stars', 'nebula'],
        font: "'Segoe UI', sans-serif",
        weight: 900,
        effect: 'glow',
        glow: '#a855f7',
        fill: ['#f0abfc', '#818cf8', '#22d3ee'],
        stroke: '#312e81',
        strokeWidth: 3,
        accent: '#facc15',
        maxChars: 14
    },
    glossy: {
        bg: ['#fdf2f8', '#c7d2fe'],
        bgAngle: 150,
        decor: ['bubbles', 'sparkles'],
        font: "'Arial Rounded MT Bold', 'Comic Sans MS', sans-serif",
        weight: 900,
        effect: 'gloss',
        effectColor: '#9d174d',
        fill: ['#fb7185', '#f472b6', '#ffffff'],
        stroke: '#9d174d',
        strokeWidth: 4,
        accent: '#ffffff',
        maxChars: 13
    },
    dragonfire: {
        bg: ['#0c0a09', '#7f1d1d'],
        bgAngle: 150,
        decor: ['scales', 'dragon', 'fireParticles'],
        font: "'Georgia', serif",
        weight: 900,
        effect: 'fire',
        glow: '#f97316',
        fill: ['#fef08a', '#f97316', '#dc2626'],
        stroke: '#450a0a',
        strokeWidth: 5,
        accent: '#facc15',
        maxChars: 12
    },
    pubgavatar: {
        bg: ['#111827', '#374151'],
        bgAngle: 135,
        decor: ['avatar', 'crosshair', 'scanlines'],
        font: "'Impact', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#111827',
        fill: ['#fde68a', '#f59e0b'],
        stroke: '#111827',
        strokeWidth: 5,
        accent: '#f97316',
        maxChars: 13
    },
    comics: {
        bg: ['#fef3c7', '#f59e0b'],
        bgAngle: 180,
        decor: ['comicBurst', 'halftone'],
        font: "'Comic Sans MS', 'Arial Black', sans-serif",
        weight: 900,
        effect: 'comic',
        effectColor: '#111827',
        fill: ['#facc15', '#f97316', '#ef4444'],
        stroke: '#111827',
        strokeWidth: 12,
        accent: '#3b82f6',
        maxChars: 12
    },
    pornhub: {
        bg: ['#000000', '#141414'],
        bgAngle: 90,
        decor: ['pornhubBox'],
        font: "'Arial Black', sans-serif",
        weight: 900,
        effect: 'none',
        fill: ['#f97316', '#ffffff'],
        strokeWidth: 0,
        accent: '#f97316',
        maxChars: 18,
        dual: {
            layout: 'inline',
            firstFill: '#f97316',
            secondFill: '#ffffff',
            gap: 2
        }
    },
    avengers: {
        bg: ['#0b1220', '#1e3a8a'],
        bgAngle: 135,
        decor: ['stars', 'avengersA'],
        font: "'Impact', sans-serif",
        weight: 900,
        effect: 'metal',
        effectColor: '#020617',
        fill: ['#e2e8f0', '#94a3b8'],
        stroke: '#020617',
        strokeWidth: 5,
        accent: '#facc15',
        maxChars: 15,
        dual: {
            layout: 'stacked',
            firstFill: ['#f8fafc', '#64748b'],
            secondFill: ['#ef4444', '#b91c1c'],
            secondScale: 0.66,
            gap: 32
        }
    },
    marvel: {
        bg: ['#b91c1c', '#7f1d1d'],
        bgAngle: 135,
        decor: ['comicBurst', 'halftone'],
        font: "'Impact', sans-serif",
        weight: 900,
        effect: 'comic',
        effectColor: '#000000',
        fill: ['#ffffff', '#f8fafc'],
        stroke: '#000000',
        strokeWidth: 10,
        accent: '#fef08a',
        maxChars: 14,
        dual: {
            layout: 'stacked',
            firstFill: '#ffffff',
            secondFill: '#fef08a',
            secondScale: 0.66,
            gap: 38
        }
    },
    deadpool: {
        bg: ['#450a0a', '#111827'],
        bgAngle: 145,
        decor: ['bloodSplatter', 'deadpoolEyes'],
        font: "'Impact', sans-serif",
        weight: 900,
        effect: '3d',
        effectColor: '#000000',
        fill: ['#ffffff', '#ef4444'],
        stroke: '#000000',
        strokeWidth: 7,
        accent: '#ef4444',
        maxChars: 14,
        dual: {
            layout: 'stacked',
            firstFill: '#ffffff',
            secondFill: '#ef4444',
            secondScale: 0.66,
            gap: 34
        }
    }
});

const cache = new Map();
let sharpPromise;

function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

function splitGraphemes(value) {
    const text = String(value);
    if (typeof Intl?.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter('pt', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text), (item) => item.segment);
    }
    return Array.from(text);
}

function wrapText(value, maxChars) {
    const paragraphs = String(value).replace(/\r\n?/g, '\n').split('\n');
    const limit = Math.max(4, Number(maxChars) || 14);
    const lines = [];

    for (const paragraph of paragraphs) {
        const graphemes = splitGraphemes(paragraph);
        if (graphemes.length === 0) {
            lines.push('');
            continue;
        }

        let current = [];
        for (const grapheme of graphemes) {
            if (current.length >= limit) {
                lines.push(current.join('').trimEnd());
                current = [];
            }
            current.push(grapheme);
        }

        if (current.length > 0) lines.push(current.join('').trimEnd());
    }

    return lines.length > 0 ? lines : [''];
}

function gradientDef(id, colors, angle = 135) {
    const radians = (Number(angle) || 135) * Math.PI / 180;
    const dx = Math.cos(radians) * 0.5;
    const dy = Math.sin(radians) * 0.5;
    const stops = colors.map((color, index) => {
        const offset = colors.length === 1 ? 0 : index / (colors.length - 1);
        return `<stop offset="${(offset * 100).toFixed(2)}%" stop-color="${escapeXml(color)}"/>`;
    }).join('');

    return `<linearGradient id="${id}" x1="${(0.5 - dx).toFixed(4)}" y1="${(0.5 - dy).toFixed(4)}" x2="${(0.5 + dx).toFixed(4)}" y2="${(0.5 + dy).toFixed(4)}">${stops}</linearGradient>`;
}

function fillValue(value, id, defs) {
    if (Array.isArray(value)) {
        if (value.length === 0) return '#ffffff';
        if (value.length === 1) return escapeXml(value[0]);
        defs.push(gradientDef(id, value));
        return `url(#${id})`;
    }
    return escapeXml(value || '#ffffff');
}

function colorList(value, fallback) {
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value || fallback];
}

function starPoints(cx, cy, outer, inner, points = 5) {
    const result = [];
    const total = points * 2;
    for (let index = 0; index < total; index += 1) {
        const radius = index % 2 === 0 ? outer : inner;
        const angle = (Math.PI / points) * index - Math.PI / 2;
        result.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
    }
    return result.join(' ');
}

function renderDecor(style, type, query) {
    const random = createRandom(hashSeed(`${type}:${query}`));
    const colors = colorList(style.fill, '#ffffff');
    const accent = style.accent || colors[0] || '#ffffff';
    const parts = [];

    for (const decor of style.decor || []) {
        if (decor === 'stars') {
            for (let index = 0; index < 58; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * 700;
                const radius = 0.8 + random() * 2.4;
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="#ffffff" opacity="${(0.2 + random() * 0.7).toFixed(2)}"/>`);
            }
        } else if (decor === 'starsGold' || decor === 'starsWhite') {
            const color = decor === 'starsGold' ? '#fbbf24' : '#ffffff';
            for (let index = 0; index < 9; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * 760;
                const size = 4 + random() * 8;
                parts.push(`<polygon points="${starPoints(x, y, size, size * 0.42)}" fill="${color}" opacity="${(0.35 + random() * 0.5).toFixed(2)}"/>`);
            }
        } else if (decor === 'planet') {
            parts.push('<circle cx="820" cy="176" r="92" fill="#7c3aed" opacity="0.35"/>');
            parts.push('<ellipse cx="820" cy="176" rx="150" ry="34" fill="none" stroke="#38bdf8" stroke-width="10" opacity="0.5" transform="rotate(-18 820 176)"/>');
        } else if (decor === 'crewmate') {
            parts.push('<g transform="translate(770 700) scale(1.5)" opacity="0.2" fill="#38bdf8">');
            parts.push('<path d="M80 20c-42 0-68 34-68 86v105c0 19 12 31 29 31 10 0 18-5 23-14 8 14 21 22 37 22s29-8 37-22c5 9 13 14 23 14 17 0 29-12 29-31V106c0-52-26-86-68-86Z"/>');
            parts.push('<path d="M95 70c24 0 40 18 40 42s-16 42-40 42-40-18-40-42 16-42 40-42Z" fill="#e0f2fe"/>');
            parts.push('</g>');
        } else if (decor === 'crown') {
            parts.push(`<path d="M390 80h244l-18 86H408Z" fill="${accent}" opacity="0.85"/>`);
            parts.push(`<path d="M390 80l35-55 40 48 47-64 47 64 40-48 35 55Z" fill="#fde68a" opacity="0.9"/>`);
        } else if (decor === 'rivets') {
            parts.push('<g fill="#cbd5e1" opacity="0.65">');
            for (const [x, y] of [[70, 70], [954, 70], [70, 954], [954, 954], [512, 62], [512, 962]]) {
                parts.push(`<circle cx="${x}" cy="${y}" r="12"/>`);
            }
            parts.push('</g>');
            parts.push('<rect x="44" y="44" width="936" height="936" fill="none" stroke="#94a3b8" stroke-width="8" opacity="0.35"/>');
        } else if (decor === 'brushed') {
            for (let index = 0; index < 45; index += 1) {
                const y = random() * CANVAS_SIZE;
                parts.push(`<rect x="0" y="${y.toFixed(1)}" width="${CANVAS_SIZE}" height="${(0.6 + random() * 2).toFixed(1)}" fill="#ffffff" opacity="${(0.02 + random() * 0.06).toFixed(2)}"/>`);
            }
        } else if (decor === 'fireworks') {
            for (const [cx, cy, radius, color] of [[190, 250, 150, '#facc15'], [820, 190, 125, '#f472b6'], [650, 430, 95, '#38bdf8']]) {
                for (let index = 0; index < 18; index += 1) {
                    const angle = (Math.PI * 2 * index) / 18;
                    const x = cx + Math.cos(angle) * radius;
                    const y = cy + Math.sin(angle) * radius;
                    parts.push(`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="3" opacity="0.45"/>`);
                    parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${color}" opacity="0.8"/>`);
                }
            }
        } else if (decor === 'sun' || decor === 'sunStripes') {
            parts.push(`<circle cx="790" cy="245" r="112" fill="${accent}" opacity="0.62"/>`);
            if (decor === 'sunStripes') {
                for (let index = 0; index < 6; index += 1) {
                    parts.push(`<rect x="650" y="${270 + index * 18}" width="280" height="5" fill="#1e1b4b" opacity="0.55"/>`);
                }
            }
        } else if (decor === 'waves') {
            parts.push(`<path d="M0 810c120-56 220-56 340 0s220 56 340 0 220-56 344 0v214H0Z" fill="#0ea5e9" opacity="0.5"/>`);
            parts.push('<path d="M0 870c120-46 220-46 340 0s220 46 340 0 220-46 344 0v154H0Z" fill="#0369a1" opacity="0.55"/>');
            parts.push('<path d="M0 930c120-35 220-35 340 0s220 35 340 0 220-35 344 0v94H0Z" fill="#fef3c7" opacity="0.55"/>');
        } else if (decor === 'clouds') {
            for (const [cx, cy, scale, opacity] of [[170, 220, 1.3, 0.45], [760, 170, 1, 0.4], [820, 700, 1.5, 0.3], [180, 760, 1.1, 0.35]]) {
                parts.push(`<g transform="translate(${cx} ${cy}) scale(${scale})" fill="#ffffff" opacity="${opacity}">`);
                parts.push('<ellipse cx="0" cy="20" rx="100" ry="48"/><ellipse cx="70" cy="0" rx="68" ry="55"/><ellipse cx="-70" cy="4" rx="60" ry="45"/>');
                parts.push('</g>');
            }
        } else if (decor === 'circuit') {
            const paths = [
                'M0 170h180v90h160v-140h210',
                'M1024 280H850V190H690v120H530',
                'M0 790h160V680h180v90h220',
                'M1024 820H870v-80H700v130H520'
            ];
            for (const path of paths) {
                parts.push(`<path d="${path}" fill="none" stroke="${accent}" stroke-width="4" opacity="0.35"/>`);
            }
            for (const [x, y] of [[180, 170], [340, 260], [550, 120], [850, 280], [690, 310], [160, 790], [340, 770], [560, 770], [870, 820], [700, 870]]) {
                parts.push(`<circle cx="${x}" cy="${y}" r="7" fill="${accent}" opacity="0.65"/>`);
            }
        } else if (decor === 'scanlines') {
            for (let y = 0; y < CANVAS_SIZE; y += 16) {
                parts.push(`<rect x="0" y="${y}" width="${CANVAS_SIZE}" height="1.5" fill="#000000" opacity="0.18"/>`);
            }
        } else if (decor === 'paper') {
            for (let y = 80; y < CANVAS_SIZE; y += 64) {
                parts.push(`<line x1="90" y1="${y}" x2="934" y2="${y}" stroke="#64748b" stroke-width="1.5" opacity="0.18"/>`);
            }
            parts.push('<line x1="140" y1="0" x2="140" y2="1024" stroke="#f43f5e" stroke-width="3" opacity="0.25"/>');
        } else if (decor === 'paint') {
            for (let index = 0; index < 12; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * CANVAS_SIZE;
                const rx = 70 + random() * 170;
                const ry = 50 + random() * 140;
                parts.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${colors[index % colors.length]}" opacity="${(0.11 + random() * 0.16).toFixed(2)}" filter="url(#soft)"/>`);
            }
        } else if (decor === 'flourish') {
            parts.push(`<path d="M90 850c130-100 260-100 390 0s260 100 390 0" fill="none" stroke="${accent}" stroke-width="5" opacity="0.45"/>`);
            parts.push(`<path d="M150 170c80-60 160-60 240 0s160 60 240 0" fill="none" stroke="${accent}" stroke-width="4" opacity="0.4"/>`);
        } else if (decor === 'bricks') {
            for (let y = 0; y < CANVAS_SIZE; y += 74) {
                parts.push(`<line x1="0" y1="${y}" x2="1024" y2="${y}" stroke="#000000" stroke-width="6" opacity="0.18"/>`);
                const offset = (Math.floor(y / 74) % 2) * 70;
                for (let x = offset; x < CANVAS_SIZE; x += 140) {
                    parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 74}" stroke="#000000" stroke-width="5" opacity="0.14"/>`);
                }
            }
        } else if (decor === 'splatter' || decor === 'bloodSplatter') {
            const palette = decor === 'bloodSplatter' ? ['#dc2626', '#7f1d1d', '#ef4444'] : [accent, '#f97316', '#22d3ee'];
            for (let index = 0; index < 26; index += 1) {
                const edge = random() < 0.5;
                const x = edge ? random() * 220 : 804 + random() * 220;
                const y = random() * CANVAS_SIZE;
                const radius = 3 + random() * 24;
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${palette[index % palette.length]}" opacity="${(0.25 + random() * 0.5).toFixed(2)}"/>`);
            }
        } else if (decor === 'frost') {
            for (const [x, y, direction] of [[90, 90, 1], [934, 100, -1], [100, 934, 1], [924, 924, -1]]) {
                parts.push(`<g stroke="#e0f2fe" stroke-width="4" opacity="0.5"><line x1="${x}" y1="${y}" x2="${x + 120 * direction}" y2="${y + 70}"/><line x1="${x}" y1="${y}" x2="${x + 60 * direction}" y2="${y + 120}"/><line x1="${x}" y1="${y}" x2="${x + 130 * direction}" y2="${y - 20}"/></g>`);
            }
        } else if (decor === 'snow') {
            for (let index = 0; index < 90; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * CANVAS_SIZE;
                const radius = 1 + random() * 4;
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="#ffffff" opacity="${(0.3 + random() * 0.6).toFixed(2)}"/>`);
            }
        } else if (decor === 'confetti' || decor === 'sparkles') {
            for (let index = 0; index < 32; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * CANVAS_SIZE;
                const color = colors[index % colors.length];
                if (decor === 'sparkles' && index % 3 === 0) {
                    parts.push(`<polygon points="${starPoints(x, y, 9, 2.5, 4)}" fill="${color}" opacity="0.75"/>`);
                } else {
                    parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(4 + random() * 8).toFixed(1)}" height="${(7 + random() * 13).toFixed(1)}" rx="2" fill="${color}" opacity="0.6" transform="rotate(${(random() * 180).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
                }
            }
        } else if (decor === 'balloons') {
            const balloonColors = ['#ec4899', '#f59e0b', '#3b82f6', '#22c55e', '#a855f7'];
            for (let index = 0; index < 6; index += 1) {
                const x = 110 + index * 165;
                const y = 130 + (index % 3) * 85;
                parts.push(`<ellipse cx="${x}" cy="${y}" rx="42" ry="55" fill="${balloonColors[index % balloonColors.length]}" opacity="0.55"/>`);
                parts.push(`<path d="M${x} ${y + 55}l-7 14h14Z" fill="${balloonColors[index % balloonColors.length]}" opacity="0.55"/>`);
                parts.push(`<path d="M${x} ${y + 69}c20 45-14 70 4 112" fill="none" stroke="#ffffff" stroke-width="2.5" opacity="0.4"/>`);
            }
        } else if (decor === 'mountains') {
            parts.push('<path d="M0 820l190-260 120 150 130-220 190 250 110-140 180 220v204H0Z" fill="#0f172a" opacity="0.55"/>');
            parts.push('<path d="M0 884l150-150 130 90 170-150 150 120 190-130 234 190v170H0Z" fill="#020617" opacity="0.45"/>');
        } else if (decor === 'fog') {
            for (const [cx, cy, rx, ry] of [[280, 780, 300, 70], [700, 850, 340, 80], [530, 930, 420, 65]]) {
                parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#cbd5e1" opacity="0.13"/>`);
            }
        } else if (decor === 'neonTubes') {
            parts.push(`<path d="M70 170h120l40 40h150" fill="none" stroke="${accent}" stroke-width="8" opacity="0.7" filter="url(#glow)"/>`);
            parts.push('<path d="M954 880H820l-45-45H620" fill="none" stroke="#e879f9" stroke-width="8" opacity="0.7" filter="url(#glow)"/>');
        } else if (decor === 'eraser') {
            parts.push('<g transform="rotate(-18 780 790)">');
            parts.push('<rect x="650" y="740" width="260" height="110" rx="18" fill="#f43f5e" opacity="0.8"/>');
            parts.push('<rect x="650" y="740" width="260" height="38" rx="18" fill="#f8fafc" opacity="0.9"/>');
            parts.push('</g>');
            for (let index = 0; index < 10; index += 1) {
                const x = 560 + random() * 340;
                const y = 820 + random() * 150;
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + random() * 4).toFixed(1)}" fill="#fda4af" opacity="0.8"/>`);
            }
        } else if (decor === 'flag') {
            const stripeColors = ['#b91c1c', '#ffffff', '#b91c1c', '#ffffff', '#b91c1c', '#ffffff', '#b91c1c'];
            stripeColors.forEach((color, index) => {
                parts.push(`<rect x="0" y="${index * 146}" width="1024" height="146" fill="${color}" opacity="0.28"/>`);
            });
            parts.push('<rect x="0" y="0" width="430" height="430" fill="#1e3a8a" opacity="0.5"/>');
            for (let index = 0; index < 16; index += 1) {
                const x = 30 + (index % 4) * 100;
                const y = 40 + Math.floor(index / 4) * 95;
                parts.push(`<polygon points="${starPoints(x, y, 15, 6)}" fill="#ffffff" opacity="0.7"/>`);
            }
        } else if (decor === 'moon') {
            parts.push('<circle cx="820" cy="190" r="98" fill="#fef3c7" opacity="0.88"/>');
            parts.push('<circle cx="790" cy="166" r="17" fill="#d6c7a1" opacity="0.7"/>');
            parts.push('<circle cx="850" cy="218" r="12" fill="#d6c7a1" opacity="0.6"/>');
            parts.push('<circle cx="800" cy="232" r="8" fill="#d6c7a1" opacity="0.55"/>');
        } else if (decor === 'bats') {
            const batPath = 'M0 0c-18-18-45-12-55 8 18-4 30 2 36 18 8-16 24-24 42-18 4-20-16-34-32-26 12-20 38-16 50 4 12-20 38-24 50-4-16-8-36 6-32 26 18-6 34 2 42 18 6-16 18-22 36-18-10-20-37-26-55-8Z';
            for (const [x, y, scale, opacity] of [[180, 170, 0.8, 0.5], [610, 120, 1.1, 0.65], [880, 290, 0.65, 0.45]]) {
                parts.push(`<path d="${batPath}" transform="translate(${x} ${y}) scale(${scale})" fill="#0f172a" opacity="${opacity}"/>`);
            }
        } else if (decor === 'pumpkin') {
            parts.push('<g transform="translate(860 830)">');
            parts.push('<ellipse cx="0" cy="0" rx="82" ry="70" fill="#f97316" opacity="0.75"/>');
            parts.push('<ellipse cx="-38" cy="0" rx="36" ry="66" fill="none" stroke="#9a3412" stroke-width="4" opacity="0.6"/><ellipse cx="38" cy="0" rx="36" ry="66" fill="none" stroke="#9a3412" stroke-width="4" opacity="0.6"/>');
            parts.push('<rect x="-9" y="-88" width="18" height="28" fill="#4d7c0f" opacity="0.8"/>');
            parts.push('</g>');
        } else if (decor === 'drips') {
            for (let index = 0; index < 7; index += 1) {
                const x = 60 + index * 145;
                parts.push(`<path d="M${x} 0v${90 + random() * 170}c0 25 40 25 40 0V0Z" fill="#7f1d1d" opacity="0.55"/>`);
            }
        } else if (decor === 'web') {
            for (let index = 0; index < 7; index += 1) {
                const angle = (Math.PI / 2) * (index / 6);
                parts.push(`<line x1="0" y1="0" x2="${(Math.cos(angle) * 390).toFixed(1)}" y2="${(Math.sin(angle) * 390).toFixed(1)}" stroke="#e2e8f0" stroke-width="2" opacity="0.25"/>`);
            }
            for (let radius = 80; radius < 400; radius += 75) {
                parts.push(`<path d="M${radius} 0A${radius} ${radius} 0 0 1 0 ${radius}" fill="none" stroke="#e2e8f0" stroke-width="2" opacity="0.22"/>`);
            }
        } else if (decor === 'tombstones') {
            for (const [x, y, width, height] of [[140, 700, 150, 210], [470, 760, 120, 160], [760, 680, 180, 240]]) {
                parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${width / 2}" fill="#64748b" opacity="0.38"/>`);
                parts.push(`<g stroke="#cbd5e1" stroke-width="5" opacity="0.35"><line x1="${x + width / 2}" y1="${y + 45}" x2="${x + width / 2}" y2="${y + height - 30}"/><line x1="${x + width * 0.25}" y1="${y + 100}" x2="${x + width * 0.75}" y2="${y + 100}"/></g>`);
            }
        } else if (decor === 'birds') {
            for (const [x, y, scale] of [[170, 300, 1], [240, 260, 0.7], [740, 340, 0.8]]) {
                parts.push(`<path d="M${x} ${y}q${12 * scale} ${-12 * scale} ${24 * scale} 0q${12 * scale} ${-12 * scale} ${24 * scale} 0" fill="none" stroke="#1e293b" stroke-width="4" opacity="0.45"/>`);
            }
        } else if (decor === 'avatar') {
            parts.push('<g transform="translate(512 512)" fill="#020617" opacity="0.25">');
            parts.push('<circle cx="0" cy="-155" r="105"/><path d="M-235 260c15-155 112-235 235-235S250 105 265 260Z"/>');
            parts.push('</g>');
        } else if (decor === 'fireParticles') {
            for (let index = 0; index < 38; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = 620 + random() * 390;
                const radius = 2 + random() * 8;
                const color = index % 3 === 0 ? '#fef08a' : index % 3 === 1 ? '#f97316' : '#ef4444';
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" opacity="${(0.35 + random() * 0.55).toFixed(2)}"/>`);
            }
        } else if (decor === 'synthGrid') {
            for (let index = 0; index < 12; index += 1) {
                const y = 620 + index * index * 3.2;
                parts.push(`<line x1="0" y1="${y}" x2="1024" y2="${y}" stroke="#22d3ee" stroke-width="2" opacity="0.35"/>`);
            }
            for (let index = -6; index <= 6; index += 1) {
                parts.push(`<line x1="512" y1="600" x2="${512 + index * 180}" y2="1024" stroke="#f472b6" stroke-width="2" opacity="0.25"/>`);
            }
        } else if (decor === 'marquee') {
            parts.push('<rect x="48" y="48" width="928" height="928" rx="18" fill="none" stroke="#fbbf24" stroke-width="10" opacity="0.55"/>');
            for (let index = 0; index < 24; index += 1) {
                const x = 80 + index * 38;
                parts.push(`<circle cx="${x}" cy="80" r="7" fill="#fef3c7" opacity="0.9"/>`);
                parts.push(`<circle cx="${x}" cy="944" r="7" fill="#fef3c7" opacity="0.9"/>`);
            }
        } else if (decor === 'glitchBars') {
            for (let index = 0; index < 14; index += 1) {
                const x = random() * 600;
                const y = random() * CANVAS_SIZE;
                const width = 80 + random() * 420;
                const color = index % 2 === 0 ? '#f43f5e' : '#22d3ee';
                parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${(2 + random() * 9).toFixed(1)}" fill="${color}" opacity="0.22"/>`);
            }
        } else if (decor === 'nebula') {
            for (const [cx, cy, rx, ry, color] of [[250, 300, 260, 140, '#7c3aed'], [780, 540, 300, 150, '#db2777'], [460, 800, 260, 130, '#2563eb']]) {
                parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="0.18" filter="url(#soft)"/>`);
            }
        } else if (decor === 'bubbles') {
            for (let index = 0; index < 14; index += 1) {
                const x = random() * CANVAS_SIZE;
                const y = random() * CANVAS_SIZE;
                const radius = 12 + random() * 45;
                parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.3"/>`);
            }
        } else if (decor === 'scales') {
            for (let row = 0; row < 6; row += 1) {
                for (let column = 0; column < 9; column += 1) {
                    const x = column * 128 + (row % 2) * 64;
                    const y = 760 + row * 52;
                    parts.push(`<path d="M${x} ${y}a64 46 0 0 0 128 0" fill="none" stroke="${accent}" stroke-width="3" opacity="0.18"/>`);
                }
            }
        } else if (decor === 'dragon') {
            parts.push('<path d="M1024 1024V570c-80 25-128 86-142 162-13 70-55 104-116 102-70-2-96 55-76 121 10 34-10 61-45 69Z" fill="#7f1d1d" opacity="0.5"/>');
            parts.push('<path d="M868 690c-34-30-24-76 18-92 30-11 49 7 58 32 17-5 34 1 43 15-20-8-35 2-42 20-13 35-50 49-77 25Z" fill="#f97316" opacity="0.45"/>');
        } else if (decor === 'crosshair') {
            parts.push('<g fill="none" stroke="#f97316" stroke-width="3" opacity="0.4"><circle cx="140" cy="180" r="80"/><circle cx="140" cy="180" r="36"/><line x1="40" y1="180" x2="240" y2="180"/><line x1="140" y1="80" x2="140" y2="280"/></g>');
            parts.push('<g fill="none" stroke="#f97316" stroke-width="3" opacity="0.32"><circle cx="874" cy="810" r="100"/><circle cx="874" cy="810" r="45"/><line x1="754" y1="810" x2="994" y2="810"/><line x1="874" y1="690" x2="874" y2="930"/></g>');
        } else if (decor === 'comicBurst') {
            const burst = [];
            for (let index = 0; index < 18; index += 1) {
                const angle = (Math.PI * 2 * index) / 18;
                const radius = index % 2 === 0 ? 430 : 300;
                burst.push(`${(512 + Math.cos(angle) * radius).toFixed(1)},${(512 + Math.sin(angle) * radius).toFixed(1)}`);
            }
            parts.push(`<polygon points="${burst.join(' ')}" fill="#facc15" opacity="0.55" stroke="#111827" stroke-width="8"/>`);
        } else if (decor === 'halftone') {
            for (let row = 0; row < 18; row += 1) {
                for (let column = 0; column < 18; column += 1) {
                    if ((row + column) % 2 === 0) continue;
                    parts.push(`<circle cx="${28 + column * 58}" cy="${28 + row * 58}" r="5" fill="#111827" opacity="0.1"/>`);
                }
            }
        } else if (decor === 'pornhubBox') {
            parts.push('<rect x="42" y="350" width="940" height="324" rx="22" fill="#000000" opacity="0.6"/>');
            parts.push(`<rect x="42" y="350" width="940" height="324" rx="22" fill="none" stroke="${accent}" stroke-width="6" opacity="0.75"/>`);
        } else if (decor === 'avengersA') {
            parts.push('<g opacity="0.14" fill="none" stroke="#f8fafc" stroke-width="18"><circle cx="512" cy="512" r="350"/></g>');
            parts.push('<path d="M430 660l82-292 82 292h-44l-22-82h-92l-22 82Zm68-124h36l-18-76Z" fill="#f8fafc" opacity="0.12"/>');
        } else if (decor === 'deadpoolEyes') {
            parts.push('<g opacity="0.3"><ellipse cx="360" cy="240" rx="78" ry="42" fill="#ffffff" transform="rotate(-14 360 240)"/><ellipse cx="664" cy="240" rx="78" ry="42" fill="#ffffff" transform="rotate(14 664 240)"/><ellipse cx="360" cy="240" rx="38" ry="22" fill="#000000" transform="rotate(-14 360 240)"/><ellipse cx="664" cy="240" rx="38" ry="22" fill="#000000" transform="rotate(14 664 240)"/></g>');
        }
    }

    return parts.join('');
}

function textContent(line, style, plain = false, overrideColor = null) {
    if (!plain && style.letterColors) {
        const palette = colorList(style.fill, '#ffffff');
        return splitGraphemes(line).map((grapheme, index) => {
            const color = palette[index % palette.length];
            return `<tspan fill="${escapeXml(color)}">${escapeXml(grapheme)}</tspan>`;
        }).join('');
    }
    if (overrideColor) return `<tspan fill="${escapeXml(overrideColor)}">${escapeXml(line)}</tspan>`;
    return escapeXml(line);
}

function inlineContent(first, second, style, plain = false, overrideColor = null) {
    if (plain) {
        const color = escapeXml(overrideColor || style.accent || '#ffffff');
        return `<tspan fill="${color}">${escapeXml(first)}</tspan><tspan fill="${color}" dx="${Number(style.dual?.gap) || 0}">${escapeXml(second)}</tspan>`;
    }

    const firstFill = style.dual?.firstFill || style.fill;
    const secondFill = style.dual?.secondFill || style.accent || '#ffffff';
    const firstColor = Array.isArray(firstFill) ? firstFill[0] : firstFill;
    const secondColor = Array.isArray(secondFill) ? secondFill[0] : secondFill;
    const gap = Number(style.dual?.gap) || 0;
    return `<tspan fill="${escapeXml(firstColor)}">${escapeXml(first)}</tspan><tspan fill="${escapeXml(secondColor)}" dx="${gap}">${escapeXml(second)}</tspan>`;
}

function computeFontSize(lines, style, maxHeight = 610, ratio = 1) {
    const longest = Math.max(1, ...lines.map((line) => splitGraphemes(line).length));
    let size = Math.min(style.maxFontSize || 190, 880 / Math.max(1, longest * 0.62));
    size *= ratio;
    let lineHeight = size * 1.12;
    if (lineHeight * Math.max(1, lines.length) > maxHeight) {
        size = maxHeight / (Math.max(1, lines.length) * 1.12);
        lineHeight = size * 1.12;
    }
    return {
        fontSize: Math.max(22, Math.floor(size)),
        lineHeight: Math.max(28, Math.round(lineHeight))
    };
}

function textAttributes(style, fontSize) {
    const attributes = [
        'text-anchor="middle"',
        'dominant-baseline="middle"',
        `font-family="${escapeXml(style.font)}"`,
        `font-size="${fontSize}"`,
        `font-weight="${style.weight || 700}"`,
        `font-style="${style.fontStyle || 'normal'}"`,
        `letter-spacing="${Number(style.letterSpacing) || 0}"`,
        'paint-order="stroke fill"',
        'stroke-linejoin="round"',
        'xml:space="preserve"'
    ];
    return attributes.join(' ');
}

function renderTextLayer({
    lines,
    inline,
    style,
    fill,
    fontSize,
    lineHeight,
    startY,
    firstFill,
    secondFill
}) {
    const mainFill = fill || '#ffffff';
    const stroke = Number(style.strokeWidth) > 0 ? style.stroke || 'none' : 'none';
    const strokeWidth = Number(style.strokeWidth) || 0;
    const opacity = Number(style.textOpacity) || 1;

    const make = ({ fillOverride = null, strokeOverride = null, strokeWidthOverride = null, xOffset = 0, yOffset = 0, plain = false, opacityOverride = null } = {}) => {
        const chosenStroke = strokeOverride ?? stroke;
        const chosenStrokeWidth = strokeWidthOverride ?? strokeWidth;
        const strokeAttribute = chosenStroke !== 'none'
            ? `stroke="${escapeXml(chosenStroke)}" stroke-width="${chosenStrokeWidth}"`
            : '';
        const opacityAttribute = opacityOverride === null ? opacity : opacityOverride;

        if (inline) {
            const content = inlineContent(inline.first, inline.second, style, plain, fillOverride);
            return `<text x="${512 + xOffset}" y="${startY + yOffset}" ${textAttributes(style, fontSize)} fill="${escapeXml(fillOverride || firstFill || mainFill)}" ${strokeAttribute} opacity="${opacityAttribute}">${content}</text>`;
        }

        return lines.map((line, index) => {
            const y = startY + index * lineHeight + yOffset;
            const content = textContent(line, style, plain, fillOverride);
            return `<text x="${512 + xOffset}" y="${y}" ${textAttributes(style, fontSize)} fill="${escapeXml(fillOverride || mainFill)}" ${strokeAttribute} opacity="${opacityAttribute}">${content}</text>`;
        }).join('');
    };

    const layers = [];

    if (style.effect === 'shadow') {
        layers.push(make({ fillOverride: style.effectColor || '#000000', xOffset: 8, yOffset: 18, plain: true, opacityOverride: 0.55 }));
    } else if (style.effect === 'glow') {
        layers.push(`<g filter="url(#glow)">${make({ fillOverride: style.glow || style.accent || '#ffffff', plain: true, opacityOverride: 0.8 })}</g>`);
    } else if (style.effect === 'neon') {
        layers.push(`<g filter="url(#glow)">${make({ fillOverride: 'none', strokeOverride: style.glow || style.accent || '#ffffff', strokeWidthOverride: 18, plain: true, opacityOverride: 0.8 })}</g>`);
        layers.push(make({ fillOverride: style.glow || style.accent || '#ffffff', xOffset: 2, yOffset: 2, plain: true, opacityOverride: 0.35 }));
    } else if (style.effect === '3d' || style.effect === 'metal') {
        const depth = style.effect === 'metal' ? 18 : 14;
        for (let offset = depth; offset > 0; offset -= 3) {
            layers.push(make({ fillOverride: style.effectColor || '#000000', strokeOverride: style.effectColor || '#000000', strokeWidthOverride: 0, xOffset: -offset * 0.55, yOffset: offset, plain: true, opacityOverride: 0.72 }));
        }
    } else if (style.effect === 'fire') {
        layers.push(`<g filter="url(#glow)">${make({ fillOverride: style.glow || '#f97316', plain: true, opacityOverride: 0.85 })}</g>`);
        layers.push(make({ fillOverride: '#450a0a', xOffset: 5, yOffset: 13, plain: true, opacityOverride: 0.7 }));
    } else if (style.effect === 'frost') {
        layers.push(`<g filter="url(#glow)">${make({ fillOverride: style.glow || '#e0f2fe', plain: true, opacityOverride: 0.62 })}</g>`);
        layers.push(make({ fillOverride: '#ffffff', xOffset: -2, yOffset: 2, plain: true, opacityOverride: 0.3 }));
    } else if (style.effect === 'glitch') {
        layers.push(make({ fillOverride: '#f43f5e', xOffset: -16, yOffset: 3, plain: true, opacityOverride: 0.5 }));
        layers.push(make({ fillOverride: '#22d3ee', xOffset: 16, yOffset: -3, plain: true, opacityOverride: 0.5 }));
        layers.push(make({ fillOverride: '#ffffff', xOffset: -3, yOffset: 8, plain: true, opacityOverride: 0.18 }));
    } else if (style.effect === 'comic') {
        layers.push(make({ fillOverride: style.effectColor || '#111827', strokeOverride: style.effectColor || '#111827', xOffset: 12, yOffset: 12, plain: true, opacityOverride: 0.85 }));
    } else if (style.effect === 'gloss') {
        layers.push(make({ fillOverride: style.effectColor || '#9d174d', xOffset: 0, yOffset: 17, plain: true, opacityOverride: 0.38 }));
        layers.push(make({ fillOverride: '#ffffff', yOffset: -9, plain: true, opacityOverride: 0.2 }));
    } else if (style.effect === 'watercolor') {
        layers.push(`<g filter="url(#soft)">${make({ fillOverride: style.effectColor || style.accent || '#ffffff', xOffset: 8, yOffset: 8, plain: true, opacityOverride: 0.32 })}</g>`);
        layers.push(make({ fillOverride: style.accent || '#ffffff', xOffset: -8, yOffset: -5, plain: true, opacityOverride: 0.16 }));
    } else if (style.effect === 'outline') {
        layers.push(make({ fillOverride: 'none', strokeOverride: style.stroke || style.accent || '#ffffff', strokeWidthOverride: Math.max(8, strokeWidth + 6), plain: true, opacityOverride: 0.9 }));
    }

    layers.push(make({ fillOverride: mainFill, plain: false }));
    return `<g>${layers.join('')}</g>`;
}

function renderDualText(style, query, query2, defs) {
    const firstLines = wrapText(query, style.maxChars);
    const secondLines = wrapText(query2, style.maxChars);
    const firstFill = fillValue(style.dual?.firstFill || style.fill, 'logo-first', defs);
    const secondFill = fillValue(style.dual?.secondFill || style.accent || '#ffffff', 'logo-second', defs);

    if (style.dual?.layout === 'inline') {
        const totalLength = splitGraphemes(query).length + splitGraphemes(query2).length + (Number(style.dual.gap) || 0);
        const { fontSize } = computeFontSize([query + query2], style);
        const adjusted = Math.max(24, Math.min(fontSize, Math.floor(880 / Math.max(1, totalLength * 0.62))));
        return renderTextLayer({
            lines: [query],
            inline: { first: query, second: query2 },
            style,
            fill: firstFill,
            firstFill,
            secondFill,
            fontSize: adjusted,
            lineHeight: adjusted,
            startY: 512
        });
    }

    const firstMetrics = computeFontSize(firstLines, style, 520);
    const secondRatio = Number(style.dual?.secondScale) || 0.66;
    const secondMetrics = computeFontSize(secondLines, style, 360, secondRatio);
    let firstSize = firstMetrics.fontSize;
    let secondSize = secondMetrics.fontSize;
    let firstLineHeight = Math.round(firstSize * 1.12);
    let secondLineHeight = Math.round(secondSize * 1.12);
    const gap = Number(style.dual?.gap) || 30;
    const totalHeight = firstLineHeight * firstLines.length + gap + secondLineHeight * secondLines.length;
    const maxHeight = 760;

    if (totalHeight > maxHeight) {
        const scale = maxHeight / totalHeight;
        firstSize = Math.max(20, Math.floor(firstSize * scale));
        secondSize = Math.max(16, Math.floor(secondSize * scale));
        firstLineHeight = Math.round(firstSize * 1.12);
        secondLineHeight = Math.round(secondSize * 1.12);
    }

    const blockHeight = firstLineHeight * firstLines.length;
    const total = blockHeight + gap + secondLineHeight * secondLines.length;
    const top = 512 - total / 2;
    const firstStart = top + firstLineHeight / 2;
    const secondStart = top + blockHeight + gap + secondLineHeight / 2;

    const firstLayer = renderTextLayer({
        lines: firstLines,
        inline: null,
        style,
        fill: firstFill,
        firstFill,
        secondFill,
        fontSize: firstSize,
        lineHeight: firstLineHeight,
        startY: firstStart
    });
    const secondLayer = renderTextLayer({
        lines: secondLines,
        inline: null,
        style,
        fill: secondFill,
        firstFill,
        secondFill,
        fontSize: secondSize,
        lineHeight: secondLineHeight,
        startY: secondStart
    });

    return `${firstLayer}${secondLayer}`;
}

export function buildLogoSvg(input = {}) {
    const type = String(input.type || '').trim().toLowerCase();
    const style = LOGO_STYLES[type];
    if (!style) throw new Error('Estilo de logotipo não encontrado.');

    const query = String(input.query ?? '').replace(/\r\n?/g, '\n').trim();
    if (!query) throw new Error('O texto é obrigatório.');
    if (splitGraphemes(query).length > MAX_TEXT_LENGTH) throw new Error(`O texto deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`);

    const isDual = TWO_TEXT_COMMANDS.includes(type);
    let query2 = '';
    if (isDual) {
        query2 = String(input.query2 ?? '').replace(/\r\n?/g, '\n').trim();
        if (!query2) throw new Error('Os dois textos são obrigatórios.');
        if (splitGraphemes(query2).length > MAX_TEXT_LENGTH) throw new Error(`Cada texto deve ter no máximo ${MAX_TEXT_LENGTH} caracteres.`);
    }

    const renderer = getRenderer(type);
    if (renderer) {
        const scene = renderer({ type, style, query, query2, parts: isDual ? [query, query2] : [query] });
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
<defs>${(scene.defs || []).join('')}</defs>
${scene.body}
</svg>`;
    }

    const defs = [
        '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="15" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
        '<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="24"/></filter>'
    ];
    const backgroundFill = fillValue(style.bg, 'logo-bg', defs);
    const textFill = fillValue(style.fill, 'logo-text', defs);

    const decor = renderDecor(style, type, `${query}:${query2}`);
    const textLayer = isDual
        ? renderDualText(style, query, query2, defs)
        : (() => {
            const lines = wrapText(query, style.maxChars);
            const { fontSize, lineHeight } = computeFontSize(lines, style);
            const totalHeight = (lines.length - 1) * lineHeight;
            const startY = 512 - totalHeight / 2;
            return renderTextLayer({
                lines,
                inline: null,
                style,
                fill: textFill,
                fontSize,
                lineHeight,
                startY
            });
        })();

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
<defs>${defs.join('')}</defs>
<rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${backgroundFill}"/>
${decor}
${textLayer}
</svg>`;
}

async function loadSharp() {
    if (!sharpPromise) {
        sharpPromise = import('sharp')
            .then((module) => module.default || module)
            .catch((error) => {
                sharpPromise = null;
                throw new Error(`sharp não está instalado ou não pôde ser carregado: ${error.message}`);
            });
    }
    return sharpPromise;
}

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.value;
}

function setCached(key, value) {
    if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(key, { value, createdAt: Date.now() });
}

export async function generateLocalLogo({ query, query2, type }, options = {}) {
    const styleName = String(type || '').trim().toLowerCase();
    if (!LOGO_STYLES[styleName]) {
        return { ok: false, msg: '❌ Estilo de logotipo não encontrado.' };
    }

    try {
        const cacheKey = `${styleName}:${String(query ?? '')}:${String(query2 ?? '')}`;
        const cached = getCached(cacheKey);
        if (cached) return { ...cached, cached: true };

        const svg = buildLogoSvg({ query, query2, type: styleName });
        const sharp = options.sharpImpl || await loadSharp();
        const buffer = await sharp(Buffer.from(svg, 'utf8'))
            .png({ compressionLevel: 8, adaptiveFiltering: true })
            .toBuffer();

        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
            return { ok: false, msg: '❌ O gerador local não produziu uma imagem válida.' };
        }

        const result = {
            ok: true,
            type: 'image',
            mimetype: 'image/png',
            provider: 'local',
            style: styleName,
            fileName: `logo-${styleName}.png`,
            sizeBytes: buffer.length,
            buffer
        };
        setCached(cacheKey, result);
        return result;
    } catch (error) {
        return { ok: false, msg: `❌ Erro ao gerar o logotipo local: ${error.message}` };
    }
}

export function isImageBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    const head6 = buffer.subarray(0, 6).toString('latin1');
    if (head6 === 'GIF87a' || head6 === 'GIF89a') return true;
    if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return true;
    return false;
}
