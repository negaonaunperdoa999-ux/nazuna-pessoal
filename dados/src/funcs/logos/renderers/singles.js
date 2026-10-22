import {
    FONTS,
    SIZE,
    blurFilter,
    burst,
    circle,
    createRandom,
    escapeXml,
    fitFontSize,
    glowFilter,
    hashSeed,
    lightingFilter,
    line,
    linearGradient,
    noiseFilter,
    paperTexture,
    radialGradient,
    rect,
    shadowFilter,
    splitGraphemes,
    starPoints,
    starfield,
    textElement,
    textWidth,
    turbulenceDisplacementFilter
} from './shared.js';

function singleText(context) {
    return String(context.query ?? context.parts?.[0] ?? '').trim();
}

function fitWord(value, maxWidth, maxSize, factor = 1) {
    const size = fitFontSize(value, maxWidth, { maxSize, minSize: 28, factor });
    return {
        size,
        width: Math.min(maxWidth, textWidth(value, size, { factor }))
    };
}

function wordClip(id, value, options = {}) {
    return `<clipPath id="${id}">${textElement({
        value,
        x: options.x ?? 512,
        y: options.y ?? 512,
        size: options.size,
        font: options.font || FONTS.sansBold,
        weight: options.weight ?? 900,
        letterSpacing: options.letterSpacing ?? 0,
        italic: options.italic,
        textLength: options.textLength,
        transform: options.transform
    })}</clipPath>`;
}

function crewmate(x, y, scale) {
    return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#101010" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">
<path d="M-126-78C-172-47-169 71-132 124L-88 114L-88-57Z" fill="#7d111a"/>
<path d="M-88 174C-126 108-124-64-68-145C-18-216 76-186 102-94C117-40 109 39 96 119L96 214L36 214L36 142L-20 142L-20 214L-84 214Z" fill="#d9242d"/>
<path d="M12-123C63-151 119-114 125-57C130-4 93 29 46 19C7 11-11-17-6-52C-3-82 0-109 12-123Z" fill="#7ee8ef"/>
<path d="M28-107C51-122 77-119 93-101" fill="none" stroke="#ffffff" stroke-width="12" opacity="0.82"/>
<path d="M-78 5C-105 19-116 47-111 71" fill="none" stroke="#a42128" stroke-width="8" opacity="0.8"/>
</g>`;
}

function amongus(context) {
    const text = singleText(context);
    const size = fitFontSize(text, 430, { maxSize: 108, minSize: 28 });
    const chars = splitGraphemes(text);
    const spacing = 2;
    const widths = chars.map((char) => textWidth(char, size) + spacing);
    const total = widths.reduce((sum, width) => sum + width, 0) - spacing;
    const start = 748 - total / 2;
    const random = createRandom(hashSeed(`amongus:${text}`));
    const letters = [];
    let cursor = start;
    for (let index = 0; index < chars.length; index += 1) {
        const char = chars[index];
        const x = cursor + widths[index] / 2;
        const y = 468 + (random() - 0.5) * 14;
        const angle = (random() - 0.5) * 5;
        letters.push(textElement({
            value: char,
            x,
            y,
            size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'none',
            stroke: '#121212',
            strokeWidth: 8,
            transform: `rotate(${angle.toFixed(2)} ${x.toFixed(1)} ${y.toFixed(1)})`
        }));
        cursor += widths[index];
    }

    const specks = [];
    for (let index = 0; index < 34; index += 1) {
        specks.push(circle(random() * SIZE, random() * SIZE, 0.7 + random() * 1.7, {
            fill: random() > 0.4 ? '#fff6a5' : '#6b5900',
            opacity: 0.2 + random() * 0.62
        }));
    }

    const defs = [
        linearGradient('am-bg', ['#ffdf10', '#f2cb00', '#e6bd00'], 135),
        noiseFilter('am-grain', { frequency: 0.16, octaves: 2, seed: 4, slope: 0.09 }),
        shadowFilter('am-shadow', { dx: 0, dy: 18, deviation: 12, color: '#b39000', opacity: 0.28 }),
        `<filter id="am-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>`
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#am-bg)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#am-grain)" opacity="0.12"/>`,
        `<ellipse cx="360" cy="820" rx="240" ry="65" fill="#b18f00" opacity="0.22" filter="url(#am-soft)"/>`,
        specks.join(''),
        `<g filter="url(#am-shadow)">${crewmate(348, 476, 1.5)}</g>`,
        letters.join('')
    ];

    return { defs, body: body.join('') };
}

