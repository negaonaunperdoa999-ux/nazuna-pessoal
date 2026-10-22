import {
    FONTS,
    SIZE,
    blurFilter,
    burst,
    circle,
    clipText,
    createRandom,
    escapeXml,
    fitFontSize,
    glowFilter,
    hashSeed,
    lightingFilter,
    line,
    linearGradient,
    noiseFilter,
    radialGradient,
    rect,
    shadowFilter,
    starfield,
    starPoints,
    textElement,
    textWidth
} from './shared.js';

function dualArgs(context) {
    return {
        first: String(context.parts?.[0] ?? context.query ?? '').trim(),
        second: String(context.parts?.[1] ?? context.query2 ?? '').trim()
    };
}

function grungeSpeckles(seed, colors, count = 85, options = {}) {
    const random = createRandom(seed);
    const parts = [];
    for (let index = 0; index < count; index += 1) {
        const x = random() * SIZE;
        const y = random() * SIZE;
        const radius = 1 + random() * (options.maxRadius || 7);
        const color = colors[Math.floor(random() * colors.length)];
        parts.push(circle(x, y, radius, {
            fill: color,
            opacity: (options.minOpacity || 0.04) + random() * (options.maxOpacity || 0.18)
        }));
    }
    return parts.join('');
}

function pornhub(context) {
    const { first, second } = dualArgs(context);
    const gap = 10;
    const boxPadX = 16;
    const size = fitFontSize(`${first}${second}`, 720 - gap - boxPadX * 2, { maxSize: 154, minSize: 32 });
    const firstWidth = textWidth(first, size);
    const secondWidth = textWidth(second, size);
    const total = firstWidth + gap + boxPadX * 2 + secondWidth;
    const start = SIZE / 2 - total / 2;
    const centerY = 512;
    const boxHeight = Math.round(size * 1.06);
    const boxY = centerY - boxHeight / 2;
    const boxX = start + firstWidth + gap;
    const boxWidth = secondWidth + boxPadX * 2;
    const secondStart = boxX + boxPadX;

    const defs = [
        linearGradient('ph-box', ['#ffb21a', '#ff9900', '#f78c00'], 90)
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: '#000000' }),
        `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxWidth.toFixed(1)}" height="${boxHeight}" rx="4" fill="url(#ph-box)"/>`,
        textElement({
            value: first,
            x: start + firstWidth / 2,
            y: centerY + size * 0.02,
            size,
            font: FONTS.sans,
            weight: 700,
            fill: '#f7f7f7',
            textLength: firstWidth
        }),
        textElement({
            value: second,
            x: secondStart + secondWidth / 2,
            y: centerY + size * 0.02,
            size,
            font: FONTS.sans,
            weight: 700,
            fill: '#111111',
            textLength: secondWidth
        })
    ];

    return { defs, body: body.join('') };
}

function deadpool(context) {
    const { first, second } = dualArgs(context);
    const gap = 12;
    const boxPadX = 12;
    const size = fitFontSize(`${first}${second}`, 620 - gap - boxPadX * 2, { maxSize: 154, minSize: 30, factor: 0.7 });
    const firstWidth = textWidth(first, size, { factor: 0.7 });
    const secondWidth = textWidth(second, size, { factor: 0.7 });
    const total = firstWidth + boxPadX * 2 + gap + secondWidth;
    const start = SIZE / 2 - total / 2;
    const centerY = 512;
    const boxWidth = firstWidth + boxPadX * 2;
    const boxHeight = Math.round(size * 1.02);
    const boxX = start;
    const boxY = centerY - boxHeight / 2;
    const secondStart = boxX + boxWidth + gap;
    const lineY = size * 0.59;
    const lineWidth = Math.max(3, size * 0.028);

    const defs = [
        linearGradient('dp-red', ['#ff2020', '#e00000', '#b40000'], 90),
        linearGradient('dp-vignette', ['#090909', '#000000', '#000000'], 90)
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#dp-vignette)' }),
        rect(boxX, boxY, boxWidth, boxHeight, { fill: 'url(#dp-red)', rx: 1 }),
        line(secondStart, centerY - lineY, secondStart + secondWidth, centerY - lineY, {
            stroke: '#efefef',
            strokeWidth: lineWidth
        }),
        line(secondStart, centerY + lineY, secondStart + secondWidth, centerY + lineY, {
            stroke: '#efefef',
            strokeWidth: lineWidth
        }),
        textElement({
            value: first,
            x: boxX + boxPadX + firstWidth / 2,
            y: centerY + size * 0.02,
            size,
            font: FONTS.impact,
            weight: 900,
            fill: '#f4f4f4',
            textLength: firstWidth
        }),
        textElement({
            value: second,
            x: secondStart + secondWidth / 2,
            y: centerY + size * 0.02,
            size,
            font: FONTS.impact,
            weight: 900,
            fill: '#f4f4f4',
            textLength: secondWidth
        })
    ];

    return { defs, body: body.join('') };
}

