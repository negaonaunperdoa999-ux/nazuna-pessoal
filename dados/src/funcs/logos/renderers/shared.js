export const SIZE = 1024;

export const FONTS = Object.freeze({
    sans: "'Arial', 'Liberation Sans', 'Segoe UI', sans-serif",
    sansBold: "'Arial Black', 'Arial', 'Liberation Sans', sans-serif",
    condensed: "'Arial Narrow', 'Liberation Sans Narrow', 'Arial', sans-serif",
    impact: "'Impact', 'Arial Black', sans-serif",
    serif: "'Georgia', 'Times New Roman', serif",
    display: "'Palatino Linotype', 'Georgia', serif",
    script: "'Segoe Script', 'Brush Script MT', cursive",
    hand: "'Comic Sans MS', 'Segoe Print', cursive",
    mono: "'Consolas', 'Courier New', monospace",
    tech: "'Bahnschrift', 'Segoe UI', sans-serif",
    blackletter: "'Palatino Linotype', 'Georgia', serif"
});

const WIDTHS = Object.freeze({
    ' ': 0.3,
    '!': 0.3,
    '"': 0.36,
    '#': 0.56,
    '$': 0.56,
    '%': 0.89,
    '&': 0.67,
    "'": 0.19,
    '(': 0.33,
    ')': 0.33,
    '*': 0.39,
    '+': 0.6,
    ',': 0.28,
    '-': 0.33,
    '.': 0.28,
    '/': 0.28,
    ':': 0.28,
    ';': 0.28,
    '<': 0.6,
    '=': 0.6,
    '>': 0.6,
    '?': 0.56,
    '@': 1.01,
    '[': 0.33,
    '\\': 0.28,
    ']': 0.33,
    '^': 0.47,
    '_': 0.56,
    '`': 0.33,
    '{': 0.35,
    '|': 0.26,
    '}': 0.35,
    '~': 0.6,
    A: 0.72,
    B: 0.72,
    C: 0.72,
    D: 0.72,
    E: 0.67,
    F: 0.61,
    G: 0.78,
    H: 0.72,
    I: 0.28,
    J: 0.56,
    K: 0.72,
    L: 0.56,
    M: 0.89,
    N: 0.72,
    O: 0.78,
    P: 0.67,
    Q: 0.78,
    R: 0.72,
    S: 0.67,
    T: 0.61,
    U: 0.72,
    V: 0.67,
    W: 0.94,
    X: 0.67,
    Y: 0.67,
    Z: 0.61,
    a: 0.56,
    b: 0.56,
    c: 0.5,
    d: 0.56,
    e: 0.56,
    f: 0.28,
    g: 0.56,
    h: 0.56,
    i: 0.22,
    j: 0.22,
    k: 0.5,
    l: 0.22,
    m: 0.83,
    n: 0.56,
    o: 0.56,
    p: 0.56,
    q: 0.56,
    r: 0.33,
    s: 0.5,
    t: 0.28,
    u: 0.56,
    v: 0.5,
    w: 0.72,
    x: 0.5,
    y: 0.5,
    z: 0.5,
    0: 0.56,
    1: 0.56,
    2: 0.56,
    3: 0.56,
    4: 0.56,
    5: 0.56,
    6: 0.56,
    7: 0.56,
    8: 0.56,
    9: 0.56
});

export function escapeXml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export function splitGraphemes(value) {
    const text = String(value);
    if (typeof Intl?.Segmenter === 'function') {
        const segmenter = new Intl.Segmenter('pt', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(text), (item) => item.segment);
    }
    return Array.from(text);
}