function squirrelFigure() {
    return `<g transform="translate(500 530) scale(1.12)">
<path d="M-125 205C-232 190-282 115-276 28C-270-65-212-148-129-171C-67-188-13-157-13-108C-13-70-37-49-64-55C-87-60-99-79-90-95C-82-110-63-113-53-101C-43-88-49-72-62-68C-75-64-82-50-76-38C-66-15-35-3-7-18C18-32 25-58 15-80C2-108-31-119-58-100C-89-78-100-30-92 23C-81 99-24 144 43 149L-125 205Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<path d="M65 0C35 30 20 85 25 145C30 215 70 255 130 250C185 245 210 205 206 155C202 110 175 77 140 65L140 15Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<path d="M96-35L168-35L172 32L102 32Z" fill="url(#mm-silver)"/>
<circle cx="135" cy="-75" r="56" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<path d="M91-109L82-177L120-130L157-178L174-112Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4" stroke-linejoin="round"/>
<path d="M176-58C197-50 207-34 198-19C188-3 164-1 151-12C159-29 165-45 176-58Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<circle cx="158" cy="-83" r="8" fill="#242529"/>
<path d="M191-16C201-11 206-3 201 3C196 9 187 8 183 2Z" fill="#242529"/>
<path d="M65 35C45 62 45 97 57 124L88 113C76 88 79 63 94 45Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<path d="M112 220C141 238 159 258 164 281L115 281C112 260 104 242 91 229Z" fill="url(#mm-silver)" stroke="#27282b" stroke-width="4"/>
<path d="M-148 162C-103 142-62 116-26 84" fill="none" stroke="#f7f7f7" stroke-width="7" opacity="0.45"/>
</g>`;
}