function avengers(context) {
    const { first, second } = dualArgs(context);
    const random = createRandom(hashSeed(`avengers:${first}:${second}`));
    const cx = 512;
    const cy = 468;
    const radius = 360;
    const innerRadius = 300;
    const wordFit = fitFontSize(second, 630, { maxSize: 355, minSize: 48, factor: 1.02 });
    const wordSize = Math.min(355, Math.floor(wordFit * 1.16));
    const wordWidth = Math.min(630, textWidth(second, wordSize, { factor: 1.02 }));
    const wordY = 575;
    const plaqueSize = fitFontSize(first, 260, { maxSize: 34, minSize: 18 });
    const plaqueWidth = Math.min(300, textWidth(first, plaqueSize) + 36);
    const plaqueHeight = Math.max(38, plaqueSize + 14);
    const plaqueX = 512 - plaqueWidth / 2;
    const plaqueY = 390 - plaqueHeight / 2;

    const randomStrokes = [];
    for (let index = 0; index < 45; index += 1) {
        const x = 140 + random() * 744;
        const y = 120 + random() * 800;
        const length = 8 + random() * 56;
        const angle = random() * Math.PI;
        randomStrokes.push(line(
            x,
            y,
            x + Math.cos(angle) * length,
            y + Math.sin(angle) * length,
            {
                stroke: random() > 0.55 ? '#c7c2b8' : '#330000',
                strokeWidth: 0.7 + random() * 2.1,
                opacity: 0.16 + random() * 0.36
            }
        ));
    }

    const defs = [
        radialGradient('av-bg', [
            [0, '#4f0404', 0.72],
            [0.32, '#280101', 0.94],
            [0.72, '#090000', 1],
            [1, '#030000', 1]
        ], { cx: 0.44, cy: 0.3, r: 0.82 }),
        linearGradient('av-shield', ['#a70d0d', '#690303', '#3d0202', '#140000'], 115),
        linearGradient('av-stripe', ['#ab1010', '#740505', '#3f0202'], 90),
        linearGradient('av-face', ['#cd2c2c', '#a40d0d', '#720505', '#3a0202'], 105),
        linearGradient('av-metal', ['#f1eee6', '#b4afa5', '#5d5952', '#cbc6bc'], 90),
        linearGradient('av-plaque', ['#ef2020', '#b70707', '#7d0202'], 90),
        noiseFilter('av-grain', { frequency: 0.028, octaves: 4, seed: 11, slope: 0.42 }),
        lightingFilter('av-rough', { frequency: 0.012, octaves: 3, seed: 5, surfaceScale: 4, lightColor: '#ff6a5a' }),
        shadowFilter('av-shadow', { dx: 9, dy: 18, deviation: 12, color: '#000000', opacity: 0.78 }),
        blurFilter('av-soft', 24),
        `<clipPath id="av-shield-clip"><circle cx="${cx}" cy="${cy}" r="${innerRadius}"/></clipPath>`,
        `<clipPath id="av-word-clip">${textElement({
            value: second,
            x: cx,
            y: wordY,
            size: wordSize,
            font: FONTS.sansBold,
            weight: 900,
            letterSpacing: -5,
            textLength: wordWidth
        })}</clipPath>`
    ];

    const shield = [
        `<g filter="url(#av-shadow)">`,
        circle(cx, cy, radius, { fill: 'url(#av-shield)' }),
        circle(cx, cy, innerRadius, { fill: '#08090b' }),
        `<g clip-path="url(#av-shield-clip)">`,
        rect(cx - 39, cy - innerRadius, 78, innerRadius * 2, { fill: 'url(#av-stripe)' }),
        `<rect x="152" y="108" width="720" height="720" filter="url(#av-grain)" opacity="0.24"/>`,
        `<rect x="152" y="108" width="720" height="720" filter="url(#av-rough)" opacity="0.1"/>`,
        `</g>`,
        circle(cx, cy, radius - 3, { fill: 'none', stroke: 'url(#av-metal)', strokeWidth: 7, opacity: 0.8 }),
        circle(cx, cy, radius - 13, { fill: 'none', stroke: '#280101', strokeWidth: 9, opacity: 0.85 }),
        circle(cx, cy, innerRadius + 3, { fill: 'none', stroke: 'url(#av-metal)', strokeWidth: 6, opacity: 0.74 }),
        circle(cx, cy, innerRadius - 5, { fill: 'none', stroke: '#1d0101', strokeWidth: 8, opacity: 0.92 }),
        `</g>`
    ].join('');

    const face = [];
    for (let offset = 30; offset >= 4; offset -= 4) {
        face.push(textElement({
            value: second,
            x: cx + offset * 0.22,
            y: wordY + offset * 0.58,
            size: wordSize,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#360404',
            stroke: '#8d877c',
            strokeWidth: 1.4,
            letterSpacing: -5,
            textLength: wordWidth,
            opacity: 0.98
        }));
    }
    face.push(textElement({
        value: second,
        x: cx,
        y: wordY,
        size: wordSize,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'none',
        stroke: '#17100d',
        strokeWidth: 34,
        letterSpacing: -5,
        textLength: wordWidth
    }));
    face.push(textElement({
        value: second,
        x: cx + 3,
        y: wordY + 7,
        size: wordSize,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'none',
        stroke: '#8b857a',
        strokeWidth: 18,
        letterSpacing: -5,
        textLength: wordWidth
    }));
    face.push(textElement({
        value: second,
        x: cx,
        y: wordY,
        size: wordSize,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'url(#av-face)',
        stroke: 'url(#av-metal)',
        strokeWidth: 7,
        letterSpacing: -5,
        textLength: wordWidth
    }));
    face.push(textElement({
        value: second,
        x: cx,
        y: wordY,
        size: wordSize,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'url(#av-face)',
        stroke: '#5f0505',
        strokeWidth: 2,
        letterSpacing: -5,
        textLength: wordWidth
    }));
    face.push(`<g clip-path="url(#av-word-clip)">`);
    face.push(`<rect x="${cx - wordWidth / 2 - 30}" y="${wordY - wordSize * 0.6}" width="${wordWidth + 60}" height="${wordSize * 1.2}" filter="url(#av-grain)" opacity="0.62"/>`);
    for (let index = 0; index < 62; index += 1) {
        const x = cx - wordWidth / 2 + random() * wordWidth;
        const y = wordY - wordSize * 0.5 + random() * wordSize;
        if (random() > 0.58) {
            const length = 2 + random() * 24;
            face.push(line(x, y, x + length, y + (random() - 0.5) * 8, {
                stroke: random() > 0.35 ? '#e1dcd0' : '#210101',
                strokeWidth: 0.5 + random() * 1.4,
                opacity: 0.16 + random() * 0.52
            }));
        } else {
            face.push(circle(x, y, 0.8 + random() * 10, {
                fill: random() > 0.35 ? '#d8d3c7' : '#210101',
                opacity: 0.1 + random() * 0.58
            }));
        }
    }
    face.push(`<ellipse cx="${cx - wordWidth * 0.18}" cy="${wordY - wordSize * 0.39}" rx="${wordWidth * 0.36}" ry="${wordSize * 0.045}" fill="#ffffff" opacity="0.28" filter="url(#av-soft)"/>`);
    face.push('</g>');

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#av-bg)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#av-grain)" opacity="0.22"/>`,
        `<g opacity="0.24" filter="url(#av-soft)">`,
        circle(220, 220, 160, { fill: '#7f0000' }),
        circle(850, 760, 220, { fill: '#4a0000' }),
        circle(700, 160, 110, { fill: '#3d0000' }),
        `</g>`,
        grungeSpeckles(hashSeed(`avengers-bg:${first}:${second}`), ['#ea3a25', '#160000', '#5f0808', '#050000'], 70, { maxRadius: 5, maxOpacity: 0.22 }),
        randomStrokes.join(''),
        shield,
        rect(plaqueX, plaqueY, plaqueWidth, plaqueHeight, { fill: 'url(#av-plaque)', rx: 3 }),
        rect(plaqueX + 2, plaqueY + 2, plaqueWidth - 4, 2, { fill: '#ff8a7a', opacity: 0.65 }),
        textElement({
            value: first,
            x: 512,
            y: 390 + plaqueSize * 0.03,
            size: plaqueSize,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#f5f2ec'
        }),
        face.join('')
    ];

    return { defs, body: body.join('') };
}

