import { pathToFileURL } from 'url';

import { buildRichTestHtml } from './richTestHtml.js';
import {
  AI_RICH_RESPONSE_TYPE_STANDARD,
  DEFAULT_BOT_JID,
  HTML_PRIMITIVE,
  buildAIRichMessageContent,
  sendAIRichHtml
} from './sendAIRichHtml.js';
import { AIRICH_PROBE_SPECS, buildAirichProbeTextHtml, sendAirichProbe } from './airichProbe.js';
import {
  buildAIRichMessageContent as buildLegacyAIRichMessageContent,
  buildRichTestHtml as buildLegacyRichTestHtml
} from '../pokemonRichHtml.js';

const TYPE_UNIFIED_RESPONSE = 'GenAIUnifiedResponse';
const TYPE_UNIFIED_SECTION = 'GenAIUnifiedResponseSection';
const TYPE_SINGLE_LAYOUT_VIEW_MODEL = 'GenAISingleLayoutViewModel';
const TYPE_HTML_PRIMITIVE = 'GenAIaeacdsnwHtmlPrimitive';
const SUBMESSAGE_RESPONSE_TYPE = 2;
const MOCK_JID = '120363000000000000@g.us';

function parseUnified(richContent) {
  const richResponse = richContent.botForwardedMessage.message.richResponseMessage;
  return JSON.parse(Buffer.from(richResponse.unifiedResponse.data).toString('utf8'));
}

function shapeOf(value) {
  if (Buffer.isBuffer(value)) return 'Buffer';
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, shapeOf(value[key])]));
  }
  return typeof value;
}

function normalizeUnified(unified) {
  return { ...unified, response_id: '<id>' };
}

function inspectAirichPayload(richContent) {
  const inner = richContent?.botForwardedMessage?.message?.richResponseMessage;
  let unified = null;
  if (inner) {
    try {
      unified = JSON.parse(Buffer.from(inner.unifiedResponse.data).toString('utf8'));
    } catch {
      unified = null;
    }
  }
  const primitive = unified?.sections?.[0]?.view_model?.primitive;
  return { richResponse: inner, unified, primitive };
}