function laurelBranch(direction) {
    const x0 = 512;
    const y0 = 872;
    const x1 = 512 + direction * 258;
    const y1 = 790;
    const cx = 512 + direction * 160;
    const cy = 914;
    const parts = [`<path d="M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}" fill="none" stroke="#252629" stroke-width="7"/>`];
    for (let index = 0; index < 9; index += 1) {
        const t = 0.08 + index * 0.1;
        const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * cy + t * t * y1;
        const angle = direction * (-38 - index * 9);
        parts.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="19" ry="7" fill="#2a2b2f" stroke="#111214" stroke-width="2" transform="rotate(${angle} ${x.toFixed(1)} ${y.toFixed(1)})"/>`);
        parts.push(`<ellipse cx="${x.toFixed(1)}" cy="${(y - 18).toFixed(1)}" rx="17" ry="6" fill="#303136" stroke="#111214" stroke-width="1.7" transform="rotate(${angle + direction * 32} ${x.toFixed(1)} ${(y - 18).toFixed(1)})"/>`);
    }
    return parts.join('');
}

function mascotemetal(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 500, 98, 0.95);
    const random = createRandom(hashSeed(`mascotemetal:${text}`));
    const speckles = [];
    for (let index = 0; index < 210; index += 1) {
        speckles.push(circle(random() * SIZE, random() * SIZE, 0.5 + random() * 2.2, {
            fill: random() > 0.45 ? '#b9bdc1' : '#050505',
            opacity: 0.08 + random() * 0.38
        }));
    }

    const defs = [
        radialGradient('mm-bg', [[0, '#333436', 1], [0.6, '#1b1c1e', 1], [1, '#090a0b', 1]], { cx: 0.5, cy: 0.42, r: 0.7 }),
        linearGradient('mm-silver', ['#fbfbfb', '#d9dcdf', '#a4a9ad', '#edf0f2', '#7c8186', '#d7dbde'], 125),
        radialGradient('mm-coin', [
            [0, '#f8fafb', 1],
            [0.55, '#c6cacf', 1],
            [0.82, '#84898e', 1],
            [1, '#e7eaed', 1]
        ], { cx: 0.33, cy: 0.23, r: 0.82 }),
        radialGradient('mm-inset', [[0, '#303136', 1], [0.7, '#191a1d', 1], [1, '#0d0e10', 1]], { cx: 0.5, cy: 0.45, r: 0.6 }),
        noiseFilter('mm-asphalt', { frequency: 0.36, octaves: 3, seed: 19, slope: 0.28 }),
        shadowFilter('mm-shadow', { dx: 0, dy: 28, deviation: 22, color: '#000000', opacity: 0.8 }),
        blurFilter('mm-soft', 18)
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#mm-bg)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#mm-asphalt)" opacity="0.62"/>`,
        speckles.join(''),
        `<g filter="url(#mm-shadow)">`,
        circle(512, 506, 423, { fill: 'url(#mm-coin)' }),
        circle(512, 506, 397, { fill: 'none', stroke: '#6f7479', strokeWidth: 8, opacity: 0.7 }),
        circle(512, 506, 365, { fill: 'url(#mm-inset)', stroke: '#dce0e3', strokeWidth: 8 }),
        circle(512, 506, 350, { fill: 'none', stroke: '#858a8f', strokeWidth: 4 }),
        `</g>`,
        `<ellipse cx="380" cy="250" rx="250" ry="120" fill="#ffffff" opacity="0.22" filter="url(#mm-soft)"/>`,
        `<g clip-path="url(#mm-inset-clip)">`,
        squirrelFigure(),
        `</g>`,
        `${laurelBranch(-1)}${laurelBranch(1)}`,
        `<g fill="#1c1d20" stroke="#eef0f2" stroke-width="2">`,
        `<polygon points="${starPoints(512, 900, 19, 8)}"/>`,
        `<polygon points="${starPoints(464, 912, 15, 6.5)}"/>`,
        `<polygon points="${starPoints(560, 912, 15, 6.5)}"/>`,
        `</g>`,
        textElement({
            value: text,
            x: 512,
            y: 254,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'url(#mm-silver)',
            stroke: '#141518',
            strokeWidth: 7,
            letterSpacing: 1,
            textLength: metrics.width
        }),
        textElement({
            value: text,
            x: 511,
            y: 252,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'none',
            stroke: '#f4f6f7',
            strokeWidth: 1.4,
            letterSpacing: 1,
            textLength: metrics.width,
            opacity: 0.6
        }),
        `<path d="M330 184C394 152 447 143 512 142C577 143 630 152 694 184" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.16"/>`
    ];

    defs.push(`<clipPath id="mm-inset-clip"><circle cx="512" cy="506" r="342"/></clipPath>`);
    return { defs, body: body.join('') };
}

function lionFigure(x, flip) {
    return `<g transform="translate(${x} 250) ${flip ? 'scale(-1 1)' : ''}" fill="#15130e" stroke="#75603a" stroke-width="2.4" opacity="0.92">
<path d="M78 68C104 54 114 28 104 4C94-20 70-36 46-34L55-55L32-44C22-59 5-68-14-67C-46-65-72-40-75-8C-78 16-66 40-46 52L-55 78L-34 74L-27 54C-13 62 5 63 20 56L14 82L36 77L44 59C56 58 68 54 78 48Z"/>
<path d="M-53-10C-72-18-88-7-92 9C-97 29-84 46-68 48" fill="none" stroke="#75603a" stroke-width="5" stroke-linecap="round"/>
<path d="M-14-49C-3-57 10-57 20-50" fill="none" stroke="#b49a63" stroke-width="2" opacity="0.55"/>
<path d="M-64 24L-78 34L-70 39L-58 31" fill="#75603a"/>
<circle cx="51" cy="-16" r="3.2" fill="#bda36b" stroke="none"/>
</g>`;
}

function crownFigure() {
    return `<g transform="translate(512 190)" fill="#19150d" stroke="#8a6e35" stroke-width="3">
<path d="M-92 10L-77-66L-43-26L-7-82L22-27L58-66L74 7L86 17L-86 17Z"/>
<rect x="-88" y="24" width="176" height="20" rx="5"/>
<rect x="-78" y="51" width="156" height="11" rx="4"/>
<circle cx="-77" cy="-69" r="8" fill="#b69754"/>
<circle cx="-7" cy="-87" r="9" fill="#b69754"/>
<circle cx="58" cy="-70" r="8" fill="#b69754"/>
<circle cx="0" cy="33" r="6" fill="#a88844"/>
</g>`;
}

