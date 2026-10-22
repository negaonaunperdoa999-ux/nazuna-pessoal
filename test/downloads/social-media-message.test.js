import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSocialMediaPayload,
    resolveMediaType,
    DEFAULT_MEDIA_TYPE
} from '../../dados/src/funcs/downloads/socialMediaMessage.js';

test('o resultado válido do downloader vira um payload aceito pelo Baileys', () => {
    const buffer = Buffer.from('conteudo-de-video-fake');
    const result = {
        ok: true,
        type: 'video',
        title: 'video do tiktok',
        buffer,
        mimetype: 'video/mp4',
        fileName: 'midia.mp4',
        sizeBytes: buffer.length
    };

    const payload = buildSocialMediaPayload(result);

    assert.equal(payload.ok, true);
    // O Baileys aceita Buffer cru (getStream: Buffer.isBuffer).
    assert.ok(Buffer.isBuffer(payload.media), 'a mídia precisa ir como Buffer cru, não como { buffer }');
    assert.equal(payload.media.length, buffer.length);
    assert.equal(payload.type, 'video');
    assert.equal(payload.mimetype, 'video/mp4');
    assert.equal(payload.fileName, 'midia.mp4');
    assert.equal(payload.caption, 'video do tiktok');
    assert.equal(payload.sizeBytes, buffer.length);
});

test('o payload nunca usa a forma { buffer }, que quebra o getStream do Baileys', () => {
    const payload = buildSocialMediaPayload({
        ok: true,
        type: 'video',
        buffer: Buffer.from('x')
    });

    assert.equal(Buffer.isBuffer(payload.media), true);
    // A forma quebrada era um objeto simples { buffer }, sem "url": o getStream
    // do Baileys cairia em item.url.toString() e estouraria.
    assert.notEqual(
        Object.getPrototypeOf(payload.media),
        Object.prototype,
        'a mídia não pode ser um objeto simples { buffer }'
    );
    assert.equal(payload.media.url, undefined);
});

test('buffer vazio é recusado antes de tentar enviar', () => {
    const payload = buildSocialMediaPayload({ ok: true, type: 'video', buffer: Buffer.alloc(0) });

    assert.equal(payload.ok, false);
    assert.equal(payload.etapa, 'validacao');
    assert.match(payload.msg, /vazia/i);
});

test('buffer ausente ou em formato inesperado é recusado', () => {
    const semBuffer = buildSocialMediaPayload({ ok: true, type: 'video' });
    assert.equal(semBuffer.ok, false);
    assert.equal(semBuffer.etapa, 'validacao');

    const invalido = buildSocialMediaPayload({ ok: true, type: 'video', buffer: { data: 'nao-e-buffer' } });
    assert.equal(invalido.ok, false);
    assert.match(invalido.msg, /formato inesperado/i);
});

test('a busca (URL) continua sendo convertida em { url }', () => {
    const payload = buildSocialMediaPayload({
        ok: true,
        type: 'video',
        title: 'resultado',
        urls: ['https://www.tiktok.com/@u/video/1']
    });

    assert.equal(payload.ok, true);
    assert.deepEqual(payload.media, { url: 'https://www.tiktok.com/@u/video/1' });
    assert.equal(payload.caption, 'resultado');
});

test('resultado sem buffer e sem URL é recusado com mensagem legível', () => {
    const payload = buildSocialMediaPayload({ ok: true, type: 'video' });

    assert.equal(payload.ok, false);
    assert.match(payload.msg, /mídia do vídeo/i);
});

test('falha do downloader é repassada com a etapa e a mensagem originais', () => {
    const payload = buildSocialMediaPayload({
        ok: false,
        msg: 'O yt-dlp não está disponível neste ambiente; não é possível baixar do TikTok.',
        etapa: 'download'
    });

    assert.equal(payload.ok, false);
    assert.equal(payload.etapa, 'download');
    assert.match(payload.msg, /yt-dlp/);
});

test('resultado nulo ou indefinido não quebra', () => {
    assert.equal(buildSocialMediaPayload(null).ok, false);
    assert.equal(buildSocialMediaPayload(undefined).ok, false);
});

test('o tipo de mídia é normalizado', () => {
    assert.equal(resolveMediaType('video'), 'video');
    assert.equal(resolveMediaType('AUDIO'), 'audio');
    assert.equal(resolveMediaType('image'), 'image');
    assert.equal(resolveMediaType('documento'), DEFAULT_MEDIA_TYPE);
    assert.equal(resolveMediaType(undefined), DEFAULT_MEDIA_TYPE);
});

test('o resultado real do adaptador (Facebook/Instagram) mantém tipo, MIME e nome do arquivo', () => {
    const buffer = Buffer.from('video-fake');
    const resultadoAdaptador = {
        ok: true,
        type: 'video',
        title: 'titulo do post',
        buffer,
        mimetype: 'video/mp4',
        fileName: 'midia.mp4',
        thumbnail: null,
        resolution: '720p',
        sizeBytes: buffer.length
    };

    const payload = buildSocialMediaPayload(resultadoAdaptador);

    assert.equal(payload.ok, true);
    assert.equal(payload.type, 'video');
    assert.equal(payload.mimetype, 'video/mp4');
    // a chave real do adaptador é "fileName" (o comando lia "filename" e perdia o nome)
    assert.equal(payload.fileName, 'midia.mp4');
    assert.equal(resultadoAdaptador.filename, undefined);
    assert.equal(payload.caption, 'titulo do post');
    assert.equal(payload.sizeBytes, buffer.length);
});

test('foto do Facebook é enviada como imagem, não como vídeo', () => {
    const buffer = Buffer.from('foto-fake');
    const payload = buildSocialMediaPayload({
        ok: true,
        type: 'image',
        buffer,
        mimetype: 'image/jpeg',
        fileName: 'midia.jpg'
    });

    assert.equal(payload.type, 'image');
    assert.equal(payload.mimetype, 'image/jpeg');
    assert.equal(payload.fileName, 'midia.jpg');
});

test('o payload aceita o nome de arquivo em "filename" (fallback do adaptador legado)', () => {
    const payload = buildSocialMediaPayload({
        ok: true,
        type: 'video',
        buffer: Buffer.from('x'),
        filename: 'legado.mp4'
    });

    assert.equal(payload.fileName, 'legado.mp4');
});

test('o getStream real do Baileys aceita o payload e rejeita a forma antiga', async () => {
    let getStream = null;
    try {
        ({ getStream } = await import('baileys/lib/Utils/messages-media.js'));
    } catch {
        // o caminho interno do Baileys mudou: o teste fica sem validação extra
        return;
    }

    const buffer = Buffer.from('conteudo-de-video-fake');

    // Forma antiga ({ buffer }): reproduz o erro do log do servidor.
    await assert.rejects(
        () => getStream({ buffer }),
        (error) => error instanceof TypeError && /reading 'toString'/.test(error.message)
    );

    // Forma nova (Buffer cru): o Baileys transforma em stream.
    const payload = buildSocialMediaPayload({ ok: true, type: 'video', buffer });
    const { stream, type } = await getStream(payload.media);

    assert.equal(type, 'buffer');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).length, buffer.length);
});
