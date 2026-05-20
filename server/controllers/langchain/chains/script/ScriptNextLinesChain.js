import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildWritingOutput, runWritingAttemptLoop } from '../helpers/writingChainRunner.js';

const NEXT_FIVE_FUNCTIONS = [{
  name: 'provide_next_lines',
  description: 'Continue the screenplay with the next five lines.',
  parameters: {
    type: 'object',
    properties: {
      lines: {
        type: 'array',
        description: 'Exactly five screenplay lines, in natural screenplay order.',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              enum: VALID_FORMAT_VALUES,
              description: 'Pick the most natural screenplay tag for this line.'
            },
            text: {
              type: 'string',
              minLength: 1,
              description: 'Content for this line only. Do not repeat previous lines.'
            }
          },
          required: ['tag', 'text'],
          additionalProperties: false
        }
      },
      assistantResponse: {
        type: 'string',
        description: 'Brief explanation.'
      }
    },
    required: ['lines', 'assistantResponse'],
    additionalProperties: false
  }
}];

const TARGET_LINE_COUNT = 5;
const MIN_VALID_LINES = 2;
const MAX_CONTEXT_LINES = 20;
const MAX_ATTEMPTS = 3;

const truncateToRecentLines = (scriptContent, maxLines = MAX_CONTEXT_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return '';
  }

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);

  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }

  let recentLines = matches.slice(-maxLines);

  const firstLine = recentLines[0];
  if (firstLine && (firstLine.startsWith('<dialog>') || firstLine.startsWith('<directions>'))) {
    const cutIndex = matches.length - maxLines;
    if (cutIndex > 0) {
      const preceding = matches[cutIndex - 1];
      if (preceding && preceding.startsWith('<speaker>')) {
        recentLines = [preceding, ...recentLines];
      }
    }
  }

  return recentLines.join('\n');
};

const analyzeContinuationBias = (truncatedContent) => {
  if (!truncatedContent) {
    return { lastTag: 'none', hint: '' };
  }

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  const matches = [...truncatedContent.matchAll(tagPattern)];
  if (matches.length === 0) {
    return { lastTag: 'none', hint: '' };
  }

  const lastTag = matches[matches.length - 1][1];

  const BIAS = {
    header: {
      prefers: ['action', 'speaker'],
      note: 'After a header, action or a speaker usually follows.'
    },
    action: {
      prefers: ['action', 'speaker', 'header'],
      note: 'Action often continues, introduces a speaker, or shifts to a new header.'
    },
    speaker: {
      prefers: ['dialog'],
      allows: ['directions'],
      note: 'A speaker is typically followed by dialog (sometimes a brief directions beat first).'
    },
    dialog: {
      prefers: ['speaker', 'action'],
      allows: ['header'],
      note: 'Dialog often moves to another speaker or an action beat.'
    },
    directions: {
      prefers: ['dialog'],
      note: 'Directions usually lead into dialog.'
    },
    'chapter-break': {
      prefers: ['header'],
      note: 'After a chapter break, a new header usually follows.'
    }
  };

  const entry = BIAS[lastTag];
  if (!entry) {
    return { lastTag, hint: '' };
  }

  const prefers = entry.prefers?.length ? entry.prefers.map(t => `<${t}>`).join(', ') : '';
  const allows = entry.allows?.length ? entry.allows.map(t => `<${t}>`).join(', ') : '';

  const hintLines = [
    `Continuation hint (based on last line type <${lastTag}>):`,
    entry.note
  ];

  if (prefers) {
    hintLines.push(`Preferred next tags: ${prefers}${allows ? ` (also ok: ${allows})` : ''}.`);
  }

  return { lastTag, hint: hintLines.join('\n') };
};

