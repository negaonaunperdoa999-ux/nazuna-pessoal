import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildBratSvg,
    generateBrat,
    normalizeColor,
    splitGraphemes,
    wrapText
} from '../../dados/src/funcs/api/providers/local/brat.js';
import { ErrorCodes } from '../../dados/src/funcs/api/errors.js';

let sharp = null;
try {
    const module = await import('sharp');
    sharp = module.default || module;
} catch {
    sharp = null;
}

test('SVG preserva acentos, emojis e escapa XML', () => {
    const svg = buildBratSvg({
        query: 'Olá, ação! 😀 <script>',
        bg: '%23FF0000',
        text_color: 'white',
        blur: ''
    });

    assert.match(svg, /Olá, ação! 😀/);
    assert.match(svg, /&lt;script&gt;/);
    assert.match(svg, /fill="#FF0000"/);
    assert.match(svg, /fill="white"/);
});

test('normaliza cores e rejeita valores perigosos', () => {
    assert.equal(normalizeColor('%23FF0000', 'white'), '#FF0000');
    assert.equal(normalizeColor('rgb(255, 0, 0)', 'white'), 'rgb(255, 0, 0)');
    assert.equal(normalizeColor('', 'black'), 'black');
    assert.throws(
        () => normalizeColor('red; background:url(x)', 'white'),
        (error) => error.code === ErrorCodes.INPUT_INVALID
    );
});

test('não divide emoji composto e quebra texto por grafemas', () => {
    assert.equal(splitGraphemes('👨‍👩‍👧‍👦').length, 1);
    assert.deepEqual(
        wrapText('abcdefghijklmnop', 5),
        ['abcde', 'fghij', 'klmno', 'p']
    );
});

test('gera WebP 512x512 local com acentos e emoji', async (t) => {
    if (!sharp) {
        t.skip('sharp indisponível no ambiente');
        return;
    }

    const result = await generateBrat({
        query: 'Olá, ação! 😀',
        bg: 'white',
        text_color: 'black',
        blur: ''
    }, { sharpImpl: sharp });

    assert.equal(result.ok, true);
    assert.equal(result.mime, 'image/webp');
    assert.ok(Buffer.isBuffer(result.buffer));
    assert.ok(result.buffer.length > 0);

    const metadata = await sharp(result.buffer).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 512);
});

test('wrapper canvas mantém contrato do comando brat', async (t) => {
    if (!sharp) {
        t.skip('sharp indisponível no ambiente');
        return;
    }

    const previous = process.env.NAZUNA_BRAT_PROVIDER;
    process.env.NAZUNA_BRAT_PROVIDER = 'local';

    try {
        const canvas = await import('../../dados/src/funcs/downloads/canvas.js');
        const result = await canvas.gerarbrat('Olá, ação! 😀', 'white', 'black', '');

        assert.equal(result.ok, true);
        assert.equal(result.provider, 'local');
        assert.ok(Buffer.isBuffer(result.buffer));
        assert.equal(result.mime, 'image/webp');

        const invalid = await canvas.gerarbrat('', 'white', 'black', '');
        assert.equal(invalid.ok, false);
        assert.match(invalid.msg, /texto/i);
    } finally {
        if (previous === undefined) delete process.env.NAZUNA_BRAT_PROVIDER;
        else process.env.NAZUNA_BRAT_PROVIDER = previous;
    }
});