export function hashSeed(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

export function textWidth(value, size, options = {}) {
    const text = String(value);
    const factor = Number(options.factor) || 1;
    const spacing = Number(options.letterSpacing) || 0;
    let width = 0;
    for (const grapheme of splitGraphemes(text)) {
        width += (WIDTHS[grapheme] ?? (grapheme.codePointAt(0) > 0x2e80 ? 1 : 0.6)) * size + spacing;
    }
    return width * factor;
}

export function fitFontSize(value, maxWidth, options = {}) {
    const maxSize = Number(options.maxSize) || 220;
    const minSize = Number(options.minSize) || 24;
    const factor = Number(options.factor) || 1;
    const letterSpacing = Number(options.letterSpacing) || 0;
    const estimated = textWidth(value, 100, { factor, letterSpacing: letterSpacing * 100 });
    const natural = estimated > 0 ? (maxWidth / estimated) * 100 : maxSize;
    return Math.max(minSize, Math.min(maxSize, Math.floor(natural)));
}

export function wrapText(value, maxChars) {
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

export function fitLines(value, options = {}) {
    const lines = wrapText(value, options.maxChars || 14);
    const maxWidth = Number(options.maxWidth) || 860;
    const maxHeight = Number(options.maxHeight) || 600;
    const maxSize = Number(options.maxSize) || 220;
    const minSize = Number(options.minSize) || 24;
    const lineFactor = Number(options.lineFactor) || 1.12;
    const longest = lines.reduce((max, line) => Math.max(max, textWidth(line, 100)), 1);
    const byWidth = (maxWidth / longest) * 100;
    const byHeight = maxHeight / Math.max(1, lines.length * lineFactor);
    const size = Math.max(minSize, Math.min(maxSize, byWidth, byHeight));
    const fontSize = Math.floor(size);
    return {
        lines,
        fontSize,
        lineHeight: Math.round(fontSize * lineFactor),
        width: Math.max(...lines.map((line) => textWidth(line, fontSize)))
    };
}

export function starPoints(cx, cy, outer, inner, points = 5) {
    const result = [];
    for (let index = 0; index < points * 2; index += 1) {
        const radius = index % 2 === 0 ? outer : inner;
        const angle = (Math.PI / points) * index - Math.PI / 2;
        result.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
    }
    return result.join(' ');
}

export function linearGradient(id, colors, angle = 135) {
    const radians = (Number(angle) || 135) * Math.PI / 180;
    const dx = Math.cos(radians) * 0.5;
    const dy = Math.sin(radians) * 0.5;
    const stops = colors.map((color, index) => {
        const offset = colors.length === 1 ? 0 : index / (colors.length - 1);
        return `<stop offset="${(offset * 100).toFixed(2)}%" stop-color="${escapeXml(color)}"/>`;
    }).join('');
    return `<linearGradient id="${id}" x1="${(0.5 - dx).toFixed(4)}" y1="${(0.5 - dy).toFixed(4)}" x2="${(0.5 + dx).toFixed(4)}" y2="${(0.5 + dy).toFixed(4)}">${stops}</linearGradient>`;
}

export function radialGradient(id, stops, options = {}) {
    const cx = options.cx ?? 0.5;
    const cy = options.cy ?? 0.5;
    const r = options.r ?? 0.5;
    const body = stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${escapeXml(color)}" stop-opacity="${opacity}"/>`).join('');
    return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${body}</radialGradient>`;
}

export function textElement(options = {}) {
    const {
        value,
        x,
        y,
        size = 80,
        font = FONTS.sans,
        weight = 700,
        fill = '#ffffff',
        stroke = 'none',
        strokeWidth = 0,
        anchor = 'middle',
        letterSpacing = 0,
        italic = false,
        skewX = 0,
        opacity = 1,
        textLength,
        lengthAdjust = 'spacingAndGlyphs',
        transform,
        filter,
        className
    } = options;

    const attributes = [
        `x="${Number(x).toFixed(2)}"`,
        `y="${Number(y).toFixed(2)}"`,
        `font-family="${escapeXml(font)}"`,
        `font-size="${Number(size).toFixed(2)}"`,
        `font-weight="${escapeXml(weight)}"`,
        `font-style="${italic ? 'italic' : 'normal'}"`,
        `text-anchor="${escapeXml(anchor)}"`,
        `letter-spacing="${Number(letterSpacing).toFixed(2)}"`,
        'dominant-baseline="middle"',
        'paint-order="stroke fill"',
        'stroke-linejoin="round"',
        'stroke-linecap="round"',
        'xml:space="preserve"',
        `fill="${escapeXml(fill)}"`,
        `stroke="${escapeXml(stroke)}"`,
        `stroke-width="${Number(strokeWidth).toFixed(2)}"`,
        `opacity="${Number(opacity).toFixed(3)}"`
    ];

    if (textLength) {
        attributes.push(`textLength="${Number(textLength).toFixed(2)}"`, `lengthAdjust="${escapeXml(lengthAdjust)}"`);
    }
    if (skewX) attributes.push(`transform="skewX(${Number(skewX).toFixed(2)})"`);
    if (transform) attributes.push(`transform="${escapeXml(transform)}"`);
    if (filter) attributes.push(`filter="${escapeXml(filter)}"`);
    if (className) attributes.push(`class="${escapeXml(className)}"`);

    return `<text ${attributes.join(' ')}>${escapeXml(value)}</text>`;
}

export function noiseFilter(id, options = {}) {
    const frequency = options.frequency ?? 0.8;
    const octaves = options.octaves ?? 3;
    const seed = options.seed ?? 7;
    const slope = options.slope ?? 0.35;
    const type = options.type || 'fractalNoise';
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="${type}" baseFrequency="${frequency}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope="${slope}"/></feComponentTransfer></filter>`;
}

export function lightingFilter(id, options = {}) {
    const frequency = options.frequency ?? 0.03;
    const octaves = options.octaves ?? 4;
    const seed = options.seed ?? 12;
    const surfaceScale = options.surfaceScale ?? 7;
    const lightColor = options.lightColor || '#b9a07a';
    const azimuth = options.azimuth ?? 42;
    const elevation = options.elevation ?? 38;
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="${octaves}" seed="${seed}" result="noise"/><feDiffuseLighting in="noise" lighting-color="${escapeXml(lightColor)}" surfaceScale="${surfaceScale}"><feDistantLight azimuth="${azimuth}" elevation="${elevation}"/></feDiffuseLighting></filter>`;
}

export function turbulenceDisplacementFilter(id, options = {}) {
    const frequency = options.frequency ?? 0.014;
    const scale = options.scale ?? 28;
    const seed = options.seed ?? 9;
    return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${frequency}" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
}

export function glowFilter(id, deviation = 14) {
    return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${deviation}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}

export function blurFilter(id, deviation = 20) {
    return `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${deviation}"/></filter>`;
}

export function shadowFilter(id, options = {}) {
    const dx = options.dx ?? 8;
    const dy = options.dy ?? 12;
    const deviation = options.deviation ?? 8;
    const color = options.color || '#000000';
    const opacity = options.opacity ?? 0.65;
    return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${deviation}" flood-color="${escapeXml(color)}" flood-opacity="${opacity}"/></filter>`;
}

export function starfield(count, options = {}) {
    const random = createRandom(options.seed ?? 42);
    const width = options.width ?? SIZE;
    const height = options.height ?? SIZE;
    const color = options.color || '#ffffff';
    const maxRadius = options.maxRadius ?? 2.2;
    const maxOpacity = options.maxOpacity ?? 0.9;
    const parts = [];
    for (let index = 0; index < count; index += 1) {
        const x = random() * width;
        const y = random() * height;
        const radius = 0.5 + random() * maxRadius;
        const opacity = 0.2 + random() * maxOpacity;
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`);
    }
    return parts.join('');
}

export function burst(cx, cy, radius, color, options = {}) {
    const rays = Number(options.rays) || 28;
    const random = createRandom(options.seed ?? Math.round(cx + cy));
    const inner = options.inner ?? radius * 0.2;
    const width = options.width ?? 2.2;
    const opacity = options.opacity ?? 0.85;
    const parts = [`<g opacity="${opacity}">`];
    for (let index = 0; index < rays; index += 1) {
        const angle = (Math.PI * 2 * index) / rays + random() * 0.08;
        const end = radius * (0.65 + random() * 0.45);
        const x = cx + Math.cos(angle) * end;
        const y = cy + Math.sin(angle) * end;
        const x0 = cx + Math.cos(angle) * inner;
        const y0 = cy + Math.sin(angle) * inner;
        parts.push(`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${escapeXml(color)}" stroke-width="${(width * (0.6 + random())).toFixed(2)}" stroke-linecap="round"/>`);
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + random() * 3.6).toFixed(2)}" fill="${escapeXml(color)}"/>`);
        parts.push(`<circle cx="${(cx + Math.cos(angle) * end * 0.5).toFixed(1)}" cy="${(cy + Math.sin(angle) * end * 0.5).toFixed(1)}" r="${(1 + random() * 2).toFixed(2)}" fill="${escapeXml(color)}" opacity="0.8"/>`);
    }
    parts.push('</g>');
    return parts.join('');
}