const escapeLineText = (text) => String(text ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const normalizeTag = (tag) => {
  if (!tag) {
    return '';
  }
  const normalized = String(tag)
    .trim()
    .replace(/^<+\s*\/?\s*|\/?\s*>+$/g, '')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .toLowerCase();

  const aliases = {
    scene: 'header',
    'scene-heading': 'header',
    'scene-header': 'header',
    heading: 'header',
    slugline: 'header',
    slug: 'header',
    description: 'action',
    parenthetical: 'directions',
    direction: 'directions',
    character: 'speaker',
    name: 'speaker',
    dialogue: 'dialog',
    line: 'dialog',
    chapterbreak: 'chapter-break',
    break: 'chapter-break'
  };

  return aliases[normalized] || normalized;
};

const ALLOWED_TAGS = new Set([...VALID_FORMAT_VALUES, 'chapter-break']);

const extractInlineTaggedLine = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const match = value.trim().match(/^<\s*([a-z-]+)\s*>([\s\S]*?)<\/\s*\1\s*>$/i);
  if (!match) {
    return null;
  }
  return {
    tag: normalizeTag(match[1]),
    text: String(match[2] ?? '').trim()
  };
};

const extractEmbeddedXmlLines = (value) => {
  if (typeof value !== 'string' || !value.includes('<')) {
    return [];
  }
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/gi;
  const matches = value.match(tagPattern);
  if (!matches?.length) {
    return [];
  }
  return matches
    .map((line) => extractInlineTaggedLine(line))
    .filter((line) => line && ALLOWED_TAGS.has(line.tag) && line.text.length > 0);
};

const inferTagFromText = (text, previousTag = '') => {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return '';
  }
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
    return 'header';
  }
  if (/^\(.+\)$/.test(trimmed)) {
    return 'directions';
  }
  if (trimmed === trimmed.toUpperCase() && trimmed.length < 40 && !trimmed.includes('.')) {
    return previousTag === 'speaker' ? 'dialog' : 'speaker';
  }
  return 'action';
};

const normalizeLineCandidate = (line, previousTag = '') => {
  if (line == null) {
    return { tag: '', text: '' };
  }

  if (typeof line === 'string') {
    const embedded = extractEmbeddedXmlLines(line);
    if (embedded.length === 1) {
      return embedded[0];
    }
    const inline = extractInlineTaggedLine(line);
    if (inline) {
      return inline;
    }
    const text = line.trim();
    const tag = inferTagFromText(text, previousTag);
    return { tag, text };
  }

  const rawTag = line?.tag ?? line?.type ?? line?.lineTag ?? line?.format ?? '';
  const rawText = line?.text ?? line?.value ?? line?.content ?? line?.line ?? line?.body ?? '';
  const inlineFromText = extractInlineTaggedLine(rawText);
  const inlineFromTag = extractInlineTaggedLine(rawTag);

  if (!rawTag && inlineFromText) {
    return inlineFromText;
  }

  if (inlineFromTag) {
    return inlineFromTag;
  }

  const tag = normalizeTag(rawTag) || inferTagFromText(rawText, previousTag);
  const text = typeof rawText === 'string'
    ? rawText.trim()
    : String(rawText ?? '').trim();

  return { tag, text };
};

const flattenRawLines = (rawLines) => {
  if (!Array.isArray(rawLines)) {
    return [];
  }

  const flattened = [];
  let previousTag = '';

  rawLines.forEach((entry) => {
    if (typeof entry === 'string' && entry.includes('<')) {
      const embedded = extractEmbeddedXmlLines(entry);
      if (embedded.length) {
        embedded.forEach((line) => {
          flattened.push(line);
          previousTag = line.tag;
        });
        return;
      }
    }

    const normalized = normalizeLineCandidate(entry, previousTag);
    if (normalized.text && extractEmbeddedXmlLines(normalized.text).length > 1) {
      extractEmbeddedXmlLines(normalized.text).forEach((line) => {
        flattened.push(line);
        previousTag = line.tag;
      });
      return;
    }

    flattened.push(normalized);
    if (normalized.tag) {
      previousTag = normalized.tag;
    }
  });

  return flattened;
};

const coalesceLinesFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  if (Array.isArray(payload.lines)) {
    return payload.lines;
  }
  if (Array.isArray(payload.script_lines)) {
    return payload.script_lines;
  }
  if (typeof payload.lines === 'string') {
    try {
      const parsed = JSON.parse(payload.lines);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return extractEmbeddedXmlLines(payload.lines);
    }
  }
  return [];
};

const normalizeValidLines = (rawLines) => {
  const candidates = flattenRawLines(rawLines);
  return candidates.filter((line) => ALLOWED_TAGS.has(line.tag) && line.text.length > 0);
};

