import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata, validateAiResponse } from '../helpers/ChainOutputGuards.js';

// Function schema: structural only (behavioral guidance lives in prompt/system)
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

const EXPECTED_LINE_COUNT = 5;
const MAX_CONTEXT_LINES = 20; // Only send last N lines for better relevance & lower tokens

/**
 * Smart context truncation: keep only the last N lines.
 * Attempts to preserve a speaker→dialog boundary when truncation starts on dialog/directions.
 * @param {string} scriptContent - Full script content
 * @param {number} maxLines - Maximum lines to keep
 * @returns {string} - Truncated content
 */
const truncateToRecentLines = (scriptContent, maxLines = MAX_CONTEXT_LINES) => {
  if (!scriptContent || typeof scriptContent !== 'string') {
    return '';
  }

  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>[\s\S]*?<\/\1>/g;
  const matches = scriptContent.match(tagPattern);

  if (!matches || matches.length <= maxLines) {
    return scriptContent;
  }

  // Take last N lines
  let recentLines = matches.slice(-maxLines);

  // If we cut onto a dialog/directions, include the preceding speaker if present
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

/**
 * Continuation bias: gentle guidance for what tends to follow the last tag.
 * No enforcement; used only to nudge the model without confusing it.
 * @param {string} truncatedContent
 * @returns {{lastTag: string, hint: string}}
 */
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

  if (prefers) hintLines.push(`Preferred next tags: ${prefers}${allows ? ` (also ok: ${allows})` : ''}.`);

  return { lastTag, hint: hintLines.join('\n') };
};

const escapeLineText = (text) => {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const normalizeTag = (tag) => {
  if (!tag) return '';
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
    description: 'action',
    parenthetical: 'directions',
    direction: 'directions',
    character: 'speaker',
    name: 'speaker',
    dialogue: 'dialog',
    line: 'dialog',
    'chapterbreak': 'chapter-break',
    break: 'chapter-break'
  };

  return aliases[normalized] || normalized;
};

const ALLOWED_TAGS = new Set([...VALID_FORMAT_VALUES, 'chapter-break']);

const extractInlineTaggedLine = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^<\s*([a-z-]+)\s*>([\s\S]*?)<\/\s*\1\s*>$/i);
  if (!match) return null;
  return {
    tag: normalizeTag(match[1]),
    text: String(match[2] ?? '').trim()
  };
};

const normalizeLineCandidate = (line) => {
  if (typeof line === 'string') {
    const inline = extractInlineTaggedLine(line);
    if (inline) return inline;
    return { tag: '', text: line.trim() };
  }

  const rawTag = line?.tag ?? line?.type ?? line?.lineTag ?? '';
  const rawText = line?.text ?? line?.value ?? line?.content ?? line?.line ?? '';
  const inlineFromText = extractInlineTaggedLine(rawText);
  const inlineFromTag = extractInlineTaggedLine(rawTag);

  if (!rawTag && inlineFromText) {
    return inlineFromText;
  }

  if (inlineFromTag) {
    return inlineFromTag;
  }

  return {
    tag: normalizeTag(rawTag),
    text: typeof rawText === 'string'
      ? rawText.trim()
      : String(rawText ?? '').trim()
  };
};

const renderLinesToXml = (lines) => {
  return lines
    .map((l) => `<${l.tag}>${escapeLineText(l.text)}</${l.tag}>`)
    .join('\n');
};

const MAX_ATTEMPTS = 1;

