import { BaseChain } from '../base/BaseChain.js';
import { VALID_FORMAT_VALUES } from '../../constants.js';
import { getPromptById } from '../../../../../shared/promptRegistry.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { sanitizeScriptLines } from '../helpers/ScriptSanitization.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';

export const APPEND_PAGE_INTENT = 'SCRIPT_APPEND_PAGE';
const LINE_MIN = 12;
const LINE_MAX = 16;
const MAX_ATTEMPTS = 3;
const MAX_CONTEXT_LINES = 30; // Smart truncation: only send recent context

// Function schema: structural only (behavioral rules live in system prompt)
const APPEND_PAGE_FUNCTIONS = [{
  name: 'provide_append_page',
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

/**
 * Smart context truncation: keep only the last N lines.
 * ENSURES semantic boundary - never cuts between speaker and dialog.
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
 */
const analyzeFirstLineConstraint = (truncatedContent) => {
  if (!truncatedContent) {
    return { lastTag: 'none', constraint: '', expectedTags: [] };
  }

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
 * Grammar validation: speaker must be followed by dialog.
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

const APPEND_PAGE_PROMPT = getPromptById('append-page');

if (!APPEND_PAGE_PROMPT) {
  throw new Error('Append page prompt definition is missing from the registry');
}

const SYSTEM_INSTRUCTION = APPEND_PAGE_PROMPT.systemInstruction;
const ATTACH_SCRIPT_CONTEXT = APPEND_PAGE_PROMPT.attachScriptContext ?? true;

export class ScriptPageAppendChain extends BaseChain {
  constructor() {
    super({
      type: APPEND_PAGE_INTENT,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'json_object' },
        functions: APPEND_PAGE_FUNCTIONS,
        function_call: { name: 'provide_append_page' }
      }
    });
  }

  addCommonInstructions(messages) {
    return messages;
  }

  buildMessages(context, prompt, retryNote = '', precomputed = {}) {
    // Use precomputed values if available (from run()), otherwise compute here
    const truncatedContent = precomputed.truncatedContent ?? (
      (context?.attachScriptContext ?? ATTACH_SCRIPT_CONTEXT)
        ? truncateToRecentLines(context.scriptContent, MAX_CONTEXT_LINES)
        : ''
    );

    // Analyze what the first output line should be (exclusive constraints)
    const { lastTag, constraint } = precomputed.lastTag
      ? { lastTag: precomputed.lastTag, constraint: precomputed.constraint }
      : analyzeFirstLineConstraint(truncatedContent);

    const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
    const collectionBlock = formatScriptCollections(context?.scriptCollections);

    // Build user message with SCRIPT CONTEXT AT VERY BOTTOM (recency bias)
    const parts = [];

    // 1. Task prompt first
    parts.push(prompt);

    // 2. First-line constraint (EXCLUSIVE - what MUST and MUST NOT)
    if (constraint) {
      parts.push(constraint);
    }

    // 3. SCENE CONTINUITY RULE (append-page specific - prevents "new page = new scene" drift)
    parts.push(`SCENE CONTINUITY RULE:
Do NOT introduce a new <header> unless the final context line clearly implies a scene change.
A new page does NOT mean a new scene.`);

    // 4. Retry note if any
    if (retryNote) {
      parts.push(`Correction: ${retryNote}`);
    }

    // 5. Script metadata (title, description)
    parts.push(scriptHeader);

    // 6. Collections (scenes, characters, etc.)
    if (collectionBlock) {
      parts.push(collectionBlock);
    }

    // 7. HARD CONTINUATION CURSOR - mechanical binding
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

    const content = parts.join('\n\n');
    const systemInstruction = context?.systemInstruction || SYSTEM_INSTRUCTION;

    return [{
      role: 'system',
      content: systemInstruction
    }, {
      role: 'user',
      content: content
    }];
  }

  validateAppendText(text) {
    if (!text || typeof text !== 'string') {
      return { ok: false, reason: 'Empty response' };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return { ok: false, reason: 'Empty response' };
    }

    if (trimmed.includes('```')) {
      return { ok: false, reason: 'Contains code fences' };
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length < LINE_MIN || lines.length > LINE_MAX) {
      return {
        ok: false,
        reason: `Line count ${lines.length} (expected ${LINE_MIN}-${LINE_MAX})`
      };
    }

    return { ok: true, lineCount: lines.length };
  }

  normalizeAppendText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  formatResponse(responseText, context, lineCount, validationError, assistantResponse = '', wasRepaired = false, grammarResult = null) {
    // Default chat message if AI didn't provide one - never use script content as chat message
    const defaultMessage = `Added ${lineCount || 'several'} lines to your script.`;
    const chatMessage = assistantResponse && assistantResponse.trim()
      ? assistantResponse.trim()
      : defaultMessage;

    // Use provided grammarResult or validate
    const grammar = grammarResult || validateScreenplayGrammar(responseText);

    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      appendPage: true,
      lineCount: lineCount || null,
      grammarValid: grammar.valid,
      grammarRepaired: wasRepaired,
      grammarErrors: grammar.errors || [],
      timestamp: new Date().toISOString()
    };

    if (validationError) {
      metadata.validationError = validationError;
    }

    // CANONICAL RESPONSE SHAPE (v2 - no legacy aliases)
    const response = {
      message: chatMessage,
      script: responseText,
      type: APPEND_PAGE_INTENT,
      metadata
    };

    Object.assign(response.metadata, buildContractMetadata(APPEND_PAGE_INTENT, response));
    return response;
  }

  async run(context, prompt) {
    let lastError = '';
    let lastResponseText = '';
    let lastAssistantResponse = '';

    // Precompute truncation and constraints ONCE (avoid duplicate work in buildMessages)
    const shouldAttachScriptContext = context?.attachScriptContext ?? ATTACH_SCRIPT_CONTEXT;
    const truncatedContent = shouldAttachScriptContext
      ? truncateToRecentLines(context.scriptContent, MAX_CONTEXT_LINES)
      : '';
    const { lastTag, constraint, expectedTags } = analyzeFirstLineConstraint(truncatedContent);
    const precomputed = { truncatedContent, lastTag, constraint };

    const maxAttempts = Number.isInteger(context?.maxAttempts) ? context.maxAttempts : MAX_ATTEMPTS;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const isLastAttempt = attempt === maxAttempts;
      const retryNote = lastError
        ? `${lastError}. Follow the screenplay grammar rules exactly. Respond only in JSON with "formattedScript" and "assistantResponse". Return 12-16 tagged lines using: ${VALID_FORMAT_VALUES.join(', ')}.`
        : '';
      const messages = await this.buildMessages(context, prompt, retryNote, precomputed);
      const response = await this.execute(messages, {
        ...context,
        chainConfig: {
          ...context.chainConfig,
          shouldGenerateQuestions: false
        }
      }, false);

      let validated = null;
      try {
        validated = this.parseFunctionPayload(response, {
          required: ['formattedScript', 'assistantResponse']
        }, 'Invalid JSON payload from function call');
      } catch (error) {
        lastError = error.message || 'Invalid append payload';
        console.warn('[ScriptPageAppendChain] Invalid append payload', {
          attempt,
          error: lastError
        });
        continue;
      }

      const formattedScript = typeof validated.formattedScript === 'string'
        ? validated.formattedScript
        : JSON.stringify(validated.formattedScript);
      lastAssistantResponse = typeof validated.assistantResponse === 'string'
        ? validated.assistantResponse
        : '';
      lastResponseText = this.normalizeAppendText(formattedScript);
      const { lines: sanitizedLines, stats } = sanitizeScriptLines(lastResponseText, VALID_FORMAT_VALUES);
      if (stats.invalidTagCount || stats.coercedCount || stats.droppedCount) {
        console.warn('[ScriptPageAppendChain] Sanitized AI output', stats);
      }
      if (sanitizedLines.length > LINE_MAX) {
        console.warn('[ScriptPageAppendChain] Truncating lines to max', {
          originalCount: sanitizedLines.length,
          max: LINE_MAX
        });
      }
      let finalLines = sanitizedLines.slice(0, LINE_MAX);

      if (finalLines.length >= LINE_MIN) {
        let finalText = finalLines.join('\n');

        // PRIORITY 4: First-line validation (cheap check before full grammar pass)
        // Hard-fail even on last attempt - grammar repair won't fix wrong first line
        if (expectedTags.length > 0) {
          const firstTagMatch = finalText.match(/^<(header|action|speaker|dialog|directions|chapter-break)>/);
          const firstTag = firstTagMatch ? firstTagMatch[1] : null;

          if (firstTag && !expectedTags.includes(firstTag)) {
            console.warn(`[ScriptPageAppendChain] First-line violation: got <${firstTag}>, expected one of [${expectedTags.join(', ')}]`);
            lastError = `First line must be <${expectedTags.join('|')}>, got <${firstTag}>`;
            continue;
          }
        }

        // Grammar validation
        let grammarResult = validateScreenplayGrammar(finalText);
        let wasRepaired = false;

        if (!grammarResult.valid) {
          console.warn('[ScriptPageAppendChain] Grammar validation failed:', grammarResult.errors);

          if (isLastAttempt) {
            // Last attempt: repair instead of failing
            console.warn('[ScriptPageAppendChain] Applying grammar repair on final attempt');
            finalText = repairScreenplayGrammar(finalText);
            grammarResult = validateScreenplayGrammar(finalText);
            wasRepaired = true;
          } else {
            // Not last attempt: continue to retry
            lastError = `Grammar violation: ${grammarResult.errors.join('; ')}`;
            continue;
          }
        }

        const validation = this.validateAppendText(finalText);
        if (validation.ok) {
          return this.formatResponse(finalText, context, validation.lineCount, null, lastAssistantResponse, wasRepaired, grammarResult);
        }
        console.warn('[ScriptPageAppendChain] Validation failed after sanitize', {
          attempt,
          reason: validation.reason
        });
        lastError = validation.reason;
      } else {
        lastError = `Line count ${finalLines.length} (expected ${LINE_MIN}-${LINE_MAX})`;
        console.warn('[ScriptPageAppendChain] Validation failed', {
          attempt,
          reason: lastError
        });
      }
    }

    throw new Error(`append_validation_failed: ${lastError}`);
  }
}