function royalFlourish(y) {
    return `<g fill="none" stroke="#8f7439" stroke-width="4" opacity="0.75">
<path d="M118 ${y}C192 ${y - 20} 258 ${y - 20} 327 ${y + 4}C354 ${y + 15} 374 ${y + 38} 354 ${y + 48}C337 ${y + 56} 319 ${y + 40} 327 ${y + 25}C335 ${y + 10} 362 ${y + 6} 390 ${y + 7}"/>
<path d="M906 ${y}C832 ${y - 20} 766 ${y - 20} 697 ${y + 4}C670 ${y + 15} 650 ${y + 38} 670 ${y + 48}C687 ${y + 56} 705 ${y + 40} 697 ${y + 25}C689 ${y + 10} 662 ${y + 6} 634 ${y + 7}"/>
<path d="M390 ${y + 7}C440 ${y + 32} 462 ${y + 8} 510 ${y + 22}C558 ${y + 36} 580 ${y + 6} 634 ${y + 7}"/>
<path d="M240 ${y + 70}C280 ${y + 88} 318 ${y + 64} 350 ${y + 78}C382 ${y + 92} 420 ${y + 64} 455 ${y + 76}"/>
<path d="M784 ${y + 70}C744 ${y + 88} 706 ${y + 64} 674 ${y + 78}C642 ${y + 92} 604 ${y + 64} 569 ${y + 76}"/>
<circle cx="122" cy="${y - 1}" r="5" fill="#8f7439" stroke="none"/>
<circle cx="902" cy="${y - 1}" r="5" fill="#8f7439" stroke="none"/>
</g>`;
}

