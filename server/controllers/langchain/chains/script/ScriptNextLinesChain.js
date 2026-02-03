import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { buildContractMetadata, validateAiResponse } from '../helpers/ChainOutputGuards.js';
import { normalizeFormattedScript } from '../../../../lib/scriptFormatter.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

// Function schema: structural only, no behavioral rules (those live in system prompt)
const NEXT_FIVE_FUNCTIONS = [{
  name: 'provide_next_lines',
  description: 'Return script continuation.',
  parameters: {
    type: 'object',
    properties: {
      formattedScript: {
        type: 'string',
        description: 'Script lines in XML tags.'
      },
      assistantResponse: {
        type: 'string',
        description: 'Brief explanation.'
      }
    },
    required: ['formattedScript', 'assistantResponse']
  }
}];

const EXPECTED_LINE_COUNT = 5;
const MAX_CONTEXT_LINES = 20; // Only send last N lines for better relevance & lower tokens
const VALID_TAGS_PATTERN = new RegExp(`<(${VALID_FORMAT_VALUES.join('|')})>`, 'g');

/**
 * Smart context truncation: keep only the last N lines.
 * ENSURES semantic boundary - never cuts between speaker and dialog.
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

  // SEMANTIC BOUNDARY: If first line is <dialog> or <directions>, include preceding <speaker>
  const firstTag = recentLines[0];
  if (firstTag && (firstTag.startsWith('<dialog>') || firstTag.startsWith('<directions>'))) {
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
 * Analyze last line and determine what the AI should output first.
 * Returns EXCLUSIVE constraints (what to start with AND what NOT to start with).
 * @param {string} truncatedContent - The truncated script content
 * @returns {{lastTag: string, constraint: string, expectedTags: string[]}}
 */