function assertAirichInvariants(richContent, { html, label = null, trustedSources = null, botJid = DEFAULT_BOT_JID }) {
  const errors = [];
  const { richResponse, unified, primitive } = inspectAirichPayload(richContent);

  if (!richResponse) {
    errors.push('botForwardedMessage.message.richResponseMessage ausente');
  } else {
    if (richResponse.messageType !== AI_RICH_RESPONSE_TYPE_STANDARD) {
      errors.push(`messageType invalido (${richResponse.messageType})`);
    }
    const expectedSubmessages = label ? [{ messageType: SUBMESSAGE_RESPONSE_TYPE, messageText: label }] : [];
    const actualSubmessages = JSON.stringify(richResponse.submessages);
    const expectedSubmessagesJson = JSON.stringify(expectedSubmessages);
    if (actualSubmessages !== expectedSubmessagesJson) {
      errors.push(`submessages invalidos (${actualSubmessages})`);
    }
    const contextInfo = richResponse.contextInfo;
    if (!contextInfo) {
      errors.push('contextInfo ausente');
    } else {
      if (contextInfo.forwardingScore !== 1 || contextInfo.isForwarded !== true) {
        errors.push('contextInfo.forwarding invalido');
      }
      if (contextInfo.forwardOrigin !== 4) {
        errors.push('contextInfo.forwardOrigin invalido');
      }
      if (contextInfo.forwardedAiBotMessageInfo?.botJid !== botJid) {
        errors.push(`forwardedAiBotMessageInfo.botJid invalido`);
      }
      if (
        !Array.isArray(contextInfo.mentionedJid) ||
        !Array.isArray(contextInfo.groupMentions) ||
        !Array.isArray(contextInfo.statusAttributions)
      ) {
        errors.push('contextInfo listas ausentes');
      }
    }
  }

  if (!unified) {
    errors.push('unifiedResponse.data nao decodifica como JSON');
  } else {
    if (unified.__typename !== TYPE_UNIFIED_RESPONSE) {
      errors.push(`unified.__typename invalido (${unified.__typename})`);
    }
    if (typeof unified.response_id !== 'string' || unified.response_id.length === 0) {
      errors.push('unified.response_id invalido');
    }
    const section = unified.sections?.[0];
    if (!section || section.__typename !== TYPE_UNIFIED_SECTION) {
      errors.push('sections[0] invalido');
    }
    if (section?.view_model?.__typename !== TYPE_SINGLE_LAYOUT_VIEW_MODEL) {
      errors.push('sections[0].view_model.__typename invalido');
    }
    if (!primitive || primitive.__typename !== HTML_PRIMITIVE) {
      errors.push('primitive.__typename nao e GenAIaeacdsnwHtmlPrimitive');
    }
    if (primitive?.payload !== html) {
      errors.push('primitive.payload difere do html fornecido');
    }
    if (trustedSources !== null) {
      const ts = primitive?.trusted_sources;
      if (!Array.isArray(ts) || JSON.stringify(ts) !== JSON.stringify(trustedSources)) {
        errors.push('primitive.trusted_sources invalido');
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`AirichInvariants violadas: ${errors.join('; ')}`);
  }
  return { richResponse, unified, primitive };
}

function createMockSock(captured) {
  return {
    relayMessage: async (jid, content, options) => {
      captured.push({ jid, content, options });
      return { ok: true };
    }
  };
}

async function runVerification() {
  const html = buildRichTestHtml();
  const legacyContent = buildLegacyAIRichMessageContent(html, { label: 'Rich HTML Test' });
  const helperContent = buildAIRichMessageContent(html, { label: 'Rich HTML Test' });

  const legacyUnified = parseUnified(legacyContent);
  const helperUnified = parseUnified(helperContent);
  const legacyShape = JSON.stringify(shapeOf(legacyContent));
  const helperShape = JSON.stringify(shapeOf(helperContent));
  const legacyNormalized = JSON.stringify(normalizeUnified(legacyUnified));
  const helperNormalized = JSON.stringify(normalizeUnified(helperUnified));

  const captured = [];
  await sendAIRichHtml(createMockSock(captured), MOCK_JID, html, { label: 'Rich HTML Test' });
  const relay = captured[0];
  const relayUnified = parseUnified(relay.content);
  const primitive = relayUnified.sections?.[0]?.view_model?.primitive;
  const botJid = relay.content?.botForwardedMessage?.message?.richResponseMessage?.contextInfo?.forwardedAiBotMessageInfo?.botJid;
  const messageId = relay.options?.messageId;

  let invariantsOk = false;
  let invariantsError = null;
  try {
    assertAirichInvariants(relay.content, { html, label: 'Rich HTML Test', trustedSources: [], botJid });
    invariantsOk = true;
  } catch (error) {
    invariantsError = error.message;
  }

  const probeCaptured = [];
  const probeResults = await sendAirichProbe(createMockSock(probeCaptured), MOCK_JID);
  const probeChecks = [];
  let probeOk = true;
  if (probeCaptured.length === AIRICH_PROBE_SPECS.length) {
    probeCaptured.forEach((entry, index) => {
      const spec = AIRICH_PROBE_SPECS[index];
      const expectedHtml = buildAirichProbeTextHtml(spec.label);
      try {
        const { primitive: probePrimitive } = assertAirichInvariants(entry.content, {
          html: expectedHtml,
          label: spec.label,
          trustedSources: spec.trustedSources,
          botJid
        });
        probeChecks.push({
          index,
          label: spec.label,
          trustedSources: probePrimitive?.trusted_sources,
          trustedSourcesCount: probePrimitive?.trusted_sources?.length ?? 0,
          unifiedResponseBytes: entry.content.botForwardedMessage.message.richResponseMessage.unifiedResponse.data.length,
          messageId: entry.options?.messageId,
          ok: true
        });
      } catch (error) {
        probeOk = false;
        probeChecks.push({ index, label: spec.label, ok: false, error: error.message });
      }
    });
  } else {
    probeOk = false;
  }

  return {
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    legacyUnifiedResponseBytes: legacyContent.botForwardedMessage.message.richResponseMessage.unifiedResponse.data.length,
    helperUnifiedResponseBytes: helperContent.botForwardedMessage.message.richResponseMessage.unifiedResponse.data.length,
    shapeEqual: legacyShape === helperShape,
    unifiedStructureEqual: legacyNormalized === helperNormalized,
    primitiveTypename: primitive?.__typename,
    primitiveMatches: primitive?.__typename === HTML_PRIMITIVE,
    botJid,
    botJidMatches: botJid === DEFAULT_BOT_JID,
    hasMessageId: typeof messageId === 'string' && messageId.length > 0,
    messageId,
    relayCalls: captured.length,
    relayJid: relay.jid,
    invariantsOk,
    invariantsError,
    probeOk,
    probeRelayCalls: probeCaptured.length,
    probeResults: probeResults.length,
    probeChecks
  };
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const report = await runVerification();
  console.log(JSON.stringify(report, null, 2));

  if (!report.shapeEqual || !report.unifiedStructureEqual) {
    console.error('Payload mudou estruturalmente.');
    process.exit(1);
  }

  if (!report.primitiveMatches || !report.botJidMatches || !report.hasMessageId) {
    console.error('Validacao de primitive, JID ou messageId falhou.');
    process.exit(1);
  }

  if (!report.invariantsOk) {
    console.error(`Invariantes do payload AIRich violadas: ${report.invariantsError}`);
    process.exit(1);
  }

  if (!report.probeOk) {
    console.error('Payload do aireichprobe violou invariantes.');
    process.exit(1);
  }

  console.log('compareRichtestPayload: OK');
}

export {
  MOCK_JID,
  assertAirichInvariants,
  buildLegacyRichTestHtml,
  inspectAirichPayload,
  normalizeUnified,
  parseUnified,
  runVerification,
  shapeOf
};