const renderLinesToXml = (lines) => lines
  .map((l) => `<${l.tag}>${escapeLineText(l.text)}</${l.tag}>`)
  .join('\n');

const assertLineGrammar = (safeLines) => {
  if (safeLines[0]?.tag === 'chapter-break') {
    throw new Error('leading_chapter_break');
  }

  for (let i = 1; i < safeLines.length; i += 1) {
    if (safeLines[i].tag === 'chapter-break' && safeLines[i - 1].tag === 'chapter-break') {
      throw new Error('consecutive_chapter_breaks');
    }
  }
};

export class ScriptNextLinesChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      temperature: 0.4,
      modelConfig: {
        functions: NEXT_FIVE_FUNCTIONS,
        function_call: { name: 'provide_next_lines' }
      }
    });
  }

  async run (context, prompt) {
    const maxAttempts = Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS;

    return runWritingAttemptLoop({
      maxAttempts,
      runAttempt: async ({ retryNote }) => {
        const messages = await this.buildMessages(context, prompt, retryNote);
        const rawResponse = await this.execute(messages, context, false);
        return this.formatResponse(rawResponse);
      }
    });
  }

  buildMessages (context, prompt, retryNote = '') {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const truncatedContent = truncateToRecentLines(context?.scriptContent, MAX_CONTEXT_LINES);
    const { hint } = analyzeContinuationBias(truncatedContent);

    const parts = [
      prompt,
      `Return exactly ${TARGET_LINE_COUNT} new screenplay lines using the function call schema.`,
      'Each line must use tag values: header, action, speaker, dialog, directions, or chapter-break.',
      'Do not repeat anything from the provided context.'
    ];

    if (hint) {
      parts.push(hint);
    }

    if (retryNote) {
      parts.push(retryNote);
    }

    parts.push(scriptHeader);

    if (truncatedContent) {
      parts.push(
        `Most recent script context (continue after this point, without repeating it):\n\n${truncatedContent}`
      );
    } else {
      parts.push('No existing script content. Start fresh.');
    }

    return [{
      role: 'system',
      content: context?.systemInstruction
    }, {
      role: 'user',
      content: parts.join('\n\n')
    }];
  }

  addCommonInstructions (messages) {
    return messages;
  }

  formatResponse (response) {
    const schema = { required: ['lines', 'assistantResponse'] };
    const validated = this.parseFunctionPayload(response, schema, 'Invalid JSON payload from function call');
    const rawLines = coalesceLinesFromPayload(validated);
    const normalizedCandidates = normalizeValidLines(rawLines);

    if (normalizedCandidates.length < MIN_VALID_LINES) {
      console.warn('[ScriptNextLinesChain] script_lines_invalid', {
        rawCount: rawLines.length,
        validCount: normalizedCandidates.length,
        sample: rawLines.slice(0, 3)
      });
      throw new Error(
        `script_lines_invalid: got ${normalizedCandidates.length} valid lines, need at least ${MIN_VALID_LINES}`
      );
    }

    const safeLines = normalizedCandidates.slice(0, TARGET_LINE_COUNT);
    assertLineGrammar(safeLines);

    const script = renderLinesToXml(safeLines);
    if (!script.trim()) {
      throw new Error('script_lines_missing');
    }

    const extractedMeta = this.extractMetadata(response, ['scriptId', 'scriptTitle']);
    const defaultMessage = `Added ${safeLines.length} line${safeLines.length === 1 ? '' : 's'} to your script.`;
    const rawAssistant = validated.assistantResponse && String(validated.assistantResponse).trim()
      ? String(validated.assistantResponse).trim()
      : defaultMessage;

    const formattedResponse = buildWritingOutput({
      contractKey: INTENT_TYPES.NEXT_FIVE_LINES,
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      assistantMessage: rawAssistant,
      formattedScript: script,
      metadata: {
        ...(response?.metadata || {}),
        ...extractedMeta,
        lineCount: safeLines.length,
        requestedLineCount: TARGET_LINE_COUNT,
        timestamp: new Date().toISOString()
      }
    });

    this.ensureCanonicalResponse(formattedResponse);
    this.persistAssistantMessage(response, formattedResponse.message);

    return this.attachPersistedFlag(formattedResponse, response);
  }
}