function royal(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 850, 228, 0.96);
    const wordY = 620;
    const random = createRandom(hashSeed(`royal:${text}`));
    const scratches = [];
    for (let index = 0; index < 92; index += 1) {
        const x = random() * SIZE;
        const y = random() * SIZE;
        const length = 3 + random() * 65;
        const angle = random() * Math.PI;
        scratches.push(line(x, y, x + Math.cos(angle) * length, y + Math.sin(angle) * length, {
            stroke: random() > 0.45 ? '#a9a49b' : '#050505',
            strokeWidth: 0.4 + random() * 1.4,
            opacity: 0.05 + random() * 0.22
        }));
    }

    const defs = [
        radialGradient('ry-bg', [
            [0, '#151413', 1],
            [0.44, '#0a0a09', 1],
            [1, '#010101', 1]
        ], { cx: 0.35, cy: 0.3, r: 0.85 }),
        linearGradient('ry-gold', ['#5f461b', '#c6a354', '#f3e3ac', '#9a7630', '#4d3612'], 110),
        noiseFilter('ry-grain', { frequency: 0.09, octaves: 4, seed: 13, slope: 0.3 }),
        lightingFilter('ry-stone', { frequency: 0.035, octaves: 4, seed: 3, surfaceScale: 3.2, lightColor: '#d8d4cc', azimuth: 310, elevation: 35 }),
        blurFilter('ry-soft', 22),
        glowFilter('ry-glow', 5),
        `<linearGradient id="ry-beam" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0.025"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
        `<pattern id="ry-damask" width="74" height="74" patternUnits="userSpaceOnUse">
<path d="M37 6C58 15 63 38 48 52C33 66 11 57 8 37C5 18 22 7 37 6Z" fill="none" stroke="#2d2110" stroke-width="2.6"/>
<path d="M37 16C47 20 50 33 42 41C34 49 21 43 20 32C19 22 29 16 37 16Z" fill="none" stroke="#2d2110" stroke-width="1.8"/>
<circle cx="37" cy="6" r="2.5" fill="#2d2110"/>
<circle cx="8" cy="37" r="2.5" fill="#2d2110"/>
<circle cx="66" cy="37" r="2.5" fill="#2d2110"/>
</pattern>`,
        wordClip('ry-word-clip', text, {
            y: wordY,
            size: metrics.size,
            font: FONTS.display,
            weight: 700,
            letterSpacing: 5,
            textLength: metrics.width
        })
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#ry-bg)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#ry-stone)" opacity="0.11"/>`,
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#ry-grain)" opacity="0.34"/>`,
        `<polygon points="-40,-30 340,-30 640,1054 160,1054" fill="url(#ry-beam)" filter="url(#ry-soft)"/>`,
        `<ellipse cx="512" cy="510" rx="430" ry="390" fill="#000000" opacity="0.38" filter="url(#ry-soft)"/>`,
        scratches.join(''),
        `<g opacity="0.46" filter="url(#ry-glow)">${lionFigure(386, false)}${lionFigure(638, true)}</g>`,
        crownFigure(),
        `<path d="M286 268C380 236 440 264 512 240C584 264 644 236 738 268" fill="none" stroke="#8c7138" stroke-width="3" opacity="0.55"/>`,
        royalFlourish(770),
        textElement({
            value: text,
            x: 512,
            y: wordY + 12,
            size: metrics.size,
            font: FONTS.display,
            weight: 700,
            fill: '#000000',
            stroke: '#000000',
            strokeWidth: 8,
            letterSpacing: 5,
            textLength: metrics.width,
            opacity: 0.72,
            filter: 'url(#ry-glow)'
        }),
        textElement({
            value: text,
            x: 512,
            y: wordY,
            size: metrics.size,
            font: FONTS.display,
            weight: 700,
            fill: 'url(#ry-gold)',
            stroke: '#d6bc75',
            strokeWidth: 7,
            letterSpacing: 5,
            textLength: metrics.width
        }),
        `<g clip-path="url(#ry-word-clip)">`,
        rect(60, wordY - metrics.size * 0.7, 904, metrics.size * 1.4, { fill: 'url(#ry-damask)', opacity: 0.94 }),
        `<ellipse cx="390" cy="${wordY - metrics.size * 0.32}" rx="300" ry="${metrics.size * 0.05}" fill="#fff3c1" opacity="0.3" filter="url(#ry-soft)"/>`,
        `</g>`,
        textElement({
            value: text,
            x: 512,
            y: wordY,
            size: metrics.size,
            font: FONTS.display,
            weight: 700,
            fill: 'none',
            stroke: '#f2dda0',
            strokeWidth: 1.6,
            letterSpacing: 5,
            textLength: metrics.width,
            opacity: 0.7
        }),
        `<path d="M120 820C240 780 350 780 512 812C674 780 784 780 904 820" fill="none" stroke="#6e5728" stroke-width="5" opacity="0.48"/>`
    ];

    return { defs, body: body.join('') };
}

function fireworkCity() {
    const random = createRandom(77123);
    const buildings = [];
    let x = -30;
    while (x < SIZE + 30) {
        const width = 32 + random() * 66;
        const height = 64 + random() * 196;
        const y = 928 - height;
        const tone = 8 + Math.floor(random() * 14);
        buildings.push(rect(x, y, width, height + 40, { fill: `rgb(${tone},${tone + 5},${tone + 16})` }));
        const columns = Math.max(2, Math.floor(width / 14));
        const rows = Math.max(4, Math.floor(height / 22));
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                if (random() > 0.66) {
                    const color = random() > 0.82 ? '#ff5c8a' : random() > 0.55 ? '#66e3ff' : '#ffd166';
                    buildings.push(rect(
                        x + 7 + column * ((width - 12) / columns),
                        y + 12 + row * ((height - 18) / rows),
                        3 + random() * 3,
                        2.5 + random() * 2,
                        { fill: color, opacity: 0.35 + random() * 0.55 }
                    ));
                }
            }
        }
        if (random() > 0.62) {
            const color = random() > 0.5 ? '#ff3f8f' : '#39d9ff';
            buildings.push(rect(x + width * 0.2, y + 25, width * 0.6, 5, { fill: color, opacity: 0.75 }));
        }
        x += width + 3 + random() * 12;
    }
    buildings.push(rect(476, 716, 88, 224, { fill: '#1a1d2a' }));
    buildings.push(rect(488, 682, 64, 38, { fill: '#262a3a' }));
    buildings.push(`<polygon points="520,636 529,692 511,692" fill="#353a50"/>`);
    buildings.push(rect(502, 732, 7, 190, { fill: '#ffd166', opacity: 0.3 }));
    for (let index = 0; index < 11; index += 1) {
        buildings.push(line(502, 740 + index * 17, 507, 740 + index * 17, { stroke: '#ffe3a0', strokeWidth: 2, opacity: 0.55 }));
    }
    return buildings.join('');
}

