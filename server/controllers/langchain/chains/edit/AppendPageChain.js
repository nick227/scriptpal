import { BaseChain } from '../base/BaseChain.js';
import { VALID_FORMAT_VALUES } from '../../constants.js';

export const APPEND_PAGE_INTENT = 'SCRIPT_APPEND_PAGE';
const LINE_MIN = 12;
const LINE_MAX = 16;
const MAX_ATTEMPTS = 3;

const SYSTEM_INSTRUCTION = `You are a screenplay continuation engine. Continue from the current script and output ONLY new screenplay lines. Return exactly 12-16 lines. Each line must be a single XML-style script tag using only these tags: ${VALID_FORMAT_VALUES.join(', ')}. Combine consecutive action sentences into a single <action> line when they belong together. Do not include markdown, numbering, or commentary.`;

export class AppendPageChain extends BaseChain {
  constructor() {
    super({
      type: APPEND_PAGE_INTENT,
      temperature: 0.4,
      modelConfig: {
        response_format: { type: 'text' }
      }
    });
  }

  addCommonInstructions(messages) {
    return messages;
  }

  buildMessages(context, prompt, retryNote = '') {
    const userPrompt = retryNote
      ? `${prompt}\n\nCorrection: ${retryNote}`
      : prompt;
    const content = `${userPrompt}\n\nCurrent script:\n${context.scriptContent}`;

    return [{
      role: 'system',
      content: SYSTEM_INSTRUCTION
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

  sanitizeAppendLines(text) {
    const sanitized = [];
    let invalidTagCount = 0;
    let coercedCount = 0;
    let droppedCount = 0;
    let extractedCount = 0;

    const tagRegex = /<([\w-]+)\s*\/>|<([\w-]+)>([\s\S]*?)<\/\2>/g;
    let match = null;

    while ((match = tagRegex.exec(text)) !== null) {
      if (match[1]) {
        const tag = match[1].toLowerCase();
        if (tag === 'chapter-break') {
          sanitized.push('<chapter-break></chapter-break>');
          extractedCount += 1;
        } else {
          droppedCount += 1;
        }
        continue;
      }

      const tag = match[2].toLowerCase();
      const content = (match[3] || '').trim();
      if (VALID_FORMAT_VALUES.includes(tag)) {
        if (content || tag === 'chapter-break') {
          sanitized.push(`<${tag}>${content}</${tag}>`);
          extractedCount += 1;
        } else {
          droppedCount += 1;
        }
      } else {
        invalidTagCount += 1;
        if (content) {
          sanitized.push(`<action>${content}</action>`);
          coercedCount += 1;
          extractedCount += 1;
        } else {
          droppedCount += 1;
        }
      }
    }

    if (extractedCount === 0) {
      const rawLines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
      for (const line of rawLines) {
        sanitized.push(`<action>${line}</action>`);
        coercedCount += 1;
      }
    }

    if (invalidTagCount || coercedCount || droppedCount) {
      console.warn('[AppendPageChain] Sanitized AI output', {
        invalidTagCount,
        coercedCount,
        droppedCount,
        extractedCount
      });
    }

    return sanitized;
  }

  formatResponse(responseText, context, lineCount, validationError) {
    const metadata = {
      ...this.extractMetadata(context, ['scriptId', 'scriptTitle']),
      appendPage: true,
      timestamp: new Date().toISOString()
    };

    if (lineCount) {
      metadata.lineCount = lineCount;
    }

    if (validationError) {
      metadata.validationError = validationError;
    }

    return {
      response: responseText,
      type: APPEND_PAGE_INTENT,
      metadata
    };
  }

  async run(context, prompt) {
    let lastError = '';
    let lastResponseText = '';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const retryNote = lastError
        ? `${lastError}. Return only 20-22 tagged screenplay lines using: ${VALID_FORMAT_VALUES.join(', ')}.`
        : '';
      const messages = await this.buildMessages(context, prompt, retryNote);
      const response = await this.execute(messages, {
        ...context,
        chainConfig: {
          ...context.chainConfig,
          shouldGenerateQuestions: false
        }
      }, false);

      lastResponseText = typeof response === 'string' ? response : response.response || '';
      lastResponseText = this.normalizeAppendText(lastResponseText);
      const sanitizedLines = this.sanitizeAppendLines(lastResponseText);
      if (sanitizedLines.length > LINE_MAX) {
        console.warn('[AppendPageChain] Truncating lines to max', {
          originalCount: sanitizedLines.length,
          max: LINE_MAX
        });
      }
      const finalLines = sanitizedLines.slice(0, LINE_MAX);
      if (finalLines.length >= LINE_MIN) {
        const finalText = finalLines.join('\n');
        const validation = this.validateAppendText(finalText);
        if (validation.ok) {
          return this.formatResponse(finalText, context, validation.lineCount);
        }
        console.warn('[AppendPageChain] Validation failed after sanitize', {
          attempt,
          reason: validation.reason
        });
        lastError = validation.reason;
      } else {
        lastError = `Line count ${finalLines.length} (expected ${LINE_MIN}-${LINE_MAX})`;
        console.warn('[AppendPageChain] Validation failed', {
          attempt,
          reason: lastError
        });
      }
    }

    throw new Error(`append_validation_failed: ${lastError}`);
  }
}