export function paperTexture(id, options = {}) {
    const base = options.base || '#e8dfcc';
    return `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.015 0.025" numOctaves="4" seed="${options.seed ?? 4}" result="n"/><feColorMatrix in="n" type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="0.35" intercept="0.55"/><feFuncG type="linear" slope="0.33" intercept="0.52"/><feFuncB type="linear" slope="0.28" intercept="0.45"/><feFuncA type="linear" slope="1"/></feComponentTransfer></filter>`;
}

export function clipText(id, value, options = {}) {
    return `<clipPath id="${id}"><text x="${options.x ?? 512}" y="${options.y ?? 512}" font-family="${escapeXml(options.font || FONTS.sansBold)}" font-size="${options.size ?? 240}" font-weight="${options.weight ?? 900}" font-style="${options.italic ? 'italic' : 'normal'}" text-anchor="${options.anchor || 'middle'}" dominant-baseline="middle" letter-spacing="${options.letterSpacing ?? 0}" textLength="${options.textLength ?? ''}" lengthAdjust="${options.lengthAdjust || 'spacingAndGlyphs'}" ${options.transform ? `transform="${escapeXml(options.transform)}"` : ''}>${escapeXml(value)}</text></clipPath>`;
}

export function fitClipText(value, options = {}) {
    const maxWidth = options.maxWidth || 860;
    const maxSize = options.maxSize || 240;
    const minSize = options.minSize || 24;
    const size = fitFontSize(value, maxWidth, {
        maxSize,
        minSize,
        factor: options.factor || 1,
        letterSpacing: options.letterSpacing || 0
    });
    return {
        size,
        width: textWidth(value, size, { factor: options.factor || 1, letterSpacing: options.letterSpacing || 0 })
    };
}