function fireworkBurst(cx, cy, radius, color, seed) {
    const random = createRandom(seed);
    const parts = [`<g opacity="0.78">`];
    for (let index = 0; index < 96; index += 1) {
        const angle = random() * Math.PI * 2;
        const inner = radius * (0.14 + random() * 0.06);
        const end = radius * (0.45 + random() * 0.62);
        const x0 = cx + Math.cos(angle) * inner;
        const y0 = cy + Math.sin(angle) * inner;
        const x1 = cx + Math.cos(angle) * end;
        const y1 = cy + Math.sin(angle) * end;
        parts.push(line(x0, y0, x1, y1, {
            stroke: color,
            strokeWidth: 0.5 + random() * 1.1,
            opacity: 0.4 + random() * 0.6
        }));
        parts.push(circle(x1, y1, 0.6 + random() * 1.6, { fill: color, opacity: 0.5 + random() * 0.5 }));
    }
    parts.push(circle(cx, cy, radius * 0.055, { fill: color, opacity: 0.9 }));
    parts.push('</g>');
    return parts.join('');
}

function firework(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 840, 202, 0.92);
    const wordY = 374;
    const chars = splitGraphemes(text);
    const widths = chars.map((char) => textWidth(char, metrics.size, { factor: 0.92 }));
    const total = widths.reduce((sum, width) => sum + width, 0);
    const start = 512 - total / 2;
    const random = createRandom(hashSeed(`firework:${text}`));
    const palette = ['#ff4f8b', '#ffcf5a', '#6fe7ff', '#b579ff', '#78f09a', '#ffffff', '#ff7a3d'];

    const clusters = [];
    let cursor = start;
    for (let charIndex = 0; charIndex < chars.length; charIndex += 1) {
        const width = widths[charIndex];
        const count = chars[charIndex] === ' ' ? 3 : 12;
        for (let index = 0; index < count; index += 1) {
            const cx = cursor + width * (0.04 + random() * 0.92);
            const cy = wordY - metrics.size * 0.4 + random() * metrics.size * 0.84;
            const color = palette[Math.floor(random() * palette.length)];
            clusters.push(burst(cx, cy, 32 + random() * 50, color, {
                rays: 12 + Math.floor(random() * 9),
                width: 1.4 + random() * 2.2,
                inner: 5,
                opacity: 0.7 + random() * 0.3,
                seed: Math.floor(random() * 100000)
            }));
        }
        cursor += width;
    }

    const particles = [];
    for (let index = 0; index < 760; index += 1) {
        const x = start + random() * total;
        const y = wordY - metrics.size * 0.44 + random() * metrics.size * 0.88;
        particles.push(circle(x, y, 0.7 + random() * 2.4, {
            fill: palette[Math.floor(random() * palette.length)],
            opacity: 0.35 + random() * 0.65
        }));
    }

    const ambient = `<g filter="url(#fw-small-glow)">
        ${fireworkBurst(138, 176, 118, '#ff7eb3', 8)}
        ${fireworkBurst(878, 138, 104, '#75e6ff', 17)}
        ${fireworkBurst(760, 318, 72, '#ffd166', 25)}
        ${fireworkBurst(312, 96, 60, '#b579ff', 31)}
        ${fireworkBurst(96, 456, 52, '#78f09a', 47)}
        ${fireworkBurst(934, 470, 58, '#ffcf5a', 53)}
    </g>`;

    const defs = [
        linearGradient('fw-sky', ['#0b0a1b', '#17112f', '#2b1437', '#3b1736'], 180),
        radialGradient('fw-city-glow', [[0, '#ff8bc1', 0.36], [0.6, '#593060', 0.14], [1, '#0b0a1b', 0]], { cx: 0.5, cy: 0.74, r: 0.55 }),
        noiseFilter('fw-grain', { frequency: 0.22, octaves: 3, seed: 21, slope: 0.16 }),
        glowFilter('fw-glow', 16),
        glowFilter('fw-small-glow', 7),
        blurFilter('fw-soft', 18),
        wordClip('fw-clip', text, {
            y: wordY,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            letterSpacing: 0,
            textLength: metrics.width
        }),
        `<clipPath id="fw-water-clip"><rect x="0" y="940" width="1024" height="84"/></clipPath>`
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#fw-sky)' }),
        `<ellipse cx="512" cy="740" rx="620" ry="230" fill="url(#fw-city-glow)"/>`,
        starfield(110, { seed: 661, maxRadius: 1.4, maxOpacity: 0.55 }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#fw-grain)" opacity="0.12"/>`,
        ambient,
        `<g filter="url(#fw-glow)" opacity="0.98">`,
        textElement({
            value: text,
            x: 512,
            y: wordY,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#1a0825',
            opacity: 0.52,
            textLength: metrics.width
        }),
        `<g clip-path="url(#fw-clip)">${clusters.join('')}${particles.join('')}</g>`,
        `</g>`,
        textElement({
            value: text,
            x: 512,
            y: wordY,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'none',
            stroke: '#ffd7a1',
            strokeWidth: 1.1,
            opacity: 0.24,
            textLength: metrics.width
        }),
        fireworkCity(),
        `<rect x="0" y="940" width="1024" height="84" fill="#070a16"/>`,
        `<g opacity="0.25" filter="url(#fw-soft)">${[0, 1, 2, 3, 4, 5].map((index) => rect(70 + index * 150, 946, 80 + (index % 3) * 28, 58, { fill: ['#ff4f8b', '#ffcf5a', '#6fe7ff'][index % 3] })).join('')}</g>`,
        `<g clip-path="url(#fw-water-clip)">${Array.from({ length: 120 }, () => {
            const x = random() * SIZE;
            const y = 946 + random() * 70;
            const color = palette[Math.floor(random() * palette.length)];
            return line(x, y, x + (random() - 0.5) * 12, y + 6 + random() * 24, { stroke: color, strokeWidth: 0.8 + random() * 1.8, opacity: 0.14 + random() * 0.35 });
        }).join('')}</g>`,
        `<path d="M0 942C120 930 218 946 328 938C440 930 540 948 650 938C760 928 872 946 1024 934" fill="none" stroke="#6c4d74" stroke-width="3" opacity="0.42"/>`
    ];

    return { defs, body: body.join('') };
}

