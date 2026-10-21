import { ApiError, ErrorCodes, inputError } from '../../errors.js';

let sharpPromise;

async function loadSharp() {
    if (!sharpPromise) {
        sharpPromise = import('sharp')
            .then((module) => module.default || module)
            .catch((error) => {
                sharpPromise = null;
                throw new ApiError(ErrorCodes.DEPENDENCY_MISSING, {
                    message: 'sharp não está instalado ou não pôde ser carregado',
                    userMessage: 'O gerador local de brat precisa da dependência sharp, que não está declarada no package.json.',
                    cause: error
                });
            });
    }

    return sharpPromise;
}

function escapeXml(value) {
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

function normalizeColor(value, fallback) {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;

    const color = raw.startsWith('%23') ? decodeURIComponent(raw) : raw;
    if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
    if (/^[a-z]+$/i.test(color)) return color;
    if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/i.test(color)) return color;

    throw inputError('Cor inválida. Use nomes CSS, #RRGGBB, rgb() ou hsl().');
}

function parseBlur(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 0;

    const blur = Number(value);
    if (!Number.isFinite(blur) || blur < 0 || blur > 50) {
        throw inputError('O parâmetro blur deve ser um número entre 0 e 50.');
    }

    return blur;
}

function wrapText(value, maxChars = 12) {
    const paragraphs = String(value).replace(/\r\n?/g, '\n').split('\n');
    const lines = [];

    for (const paragraph of paragraphs) {
        const graphemes = splitGraphemes(paragraph);
        if (graphemes.length === 0) {
            lines.push('');
            continue;
        }

        let current = [];
        for (const grapheme of graphemes) {
            if (current.length >= maxChars) {
                lines.push(current.join(''));
                current = [];
            }
            current.push(grapheme);
        }

        if (current.length > 0) lines.push(current.join(''));
    }

    return lines.length > 0 ? lines : [''];
}

function computeLayout(lines) {
    const longest = Math.max(1, ...lines.map((line) => splitGraphemes(line).length));
    let fontSize = Math.min(112, Math.floor(920 / Math.max(1, longest * 0.62)));
    fontSize = Math.max(44, fontSize);

    let lineHeight = Math.round(fontSize * 1.12);
    if (lineHeight * lines.length > 840) {
        fontSize = Math.max(26, Math.floor(840 / (lines.length * 1.12)));
        lineHeight = Math.round(fontSize * 1.12);
    }

    return { fontSize, lineHeight };
}

export function buildBratSvg(input = {}) {
    const query = String(input.query ?? '');
    if (!query.trim()) throw inputError('O texto (query) é obrigatório.');

    const bg = normalizeColor(input.bg, 'white');
    const textColor = normalizeColor(input.text_color, 'black');
    const lines = wrapText(query, 12);
    const { fontSize, lineHeight } = computeLayout(lines);
    const totalHeight = (lines.length - 1) * lineHeight;
    const startY = 512 - totalHeight / 2;

    const textElements = lines.map((line, index) => {
        const y = startY + index * lineHeight;
        return `<text x="512" y="${y}">${escapeXml(line)}</text>`;
    }).join('');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<rect width="1024" height="1024" fill="${escapeXml(bg)}"/>
<g fill="${escapeXml(textColor)}" font-family="Segoe UI, Noto Sans, Segoe UI Emoji, Noto Color Emoji, Arial, sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="-2" xml:space="preserve">${textElements}</g>
</svg>`;
}

export async function generateBrat(input, options = {}) {
    const sharp = options.sharpImpl || await loadSharp();
    const svg = buildBratSvg(input);
    const blur = parseBlur(input.blur);

    try {
        let pipeline = sharp(Buffer.from(svg, 'utf8'))
            .resize(512, 512, { fit: 'fill' });

        if (blur > 0) pipeline = pipeline.blur(blur);

        const buffer = await pipeline
            .webp({ quality: 90, effort: 4 })
            .toBuffer();

        if (!buffer || buffer.length === 0) {
            throw new ApiError(ErrorCodes.INTERNAL, {
                message: 'sharp retornou uma imagem vazia'
            });
        }

        return {
            ok: true,
            criador: 'Nazuna',
            type: 'image',
            mime: 'image/webp',
            mimetype: 'image/webp',
            query: input.query,
            buffer,
            provider: 'local'
        };
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(ErrorCodes.INTERNAL, {
            message: 'Falha ao renderizar o brat local',
            cause: error
        });
    }
}

export { loadSharp, normalizeColor, parseBlur, splitGraphemes, wrapText };