function marvel(context) {
    const { first, second } = dualArgs(context);
    const random = createRandom(hashSeed(`marvel:${first}:${second}`));
    const size = fitFontSize(second, 780, { maxSize: 205, minSize: 42, factor: 0.94 });
    const wordWidth = 780;
    const centerY = 520;
    const transform = `translate(512 ${centerY}) skewX(-11) translate(-512 -${centerY})`;
    const plaqueSize = fitFontSize(first, 240, { maxSize: 31, minSize: 17 });
    const plaqueWidth = Math.min(280, textWidth(first, plaqueSize) + 34);
    const plaqueHeight = Math.max(44, plaqueSize + 16);
    const plaqueX = 512 - plaqueWidth / 2;
    const plaqueY = 392 - plaqueHeight / 2;

    const rays = [];
    for (let index = 0; index < 16; index += 1) {
        const angle = (Math.PI * 2 * index) / 16 + random() * 0.14;
        const inner = 100 + random() * 90;
        const outer = 470 + random() * 330;
        rays.push(line(
            512 + Math.cos(angle) * inner,
            470 + Math.sin(angle) * inner,
            512 + Math.cos(angle) * outer,
            470 + Math.sin(angle) * outer,
            {
                stroke: index % 3 === 0 ? '#8ddcff' : '#1f73c9',
                strokeWidth: 1 + random() * 3,
                opacity: 0.09 + random() * 0.19,
                filter: 'url(#mv-soft)'
            }
        ));
    }

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#mv-bg)' }),
        starfield(95, { seed: hashSeed(`marvel-stars:${first}:${second}`), maxRadius: 1.6, maxOpacity: 0.58 }),
        `<ellipse cx="512" cy="500" rx="410" ry="230" fill="#0a4e9d" opacity="0.22" filter="url(#mv-soft)"/>`,
        `<ellipse cx="512" cy="505" rx="235" ry="105" fill="#58caff" opacity="0.2" filter="url(#mv-soft)"/>`,
        `<ellipse cx="512" cy="520" rx="540" ry="8" fill="#b9edff" opacity="0.5" filter="url(#mv-glow)"/>`,
        rays.join(''),
        `<g filter="url(#mv-glow)" opacity="0.45">${textElement({
            value: second,
            x: 512,
            y: centerY,
            size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'none',
            stroke: '#1c86dd',
            strokeWidth: 18,
            textLength: wordWidth,
            transform
        })}</g>`
    ];

    for (let offset = 25; offset >= 2; offset -= 3) {
        body.push(textElement({
            value: second,
            x: 512 + offset * 0.35,
            y: centerY + offset,
            size,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#020b1d',
            stroke: '#020b1d',
            strokeWidth: 3,
            textLength: wordWidth,
            transform
        }));
    }

    body.push(textElement({
        value: second,
        x: 512,
        y: centerY,
        size,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'none',
        stroke: '#021127',
        strokeWidth: 26,
        textLength: wordWidth,
        transform
    }));
    body.push(textElement({
        value: second,
        x: 512,
        y: centerY,
        size,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'none',
        stroke: '#d9fbff',
        strokeWidth: 5,
        textLength: wordWidth,
        transform
    }));
    body.push(textElement({
        value: second,
        x: 512,
        y: centerY,
        size,
        font: FONTS.sansBold,
        weight: 900,
        fill: 'url(#mv-chrome)',
        stroke: '#07234b',
        strokeWidth: 4,
        textLength: wordWidth,
        transform
    }));
    body.push(`<g clip-path="url(#mv-word-clip)">`);
    body.push(rect(80, centerY - size * 0.7, 864, size * 1.4, { fill: 'url(#mv-sheen)', opacity: 0.45 }));
    body.push(`<ellipse cx="430" cy="${centerY - size * 0.3}" rx="${wordWidth * 0.62}" ry="${size * 0.08}" fill="#ffffff" opacity="0.62" filter="url(#mv-glow)"/>`);
    body.push(`<ellipse cx="650" cy="${centerY + size * 0.32}" rx="${wordWidth * 0.54}" ry="${size * 0.035}" fill="#b8f3ff" opacity="0.32" filter="url(#mv-glow)"/>`);
    body.push('</g>');
    body.push(rect(plaqueX, plaqueY, plaqueWidth, plaqueHeight, { fill: 'url(#mv-plaque)', rx: 5, filter: 'url(#mv-shadow)' }));
    body.push(rect(plaqueX + 2, plaqueY + 2, plaqueWidth - 4, 2, { fill: '#ffb1a8', opacity: 0.72 }));
    body.push(rect(plaqueX + 2, plaqueY + plaqueHeight - 4, plaqueWidth - 4, 2, { fill: '#610000', opacity: 0.8 }));
    body.push(textElement({
        value: first,
        x: 512,
        y: 392 + plaqueSize * 0.05,
        size: plaqueSize,
        font: FONTS.sansBold,
        weight: 900,
        fill: '#fff4ee'
    }));

    const defs = [
        radialGradient('mv-bg', [
            [0, '#0b376d', 0.88],
            [0.2, '#061b3d', 1],
            [0.56, '#020713', 1],
            [1, '#000105', 1]
        ], { cx: 0.5, cy: 0.43, r: 0.78 }),
        linearGradient('mv-chrome', ['#f4ffff', '#a8ecff', '#36a9e8', '#0b5db0', '#062e69', '#0c4c91', '#b6efff'], 90),
        linearGradient('mv-sheen', ['#ffffff', '#9de8ff', '#0e62b6', '#03254f'], 135),
        linearGradient('mv-plaque', ['#ff2b2b', '#d30000', '#8e0000'], 90),
        noiseFilter('mv-grain', { frequency: 0.9, octaves: 2, seed: 9, slope: 0.24 }),
        blurFilter('mv-soft', 22),
        glowFilter('mv-glow', 12),
        shadowFilter('mv-shadow', { dx: 0, dy: 7, deviation: 8, color: '#000000', opacity: 0.75 }),
        `<clipPath id="mv-word-clip">${textElement({
            value: second,
            x: 512,
            y: centerY,
            size,
            font: FONTS.sansBold,
            weight: 900,
            textLength: wordWidth,
            transform
        })}</clipPath>`
    ];

    return { defs, body: body.join('') };
}

export const DUAL_RENDERERS = Object.freeze({
    pornhub,
    deadpool,
    avengers,
    marvel
});
