import { downloadContentFromMessage } from 'baileys';

async function getFileBuffer(mediakey, mediaType) {
  try {
    if (!mediakey) throw new Error('Chave de mídia inválida');

    const typeMap = {
      sticker: 'image',
      stickerMessage: 'image',
      imageMessage: 'image',
      videoMessage: 'video',
      audioMessage: 'audio',
      documentMessage: 'document'
    };
    const downloadType = typeMap[mediaType] || mediaType;

    const stream = await downloadContentFromMessage(mediakey, downloadType);
    const chunks = [];
    let totalSize = 0;
    const MAX_BUFFER_SIZE = 50 * 1024 * 1024;
    for await (const chunk of stream) {
      chunks.push(chunk);
      totalSize += chunk.length;
      if (totalSize > MAX_BUFFER_SIZE) throw new Error('Tamanho máximo excedido');
    }
    return Buffer.concat(chunks);
  } catch (err) {
    throw err;
  }
}

function getMediaInfo(message) {
  if (!message) return null;
  if (message.imageMessage) return { media: message.imageMessage, type: 'image' };
  if (message.videoMessage) return { media: message.videoMessage, type: 'video' };
  if (message.audioMessage) return { media: message.audioMessage, type: 'audio' };
  if (message.documentMessage) return { media: message.documentMessage, type: 'document' };
  if (message.viewOnceMessage?.message?.imageMessage) return { media: message.viewOnceMessage.message.imageMessage, type: 'image' };
  if (message.viewOnceMessage?.message?.videoMessage) return { media: message.viewOnceMessage.message.videoMessage, type: 'video' };
  if (message.viewOnceMessage?.message?.audioMessage) return { media: message.viewOnceMessage.message.audioMessage, type: 'audio' };
  if (message.viewOnceMessage?.message?.documentMessage) return { media: message.viewOnceMessage.message.documentMessage, type: 'document' };
  if (message.viewOnceMessageV2?.message?.imageMessage) return { media: message.viewOnceMessageV2.message.imageMessage, type: 'image' };
  if (message.viewOnceMessageV2?.message?.videoMessage) return { media: message.viewOnceMessageV2.message.videoMessage, type: 'video' };
  if (message.viewOnceMessageV2?.message?.audioMessage) return { media: message.viewOnceMessageV2.message.audioMessage, type: 'audio' };
  if (message.viewOnceMessageV2?.message?.documentMessage) return { media: message.viewOnceMessageV2.message.documentMessage, type: 'document' };
  if (message.viewOnceMessageV2Extension?.message?.imageMessage) return { media: message.viewOnceMessageV2Extension.message.imageMessage, type: 'image' };
  if (message.viewOnceMessageV2Extension?.message?.videoMessage) return { media: message.viewOnceMessageV2Extension.message.videoMessage, type: 'video' };
  if (message.viewOnceMessageV2Extension?.message?.audioMessage) return { media: message.viewOnceMessageV2Extension.message.audioMessage, type: 'audio' };
  if (message.viewOnceMessageV2Extension?.message?.documentMessage) return { media: message.viewOnceMessageV2Extension.message.documentMessage, type: 'document' };
  return null;
}

export { getFileBuffer, getMediaInfo };