function flipFlop(x, y, rotation, scale, sole, strap, outline) {
    return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">
<rect x="-58" y="-112" width="116" height="224" rx="56" fill="${sole}" stroke="${outline}" stroke-width="4"/>
<path d="M0-48L-34-83M0-48L34-83M0-48L0-91" fill="none" stroke="${strap}" stroke-width="11" stroke-linecap="round"/>
<circle cx="0" cy="-48" r="6" fill="${strap}" stroke="${outline}" stroke-width="2"/>
<path d="M-45-63C-54-32-52 24-44 64" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.2"/>
</g>`;
}

function scallopShell(x, y, scale, rotation) {
    return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" stroke="#a26d52" stroke-width="2.4" stroke-linejoin="round">
<path d="M0 48C-78 34-99-32-58-82C-32-114 32-114 58-82C99-32 78 34 0 48Z" fill="#e8c6a8"/>
<path d="M0 39L-54-70M0 39L-28-89M0 39L0-96M0 39L28-89M0 39L54-70" fill="none" stroke="#c08f74" stroke-width="3"/>
<path d="M-46 27C-70 0-70-45-44-70" fill="none" stroke="#fff2df" stroke-width="5" opacity="0.55"/>
<path d="M0 52C-12 68-8 82 5 87C17 82 20 67 8 53Z" fill="#d7a98c"/>
</g>`;
}

