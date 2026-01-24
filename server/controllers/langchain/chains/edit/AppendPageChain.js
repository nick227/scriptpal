import { BaseChain } from '../base/BaseChain.js';

export const APPEND_PAGE_INTENT = 'SCRIPT_APPEND_PAGE';
const LINE_MIN = 20;
const LINE_MAX = 22;
const MAX_ATTEMPTS = 3;

const SYSTEM_INSTRUCTION = `You are a screenplay continuation engine. Continue from the current script and output ONLY new screenplay lines. Return exactly 20-22 lines. Plain text only. Do not include markdown, HTML/XML tags, numbering, or commentary.`;

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

    if (trimmed.includes('<') || trimmed.includes('>')) {
      return { ok: false, reason: 'Contains markup brackets' };
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
        ? `${lastError}. Return only 20-22 plain text screenplay lines.`
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
      const validation = this.validateAppendText(lastResponseText);
      if (validation.ok) {
        return this.formatResponse(lastResponseText, context, validation.lineCount);
      }
      lastError = validation.reason;
    }

    return this.formatResponse(lastResponseText, context, null, lastError);
  }
}