const analyzeFirstLineConstraint = (truncatedContent) => {
  if (!truncatedContent) {
    return { lastTag: 'none', constraint: '', expectedTags: [] };
  }

  // Find the last tag type
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  const matches = [...truncatedContent.matchAll(tagPattern)];
  if (matches.length === 0) {
    return { lastTag: 'none', constraint: '', expectedTags: [] };
  }

  const lastTag = matches[matches.length - 1][1];

  // EXCLUSIVE constraints: what MUST and MUST NOT start with
  const constraintMap = {
    'header': {
      must: ['action', 'speaker'],
      mustNot: ['header', 'dialog', 'directions', 'chapter-break'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <action> or <speaker>.
- You MUST NOT start with <header>, <dialog>, <directions>, or <chapter-break>.
- Violation = invalid output.`
    },
    'action': {
      must: ['speaker', 'action', 'header'],
      mustNot: ['dialog', 'directions'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <speaker>, <action>, or <header>.
- You MUST NOT start with <dialog> or <directions>.
- Violation = invalid output.`
    },
    'speaker': {
      must: ['dialog', 'directions'],
      mustNot: ['speaker', 'header', 'action', 'chapter-break'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <dialog> (or <directions> then <dialog>).
- You MUST NOT start with <speaker>, <header>, <action>, or <chapter-break>.
- Violation = invalid output.`
    },
    'dialog': {
      must: ['speaker', 'action', 'header'],
      mustNot: ['dialog', 'directions'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <speaker>, <action>, or <header>.
- You MUST NOT start with <dialog> or <directions>.
- Violation = invalid output.`
    },
    'directions': {
      must: ['dialog'],
      mustNot: ['speaker', 'header', 'action', 'directions', 'chapter-break'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <dialog>.
- You MUST NOT start with <speaker>, <header>, <action>, <directions>, or <chapter-break>.
- Violation = invalid output.`
    },
    'chapter-break': {
      must: ['header'],
      mustNot: ['speaker', 'action', 'dialog', 'directions', 'chapter-break'],
      text: `FIRST LINE CONSTRAINT:
- You MUST start with <header>.
- You MUST NOT start with <speaker>, <action>, <dialog>, <directions>, or <chapter-break>.
- Violation = invalid output.`
    }
  };

  const entry = constraintMap[lastTag] || { must: [], mustNot: [], text: '' };

  return {
    lastTag,
    constraint: entry.text,
    expectedTags: entry.must
  };
};

/**
 * Hard validation: exactly 5 lines required.
 * @param {string} formattedScript
 * @returns {{valid: boolean, count: number, error?: string}}
 */
const validateLineCount = (formattedScript) => {
  const matches = formattedScript.match(VALID_TAGS_PATTERN);
  const count = matches ? matches.length : 0;
  if (count !== EXPECTED_LINE_COUNT) {
    return {
      valid: false,
      count,
      error: `Expected ${EXPECTED_LINE_COUNT} lines, got ${count}`
    };
  }
  return { valid: true, count };
};

/**
 * Grammar validation: speaker must be followed by dialog.
 * @param {string} formattedScript
 * @returns {{valid: boolean, errors: string[]}}
 */
const validateScreenplayGrammar = (formattedScript) => {
  const tagSequence = [];
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>/g;
  let match;
  while ((match = tagPattern.exec(formattedScript)) !== null) {
    tagSequence.push(match[1]);
  }

  const errors = [];

  for (let i = 0; i < tagSequence.length; i++) {
    if (tagSequence[i] === 'speaker') {
      const next = tagSequence[i + 1];
      const afterNext = tagSequence[i + 2];
      if (next !== 'dialog' && !(next === 'directions' && afterNext === 'dialog')) {
        errors.push(`<speaker> at position ${i + 1} not followed by <dialog>`);
      }
    }
    if (tagSequence[i] === 'dialog') {
      const prev = tagSequence[i - 1];
      const beforePrev = tagSequence[i - 2];
      if (prev !== 'speaker' && !(prev === 'directions' && beforePrev === 'speaker')) {
        errors.push(`<dialog> at position ${i + 1} has no preceding <speaker>`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Repair grammar violations by inserting missing speakers.
 * @param {string} formattedScript
 * @returns {string}
 */
const repairScreenplayGrammar = (formattedScript) => {
  const tagPattern = /<(header|action|speaker|dialog|directions|chapter-break)>([\s\S]*?)<\/\1>/g;
  const lines = [];
  let match;
  while ((match = tagPattern.exec(formattedScript)) !== null) {
    lines.push({ tag: match[1], content: match[2] });
  }

  const repaired = [];
  let lastSpeaker = null;

  for (let i = 0; i < lines.length; i++) {
    const { tag, content } = lines[i];

    if (tag === 'speaker') {
      lastSpeaker = content;
      repaired.push(`<speaker>${content}</speaker>`);
    } else if (tag === 'dialog') {
      const prev = lines[i - 1]?.tag;
      const beforePrev = lines[i - 2]?.tag;
      const needsSpeaker = prev !== 'speaker' && !(prev === 'directions' && beforePrev === 'speaker');

      if (needsSpeaker) {
        // Insert last known speaker or placeholder
        const speakerName = lastSpeaker || 'CHARACTER';
        repaired.push(`<speaker>${speakerName}</speaker>`);
        console.warn(`[GrammarRepair] Inserted missing <speaker>${speakerName}</speaker> before dialog`);
      }
      repaired.push(`<dialog>${content}</dialog>`);
    } else {
      repaired.push(`<${tag}>${content}</${tag}>`);
    }
  }

  return repaired.join('\n');
};

const MAX_ATTEMPTS = 3;

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

    // Get expected first-line tags for validation
    const truncatedContent = truncateToRecentLines(context?.scriptContent, MAX_CONTEXT_LINES);
    const { expectedTags } = analyzeFirstLineConstraint(truncatedContent);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const retryNote = lastError
          ? `Correction: ${lastError}. Follow the screenplay grammar rules exactly.`
          : '';
        const messages = await this.buildMessages(context, prompt, retryNote);
        const rawResponse = await this.execute(messages, context, false);
        const isLastAttempt = attempt === maxAttempts;
        return this.formatResponse(rawResponse?.response ?? rawResponse, isLastAttempt, expectedTags);
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
    const collectionBlock = formatScriptCollections(context?.scriptCollections);

    // Smart context truncation: only send last N lines (semantic boundary safe)
    const truncatedContent = truncateToRecentLines(context?.scriptContent, MAX_CONTEXT_LINES);

    // Analyze what the first output line should be (exclusive constraints)
    const { lastTag, constraint } = analyzeFirstLineConstraint(truncatedContent);

    // Build user message with SCRIPT CONTEXT AT VERY BOTTOM (recency bias)
    const parts = [];

    // 1. Task prompt first
    parts.push(prompt);

    // 2. First-line constraint (EXCLUSIVE - what MUST and MUST NOT)
    if (constraint) {
      parts.push(constraint);
    }

    // 3. Retry note if any
    if (retryNote) {
      parts.push(`Correction: ${retryNote}`);
    }

    // 4. Script metadata (title, description)
    parts.push(scriptHeader);

    // 5. Collections (scenes, characters, etc.)
    if (collectionBlock) {
      parts.push(collectionBlock);
    }

    // 6. HARD CONTINUATION CURSOR - mechanical binding
    if (truncatedContent) {
      parts.push(`=== CONTINUATION CURSOR ===
The cursor is positioned AFTER the final tag below.
You MUST NOT repeat, paraphrase, or restate the final line.
Your first output line MUST immediately follow it.
Last line type: <${lastTag}>

${truncatedContent}`);
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

  formatResponse (response, isLastAttempt = false, expectedTags = []) {
    const schema = { required: ['formattedScript', 'assistantResponse'] };
    const validated = this.parseFunctionPayload(response, schema, 'Invalid JSON payload from function call');
    console.log('[ScriptNextLinesChain] function payload', validated);

    const formattedScript = typeof validated.formattedScript === 'string'
      ? validated.formattedScript
      : JSON.stringify(validated.formattedScript);
    let normalizedScript = normalizeFormattedScript(formattedScript);

    if (!normalizedScript || !normalizedScript.trim()) {
      throw new Error('formatted_script_missing');
    }

    // PRIORITY 4: First-line validation (cheap check before full grammar pass)
    // Hard-fail even on last attempt - grammar repair won't fix wrong first line
    if (expectedTags.length > 0) {
      const firstTagMatch = normalizedScript.match(/^<(header|action|speaker|dialog|directions|chapter-break)>/);
      const firstTag = firstTagMatch ? firstTagMatch[1] : null;

      if (firstTag && !expectedTags.includes(firstTag)) {
        console.warn(`[ScriptNextLinesChain] First-line violation: got <${firstTag}>, expected one of [${expectedTags.join(', ')}]`);
        throw new Error(`first_line_invalid: Expected <${expectedTags.join('|')}>, got <${firstTag}>`);
      }
    }

    // Grammar validation: screenplay rules
    let grammarResult = validateScreenplayGrammar(normalizedScript);
    let wasRepaired = false;

    if (!grammarResult.valid) {
      console.warn('[ScriptNextLinesChain] Grammar validation failed:', grammarResult.errors);

      if (isLastAttempt) {
        // Last attempt: repair instead of failing
        console.warn('[ScriptNextLinesChain] Applying grammar repair on final attempt');
        normalizedScript = repairScreenplayGrammar(normalizedScript);
        grammarResult = validateScreenplayGrammar(normalizedScript);
        wasRepaired = true;
      } else {
        // Not last attempt: throw to trigger retry
        throw new Error(`grammar_invalid: ${grammarResult.errors.join('; ')}`);
      }
    }

    // Hard validation: exactly 5 lines (after potential repair)
    const lineCountResult = validateLineCount(normalizedScript);
    if (!lineCountResult.valid) {
      console.warn('[ScriptNextLinesChain] Line count validation failed:', lineCountResult);
      throw new Error(`line_count_invalid: ${lineCountResult.error}`);
    }

    const extractedMeta = this.extractMetadata(response, ['scriptId', 'scriptTitle']);

    // Default chat message if AI didn't provide one
    const defaultMessage = `Added ${lineCountResult.count} lines to your script.`;
    const chatMessage = validated.assistantResponse && validated.assistantResponse.trim()
      ? validated.assistantResponse.trim()
      : defaultMessage;

    // Build metadata
    const metadata = {
      ...(response?.metadata || {}),
      ...extractedMeta,
      lineCount: lineCountResult.count,
      grammarValid: grammarResult.valid,
      grammarRepaired: wasRepaired,
      grammarErrors: grammarResult.errors || [],
      timestamp: new Date().toISOString()
    };

    // CANONICAL RESPONSE SHAPE (v2 - no legacy aliases)
    const formattedResponse = {
      message: chatMessage,
      script: normalizedScript,
      type: INTENT_TYPES.NEXT_FIVE_LINES,
      metadata
    };

    const validation = validateAiResponse(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse);
    if (!validation.valid) {
      throw new Error(`ai_response_invalid: ${validation.errors.join('; ')}`);
    }

    Object.assign(formattedResponse.metadata, buildContractMetadata(INTENT_TYPES.NEXT_FIVE_LINES, formattedResponse));
    return formattedResponse;
  }

}