export function rect(x, y, width, height, options = {}) {
    const attrs = [
        `x="${Number(x).toFixed(1)}"`,
        `y="${Number(y).toFixed(1)}"`,
        `width="${Number(width).toFixed(1)}"`,
        `height="${Number(height).toFixed(1)}"`
    ];
    if (options.rx) attrs.push(`rx="${Number(options.rx).toFixed(1)}"`);
    attrs.push(`fill="${escapeXml(options.fill || '#000000')}"`);
    if (options.opacity !== undefined) attrs.push(`opacity="${Number(options.opacity).toFixed(3)}"`);
    if (options.stroke) attrs.push(`stroke="${escapeXml(options.stroke)}"`, `stroke-width="${Number(options.strokeWidth || 1).toFixed(1)}"`);
    if (options.filter) attrs.push(`filter="${escapeXml(options.filter)}"`);
    if (options.transform) attrs.push(`transform="${escapeXml(options.transform)}"`);
    return `<rect ${attrs.join(' ')}/>`;
}

export function line(x1, y1, x2, y2, options = {}) {
    return `<line x1="${Number(x1).toFixed(1)}" y1="${Number(y1).toFixed(1)}" x2="${Number(x2).toFixed(1)}" y2="${Number(y2).toFixed(1)}" stroke="${escapeXml(options.stroke || '#ffffff')}" stroke-width="${Number(options.strokeWidth || 2).toFixed(2)}" opacity="${Number(options.opacity ?? 1).toFixed(3)}" ${options.filter ? `filter="${escapeXml(options.filter)}"` : ''}/>`;
}

export function circle(cx, cy, r, options = {}) {
    const attrs = [
        `cx="${Number(cx).toFixed(1)}"`,
        `cy="${Number(cy).toFixed(1)}"`,
        `r="${Number(r).toFixed(1)}"`,
        `fill="${escapeXml(options.fill || 'none')}"`
    ];
    if (options.stroke) attrs.push(`stroke="${escapeXml(options.stroke)}"`, `stroke-width="${Number(options.strokeWidth || 2).toFixed(2)}"`);
    if (options.opacity !== undefined) attrs.push(`opacity="${Number(options.opacity).toFixed(3)}"`);
    if (options.filter) attrs.push(`filter="${escapeXml(options.filter)}"`);
    if (options.transform) attrs.push(`transform="${escapeXml(options.transform)}"`);
    return `<circle ${attrs.join(' ')}/>`;
}

export function wrapScene(context, defs, body) {
    return {
        defs: (context.defs || []).concat(defs || []),
        body: `${context.body || ''}${body || ''}`
    };
}

export function textLines(options = {}) {
    const lines = options.lines || [];
    const x = options.x ?? 512;
    const startY = options.startY ?? 512;
    const lineHeight = options.lineHeight ?? 100;
    return lines.map((value, index) => textElement({
        ...options,
        value,
        x,
        y: startY + index * lineHeight
    })).join('');
}
