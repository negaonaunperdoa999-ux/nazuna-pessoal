import {
    FONTS,
    SIZE,
    blurFilter,
    circle,
    createRandom,
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
    textElement,
    textWidth
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

function cloudPuff(x, y, scale, opacity) {
    return `<g transform="translate(${x} ${y}) scale(${scale})" fill="#ffffff" opacity="${opacity}">
<ellipse cx="-48" cy="18" rx="59" ry="33"/>
<ellipse cx="0" cy="0" rx="71" ry="46"/>
<ellipse cx="55" cy="20" rx="54" ry="31"/>
<ellipse cx="12" cy="28" rx="92" ry="27"/>
</g>`;
}

function airplane(x, y, rotation, scale) {
    return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" fill="#f8fcff" stroke="#8bb9dd" stroke-width="2.2">
<path d="M0-31L8-9L38 2L38 10L8 6L4 25L15 33L15 39L0 34L-15 39L-15 33L-4 25L-8 6L-38 10L-38 2L-8-9Z"/>
<path d="M0-26L3 5" fill="none" stroke="#c9e9ff" stroke-width="2"/>
</g>`;
}

function cloudsky(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 560, 148, 1.02);
    const wordY = 480;
    const random = createRandom(hashSeed(`cloudsky:${text}`));
    const heart = [];
    for (let index = 0; index < 190; index += 1) {
        const t = (Math.PI * 2 * index) / 190;
        const hx = 16 * Math.sin(t) ** 3;
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const x = 512 + hx * 22;
        const y = 438 - hy * 14.5;
        heart.push(circle(x, y, 7 + random() * 10, {
            fill: '#ffffff',
            opacity: 0.34 + random() * 0.48,
            filter: 'url(#cl-soft)'
        }));
        if (index % 2 === 0) {
            heart.push(circle(x, y, 2.2 + random() * 3.2, {
                fill: '#ffffff',
                opacity: 0.5 + random() * 0.45
            }));
        }
    }
    const puffs = [];
    for (let index = 0; index < 220; index += 1) {
        puffs.push(circle(
            metrics.width * (random() - 0.5),
            metrics.size * (random() - 0.53) * 0.82,
            5 + random() * 13,
            { fill: '#ffffff', opacity: 0.5 + random() * 0.5 }
        ));
    }

    const defs = [
        linearGradient('cl-sky', ['#0754ba', '#1479dc', '#42a4ef', '#86c8f5'], 168),
        radialGradient('cl-light', [[0, '#c7ecff', 0.36], [0.7, '#ffffff', 0], [1, '#ffffff', 0]], { cx: 0.5, cy: 0.2, r: 0.8 }),
        `<filter id="cl-cloud" x="-35%" y="-35%" width="170%" height="170%"><feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="4" seed="7" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="23" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.2"/></filter>`,
        blurFilter('cl-soft', 12),
        glowFilter('cl-glow', 7),
        noiseFilter('cl-grain', { frequency: 0.1, octaves: 2, seed: 12, slope: 0.06 }),
        wordClip('cl-word', text, {
            y: wordY,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            textLength: metrics.width
        })
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#cl-sky)' }),
        `<rect width="${SIZE}" height="${SIZE}" fill="url(#cl-light)"/>`,
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#cl-grain)" opacity="0.1"/>`,
        heart.join(''),
        `<g filter="url(#cl-soft)" opacity="0.8">`,
        cloudPuff(155, 905, 1.35, 0.72),
        cloudPuff(390, 968, 1.05, 0.64),
        cloudPuff(660, 930, 1.25, 0.66),
        cloudPuff(860, 995, 0.9, 0.56),
        `</g>`,
        `<g filter="url(#cl-glow)" opacity="0.35">${textElement({
            value: text,
            x: 512,
            y: wordY + 8,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#ffffff',
            textLength: metrics.width
        })}</g>`,
        `<g filter="url(#cl-cloud)">`,
        textElement({
            value: text,
            x: 512,
            y: wordY,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#ffffff',
            stroke: '#ffffff',
            strokeWidth: 9,
            textLength: metrics.width,
            opacity: 0.9
        }),
        `</g>`,
        `<g clip-path="url(#cl-word)" opacity="0.96">${puffs.join('')}</g>`,
        airplane(520, 310, 16, 1.08),
        airplane(500, 690, 160, 0.78),
        `<path d="M90 780C220 760 330 776 455 754" fill="none" stroke="#ffffff" stroke-width="12" opacity="0.2" filter="url(#cl-soft)"/>`,
        `<path d="M600 704C670 720 744 704 810 724" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.2" filter="url(#cl-soft)"/>`
    ];

    return { defs, body: body.join('') };
}