function conchShell(x, y, scale, rotation) {
    return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" stroke="#a46f58" stroke-width="2.4" stroke-linejoin="round">
<path d="M-45 32C-69 3-57-45-17-57C23-69 60-43 61-10C62 16 43 35 18 34C0 34-12 20-8 6C-5-7 9-13 19-6C29 1 28 16 19 20C12 23 4 18 5 11" fill="#efc6ab"/>
<path d="M-34 25C-48 5-38-26-12-37C14-48 41-31 44-10" fill="none" stroke="#c68d72" stroke-width="3"/>
<path d="M-18 42C-4 51 16 51 31 40C44 30 51 16 50 2" fill="none" stroke="#d9a98d" stroke-width="5"/>
<path d="M-36 12C-26 28-5 38 14 35" fill="none" stroke="#fff0df" stroke-width="4" opacity="0.5"/>
</g>`;
}

function summerbeach(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 680, 190, 1.05);
    const random = createRandom(hashSeed(`summerbeach:${text}`));
    const grains = [];
    for (let index = 0; index < 360; index += 1) {
        grains.push(circle(random() * SIZE, random() * SIZE, 0.4 + random() * 1.8, {
            fill: random() > 0.5 ? '#f3d7a6' : '#8e683e',
            opacity: 0.12 + random() * 0.4
        }));
    }

    const defs = [
        linearGradient('sb-sand', ['#d9b47d', '#c3955c', '#a97c48', '#c99a62'], 125),
        lightingFilter('sb-grain', { frequency: 0.27, octaves: 3, seed: 7, surfaceScale: 1.6, lightColor: '#dcb77d', azimuth: 315, elevation: 56 }),
        noiseFilter('sb-specks', { frequency: 0.7, octaves: 2, seed: 14, slope: 0.3 }),
        shadowFilter('sb-shadow', { dx: 0, dy: 19, deviation: 16, color: '#6e4b2b', opacity: 0.48 }),
        blurFilter('sb-soft', 4),
        `<filter id="sb-rough" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="9" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>`
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#sb-sand)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#sb-grain)" opacity="0.9"/>`,
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#sb-specks)" opacity="0.15"/>`,
        grains.join(''),
        `<g filter="url(#sb-shadow)">`,
        flipFlop(128, 158, -22, 1.25, '#b8d93d', '#7fa923', '#6d7f2a'),
        flipFlop(327, 118, 12, 1.12, '#f4d134', '#caa51d', '#9b811b'),
        flipFlop(470, 82, -8, 0.98, '#e8c22c', '#b89316', '#8c7217'),
        `</g>`,
        `<g filter="url(#sb-shadow)">`,
        `<g filter="url(#sb-soft)">${textElement({
            value: text,
            x: 565,
            y: 616,
            size: metrics.size,
            font: FONTS.hand,
            weight: 700,
            fill: '#5b3c22',
            opacity: 0.9,
            transform: 'rotate(-2 565 616)'
        })}</g>`,
        `<g filter="url(#sb-rough)">${textElement({
            value: text,
            x: 560,
            y: 603,
            size: metrics.size,
            font: FONTS.hand,
            weight: 700,
            fill: '#96683b',
            stroke: '#583a21',
            strokeWidth: 5,
            opacity: 0.98,
            transform: 'rotate(-2 560 603)'
        })}</g>`,
        textElement({
            value: text,
            x: 558,
            y: 599,
            size: metrics.size,
            font: FONTS.hand,
            weight: 700,
            fill: 'none',
            stroke: '#d3ab73',
            strokeWidth: 1.3,
            opacity: 0.52,
            transform: 'rotate(-2 558 599)'
        }),
        `</g>`,
        `<g opacity="0.8">`,
        `<path d="M746 866C714 834 714 800 746 783C774 768 798 782 806 806C814 781 840 767 869 782C900 799 900 836 866 869L807 920Z" fill="none" stroke="#8d653f" stroke-width="7" stroke-linecap="round"/>`,
        `<path d="M742 862C710 830 710 796 742 779C770 764 794 778 802 802C810 777 836 763 865 778C896 795 896 832 862 865L803 916Z" fill="none" stroke="#e0be8b" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>`,
        `</g>`,
        scallopShell(884, 900, 1.15, -18),
        scallopShell(976, 972, 0.8, 18),
        conchShell(940, 1000, 1.05, -22),
        conchShell(790, 984, 0.68, 28),
        `<path d="M0 0C120 42 238 52 340 28" fill="none" stroke="#9d7449" stroke-width="1.3" opacity="0.28"/>`
    ];

    return { defs, body: body.join('') };
}

export const SINGLE_RENDERERS = Object.freeze({
    amongus,
    royal,
    mascotemetal,
    firework,
    summerbeach
});