export class ScriptNextLinesChain extends BaseChain {
  constructor () {
    super({
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: NEXT_FIVE_FUNCTIONS,
        function_call: { name: 'provide_next_lines' }
      }
    });
  }

  async run (context, prompt) {
    let lastError = '';
    const maxAttempts = Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const retryNote = lastError
          ? `Quick correction: ${lastError}. Please continue cleanly.`
          : '';
        const messages = await this.buildMessages(context, prompt, retryNote);
        const rawResponse = await this.execute(messages, context, false);
        const isLastAttempt = attempt === maxAttempts;
        return this.formatResponse(rawResponse, isLastAttempt);
      } catch (error) {
        lastError = error.message || 'Invalid response';
        console.warn(`[ScriptNextLinesChain] Attempt ${attempt}/${maxAttempts} failed:`, lastError);
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
  }

  buildMessages (context, prompt, retryNote = '') {
    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);

    // Only send last N lines
    const truncatedContent = truncateToRecentLines(context?.scriptContent, MAX_CONTEXT_LINES);

    // Gentle continuation hint (no enforcement)
    const { hint } = analyzeContinuationBias(truncatedContent);

    const parts = [];

    // 1) Task prompt first
    parts.push(prompt);

    // 2) Convert prompt to match new output shape
    parts.push(
      `Return exactly ${EXPECTED_LINE_COUNT} new screenplay lines using the function call schema.`,
      `Do not repeat anything from the provided context.`
    );

    // 3) Gentle continuation hint
    if (hint) {
      parts.push(hint);
    }

    // 4) Retry note (lightweight)
    if (retryNote) {
      parts.push(retryNote);
    }

    // 5) Script metadata
    parts.push(scriptHeader);

    // 6) Context at bottom for recency bias (no "cursor" theatrics)
    if (truncatedContent) {
      parts.push(
        `Most recent script context (continue after this point, without repeating it):\n\n${truncatedContent}`
      );
    } else {
      parts.push('No existing script content. Start fresh.');
    }

    const userContent = parts.join('\n\n');

    return [{
      role: 'system',
      content: context?.systemInstruction
    }, {
      role: 'user',
      content: userContent
    }];
  }

  addCommonInstructions (messages) {
    return messages;
  }

  formatResponse (response, _isLastAttempt = false) {
    const schema = { required: ['lines', 'assistantResponse'] };
    const validated = this.parseFunctionPayload(response, schema, 'Invalid JSON payload from function call');

    const lines = Array.isArray(validated.lines) ? validated.lines : [];

    const normalizedCandidates = lines
      .map(normalizeLineCandidate)
      .filter((line) => ALLOWED_TAGS.has(line.tag) && line.text.length > 0);

    if (normalizedCandidates.length < EXPECTED_LINE_COUNT) {
      throw new Error('script_lines_invalid');
    }

    const safeLines = normalizedCandidates.slice(0, EXPECTED_LINE_COUNT);

    if (safeLines[0]?.tag === 'chapter-break') {
      throw new Error('leading_chapter_break');
    }

    for (let i = 1; i < safeLines.length; i += 1) {
      if (safeLines[i].tag === 'chapter-break' && safeLines[i - 1].tag === 'chapter-break') {
        throw new Error('consecutive_chapter_breaks');
      }
    }

    const script = renderLinesToXml(safeLines);

    if (!script || !script.trim()) {
      throw new Error('script_lines_missing');
    }

    const extractedMeta = this.extractMetadata(response, ['scriptId', 'scriptTitle']);

    const defaultMessage = `Added ${safeLines.length} lines to your script.`;
    const chatMessage = validated.assistantResponse && validated.assistantResponse.trim()
      ? validated.assistantResponse.trim()
      : defaultMessage;

    const metadata = {
      ...(response?.metadata || {}),
      ...extractedMeta,
      lineCount: safeLines.length,
      timestamp: new Date().toISOString()
    };

    const formattedResponse = {
      message: chatMessage,
      script,
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      metadata
    };

    const validation = validateAiResponse(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse);
    if (!validation.valid) {
      throw new Error(`ai_response_invalid: ${validation.errors.join('; ')}`);
    }

    Object.assign(formattedResponse.metadata, buildContractMetadata(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse));

    this.ensureCanonicalResponse(formattedResponse);

    this.persistAssistantMessage(response, chatMessage);

    return this.attachPersistedFlag(formattedResponse, response);
  }
}