function techstyle(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 610, 155, 0.98);
    const random = createRandom(hashSeed(`techstyle:${text}`));
    const dust = [];
    for (let index = 0; index < 110; index += 1) {
        dust.push(circle(320 + random() * 390, 270 + random() * 360, 0.7 + random() * 2.8, {
            fill: random() > 0.3 ? '#f3c8ff' : '#ffffff',
            opacity: 0.2 + random() * 0.7
        }));
    }
    const spokes = [];
    for (let index = 0; index < 52; index += 1) {
        const angle = (Math.PI * 2 * index) / 52;
        const x = 512 + Math.cos(angle) * 405;
        const y = 820 + Math.sin(angle) * 52;
        spokes.push(line(512, 820, x, y, {
            stroke: index % 2 === 0 ? '#9a4d93' : '#492444',
            strokeWidth: 2,
            opacity: 0.55
        }));
    }

    const defs = [
        linearGradient('ts-wall', ['#1c1721', '#120f16', '#09080c'], 180),
        radialGradient('ts-spot', [[0, '#ff5ee6', 0.2], [0.45, '#7f38aa', 0.09], [1, '#000000', 0]], { cx: 0.5, cy: 0.35, r: 0.62 }),
        radialGradient('ts-stage', [[0, '#8f5f9e', 1], [0.55, '#3b2a45', 1], [1, '#100d14', 1]], { cx: 0.5, cy: 0.42, r: 0.65 }),
        linearGradient('ts-metal', ['#67536d', '#261d2d', '#0d0a10', '#3c2d44'], 105),
        noiseFilter('ts-grain', { frequency: 0.24, octaves: 4, seed: 6, slope: 0.2 }),
        glowFilter('ts-glow', 17),
        glowFilter('ts-soft-glow', 7),
        blurFilter('ts-blur', 18),
        `<linearGradient id="ts-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8bf0" stop-opacity="0.22"/><stop offset="0.65" stop-color="#b147d4" stop-opacity="0.06"/><stop offset="1" stop-color="#b147d4" stop-opacity="0"/></linearGradient>`
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#ts-wall)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#ts-grain)" opacity="0.42"/>`,
        `<ellipse cx="512" cy="410" rx="500" ry="390" fill="url(#ts-spot)"/>`,
        `<polygon points="400,0 624,0 760,790 264,790" fill="url(#ts-cone)" filter="url(#ts-blur)"/>`,
        `<rect x="0" y="700" width="${SIZE}" height="324" fill="#100d13" opacity="0.58"/>`,
        `<path d="M0 700H1024" stroke="#3c2f44" stroke-width="3" opacity="0.5"/>`,
        `<ellipse cx="512" cy="930" rx="458" ry="74" fill="#000000" opacity="0.62" filter="url(#ts-blur)"/>`,
        `<g filter="url(#ts-glow)" opacity="0.55">${textElement({
            value: text,
            x: 512,
            y: 508,
            size: metrics.size,
            font: FONTS.tech,
            weight: 700,
            fill: 'none',
            stroke: '#ff4fda',
            strokeWidth: 12,
            letterSpacing: 7,
            textLength: metrics.width
        })}</g>`,
        textElement({
            value: text,
            x: 512,
            y: 508,
            size: metrics.size,
            font: FONTS.tech,
            weight: 700,
            fill: '#240d2a',
            stroke: '#ff4fda',
            strokeWidth: 6,
            letterSpacing: 7,
            textLength: metrics.width
        }),
        textElement({
            value: text,
            x: 512,
            y: 508,
            size: metrics.size,
            font: FONTS.tech,
            weight: 700,
            fill: 'none',
            stroke: '#ffd1f8',
            strokeWidth: 1.8,
            letterSpacing: 7,
            textLength: metrics.width
        }),
        dust.join(''),
        `<g opacity="0.11" filter="url(#ts-blur)">${textElement({
            value: text,
            x: 512,
            y: 820,
            size: metrics.size,
            font: FONTS.tech,
            weight: 700,
            fill: '#ff79e4',
            letterSpacing: 7,
            textLength: metrics.width,
            transform: 'translate(512 820) scale(1 -0.36) translate(-512 -820)'
        })}</g>`,
        `<g>`,
        `<path d="M92 812C92 872 205 918 512 918C819 918 932 872 932 812L932 866C932 930 819 978 512 978C205 978 92 930 92 866Z" fill="url(#ts-metal)" stroke="#1a1220" stroke-width="5"/>`,
        `<ellipse cx="512" cy="968" rx="414" ry="46" fill="#09070c" stroke="#2d2133" stroke-width="4"/>`,
        `<ellipse cx="512" cy="900" rx="424" ry="60" fill="none" stroke="#5b3b64" stroke-width="3" opacity="0.75"/>`,
        `<ellipse cx="512" cy="938" rx="412" ry="56" fill="none" stroke="#ff4fda" stroke-width="2.2" opacity="0.35" filter="url(#ts-soft-glow)"/>`,
        `<ellipse cx="512" cy="820" rx="424" ry="64" fill="url(#ts-stage)" stroke="#b85bd0" stroke-width="4"/>`,
        `<ellipse cx="512" cy="816" rx="383" ry="50" fill="#25192c" stroke="#ff4fda" stroke-width="5" filter="url(#ts-soft-glow)"/>`,
        `<ellipse cx="512" cy="816" rx="324" ry="39" fill="#140d18" stroke="#5e3f68" stroke-width="3"/>`,
        spokes.join(''),
        `<ellipse cx="512" cy="816" rx="384" ry="51" fill="none" stroke="#ffc0f4" stroke-width="1.5" opacity="0.7"/>`,
        `<path d="M108 828C200 874 340 898 512 898C684 898 824 874 916 828" fill="none" stroke="#d96be8" stroke-width="3" opacity="0.72" filter="url(#ts-soft-glow)"/>`,
        `<path d="M122 860C220 904 350 924 512 924C674 924 804 904 902 860" fill="none" stroke="#b95fc2" stroke-width="2" opacity="0.3"/>`,
        `<rect x="458" y="878" width="108" height="96" rx="13" fill="#17111b" stroke="#4b3652" stroke-width="3"/>`,
        `<rect x="480" y="894" width="64" height="7" rx="3.5" fill="#ff4fda" filter="url(#ts-soft-glow)"/>`,
        `<rect x="480" y="912" width="64" height="3" rx="1.5" fill="#b95fc2" opacity="0.6"/>`,
        `</g>`,
        `<ellipse cx="512" cy="748" rx="280" ry="55" fill="#ff5ee6" opacity="0.11" filter="url(#ts-blur)"/>`
    ];

    return { defs, body: body.join('') };
}

function inkSplatter(cx, cy, count, palette, seed, spread = 70) {
    const random = createRandom(seed);
    const parts = [];
    for (let index = 0; index < count; index += 1) {
        const angle = random() * Math.PI * 2;
        const distance = random() ** 1.7 * spread;
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance;
        const radius = 0.6 + random() ** 2 * (spread * 0.09);
        parts.push(circle(x, y, radius, {
            fill: palette[Math.floor(random() * palette.length)],
            opacity: 0.18 + random() * 0.58,
            filter: random() > 0.65 ? 'url(#wc-soft)' : undefined
        }));
    }
    return parts.join('');
}

function watercolor(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 730, 215, 1.08);
    const random = createRandom(hashSeed(`watercolor:${text}`));
    const fibers = [];
    for (let index = 0; index < 80; index += 1) {
        const x = random() * SIZE;
        const y = random() * SIZE;
        fibers.push(line(x, y, x + 8 + random() * 42, y + (random() - 0.5) * 6, {
            stroke: '#7a6a53',
            strokeWidth: 0.4 + random() * 0.7,
            opacity: 0.04 + random() * 0.08
        }));
    }

    const defs = [
        linearGradient('wc-paper', ['#e4dac8', '#d9cdb8', '#e9dfcd'], 130),
        paperTexture('wc-fiber'),
        linearGradient('wc-ink', ['#5a30e8', '#8c3df2', '#4b6dff', '#6f37e8', '#3f59d8'], 115),
        `<filter id="wc-edge" x="-25%" y="-25%" width="150%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="11" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>`,
        blurFilter('wc-soft', 14),
        noiseFilter('wc-grain', { frequency: 0.2, octaves: 2, seed: 8, slope: 0.13 }),
        wordClip('wc-word', text, {
            x: 508,
            y: 604,
            size: metrics.size,
            font: FONTS.script,
            weight: 700,
            italic: true,
            transform: 'rotate(-4 508 604)'
        })
    ];

    const butterfly = `<g transform="translate(714 345) rotate(-8) scale(1.18)" fill="none" stroke="#2f53d6" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
<path d="M-8 6C-45-42-91-45-89-8C-88 22-48 38 4 22"/>
<path d="M9 5C42-45 91-50 91-13C91 20 52 41 4 23"/>
<path d="M-5 23C-36 60-68 68-65 41C-63 21-34 10-2 18"/>
<path d="M7 23C37 59 70 65 67 39C65 20 35 10 3 18"/>
<path d="M0-28L0 40" stroke-width="4"/>
<path d="M-2-28C-10-43-21-49-31-50M2-28C10-43 21-49 31-50"/>
</g>`;

    const palette = `<g transform="translate(820 84) rotate(-12)">
<rect x="-160" y="-90" width="330" height="190" rx="20" fill="#e7e3dd" stroke="#b9b1a3" stroke-width="5"/>
<rect x="-148" y="-78" width="306" height="166" rx="14" fill="#d4d0c9"/>
${[[-105, -40, '#9b4bdc'], [-40, -47, '#c13ca6'], [30, -40, '#5e4ad7'], [95, -31, '#74b53b'], [-78, 45, '#3c82d6'], [6, 38, '#d8459f'], [80, 44, '#e1b934']].map(([x, y, color]) => `<circle cx="${x}" cy="${y}" r="27" fill="${color}" stroke="#f5f1e9" stroke-width="6"/><circle cx="${x - 7}" cy="${y - 8}" r="7" fill="#ffffff" opacity="0.35"/>`).join('')}
<rect x="142" y="-60" width="34" height="126" rx="10" fill="#b7b1a5"/>
</g>`;

    const brush = `<g transform="translate(56 930) rotate(-34)">
<rect x="-150" y="-11" width="260" height="22" rx="10" fill="#bc8f5d" stroke="#8a643d" stroke-width="2"/>
<rect x="96" y="-14" width="36" height="28" rx="4" fill="#c8c5bd" stroke="#85827c" stroke-width="2"/>
<path d="M132-13C155-10 172 0 183 8C172 16 155 24 132 23Z" fill="#6e30c9"/>
<path d="M135-6C150-3 160 2 168 7C159 12 149 16 136 18Z" fill="#a24ee6"/>
</g>`;

    const stains = [
        `<ellipse cx="64" cy="55" rx="94" ry="110" fill="#b332b3" opacity="0.22" filter="url(#wc-soft)"/>`,
        `<ellipse cx="852" cy="916" rx="130" ry="92" fill="#6f36d2" opacity="0.12" filter="url(#wc-soft)"/>`,
        `<ellipse cx="64" cy="975" rx="115" ry="80" fill="#d13ba4" opacity="0.16" filter="url(#wc-soft)"/>`,
        `<ellipse cx="958" cy="420" rx="95" ry="120" fill="#5151ca" opacity="0.1" filter="url(#wc-soft)"/>`
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#wc-paper)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#wc-fiber)" opacity="0.7"/>`,
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#wc-grain)" opacity="0.13"/>`,
        fibers.join(''),
        stains.join(''),
        `<g filter="url(#wc-soft)" opacity="0.5">${textElement({
            value: text,
            x: 514,
            y: 614,
            size: metrics.size,
            font: FONTS.script,
            weight: 700,
            fill: '#8a3fee',
            italic: true,
            transform: 'rotate(-4 514 614)'
        })}</g>`,
        `<g filter="url(#wc-edge)">${textElement({
            value: text,
            x: 508,
            y: 604,
            size: metrics.size,
            font: FONTS.script,
            weight: 700,
            fill: 'url(#wc-ink)',
            opacity: 0.88,
            italic: true,
            transform: 'rotate(-4 508 604)'
        })}</g>`,
        `<g clip-path="url(#wc-word)">`,
        `<ellipse cx="380" cy="590" rx="120" ry="70" fill="#d348c7" opacity="0.22" filter="url(#wc-soft)"/>`,
        `<ellipse cx="610" cy="650" rx="150" ry="58" fill="#405cff" opacity="0.2" filter="url(#wc-soft)"/>`,
        `<ellipse cx="760" cy="570" rx="90" ry="80" fill="#8d37d1" opacity="0.18" filter="url(#wc-soft)"/>`,
        `</g>`,
        textElement({
            value: text,
            x: 501,
            y: 597,
            size: metrics.size,
            font: FONTS.script,
            weight: 700,
            fill: 'none',
            stroke: '#405cff',
            strokeWidth: 2,
            opacity: 0.18,
            italic: true,
            transform: 'rotate(-4 501 597)'
        }),
        inkSplatter(260, 690, 44, ['#9a2ed1', '#d247b8', '#5a4be0'], 902, 90),
        inkSplatter(725, 705, 32, ['#7f3fd7', '#c343b0'], 77, 100),
        inkSplatter(118, 865, 30, ['#c92f9f', '#8d37d1'], 41, 65),
        inkSplatter(875, 620, 24, ['#4258d3', '#6b4fe0'], 123, 54),
        butterfly,
        palette,
        brush
    ];

    return { defs, body: body.join('') };
}

function leafShape(x, y, scale, rotation, color, seed) {
    const random = createRandom(seed);
    const vein = random() > 0.45 ? '#5f401f' : '#3f5b24';
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})">
<path d="M0-25C6-19 10-12 10-5C14-1 13 5 11 9C9 16 5 22 0 26C-5 22-9 16-11 9C-13 5-14-1-10-5C-10-12-6-19 0-25Z" fill="${color}" stroke="${vein}" stroke-width="1.1" stroke-linejoin="round"/>
<path d="M0-17L0 18M0-7L-5-1M0 1L5 7M0 8L-3 13" fill="none" stroke="${vein}" stroke-width="0.8" opacity="0.7"/>
</g>`;
}

function ligatures(context) {
    const text = singleText(context);
    const metrics = fitWord(text, 780, 220, 0.98);
    const random = createRandom(hashSeed(`ligatures:${text}`));
    const colors = ['#6e9b36', '#a8c94c', '#d5c746', '#d58a2f', '#b84b2f', '#e1a334', '#4f7b2d', '#c7a62e'];
    const leaves = [];
    const left = 512 - metrics.width / 2;
    const top = 530 - metrics.size * 0.58;
    const height = metrics.size * 1.16;
    for (let index = 0; index < 940; index += 1) {
        const x = left + random() * metrics.width;
        const y = top + random() * height;
        const scale = 0.38 + random() * 0.62;
        const rotation = random() * 360;
        const color = colors[Math.floor(random() * colors.length)];
        leaves.push(leafShape(x, y, scale, rotation, color, Math.floor(random() * 100000)));
    }
    const loose = [];
    for (let index = 0; index < 13; index += 1) {
        const edge = random();
        const x = edge < 0.5 ? 50 + random() * 140 : 830 + random() * 150;
        const y = 80 + random() * 850;
        loose.push(leafShape(x, y, 0.55 + random() * 0.55, random() * 360, colors[Math.floor(random() * colors.length)], Math.floor(random() * 100000)));
    }
    const gravel = [];
    for (let index = 0; index < 1500; index += 1) {
        gravel.push(circle(random() * SIZE, random() * SIZE, 0.35 + random() * 1.25, {
            fill: random() > 0.3 ? '#d8d8d5' : '#111111',
            opacity: 0.1 + random() * 0.38
        }));
    }
    const cracks = [];
    for (let index = 0; index < 13; index += 1) {
        let x = random() * SIZE;
        let y = random() * SIZE;
        const points = [`M${x.toFixed(1)} ${y.toFixed(1)}`];
        for (let step = 0; step < 7; step += 1) {
            x += (random() - 0.5) * 60;
            y += 8 + random() * 35;
            points.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        cracks.push(`<path d="${points.join('')}" fill="none" stroke="#161616" stroke-width="${(0.4 + random() * 0.8).toFixed(1)}" opacity="${(0.14 + random() * 0.18).toFixed(2)}"/>`);
    }

    const defs = [
        linearGradient('lg-asphalt', ['#2b2c2e', '#1b1c1e', '#111214', '#232426'], 152),
        noiseFilter('lg-grain', { frequency: 0.52, octaves: 3, seed: 31, slope: 0.24 }),
        lightingFilter('lg-stone', { frequency: 0.2, octaves: 4, seed: 18, surfaceScale: 1.4, lightColor: '#a5a6a7', azimuth: 320, elevation: 54 }),
        shadowFilter('lg-leaf-shadow', { dx: 2, dy: 4, deviation: 2.4, color: '#000000', opacity: 0.5 }),
        blurFilter('lg-soft', 16),
        wordClip('lg-word', text, {
            y: 530,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            textLength: metrics.width
        })
    ];

    const body = [
        rect(0, 0, SIZE, SIZE, { fill: 'url(#lg-asphalt)' }),
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#lg-stone)" opacity="0.24"/>`,
        `<rect width="${SIZE}" height="${SIZE}" filter="url(#lg-grain)" opacity="0.34"/>`,
        gravel.join(''),
        cracks.join(''),
        textElement({
            value: text,
            x: 512,
            y: 530,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: '#252627',
            opacity: 0.56,
            textLength: metrics.width
        }),
        `<g clip-path="url(#lg-word)" filter="url(#lg-leaf-shadow)">${leaves.join('')}</g>`,
        textElement({
            value: text,
            x: 512,
            y: 530,
            size: metrics.size,
            font: FONTS.sansBold,
            weight: 900,
            fill: 'none',
            stroke: '#121312',
            strokeWidth: 3,
            opacity: 0.28,
            textLength: metrics.width
        }),
        loose.join(''),
        `<ellipse cx="512" cy="530" rx="520" ry="470" fill="#000000" opacity="0.13" filter="url(#lg-soft)"/>`
    ];

    return { defs, body: body.join('') };
}

export const EXTRA_SINGLE_RENDERERS = Object.freeze({
    cloudsky,
    techstyle,
    watercolor,
    ligatures
});
