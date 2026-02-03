import { validateAiResponse } from '../../../../../shared/langchainConstants.js';
import { MESSAGE_TYPES } from '../../../constants.js';
import { EventManager } from '../../../core/EventManager.js';

export class ScriptOperationsHandler {
    constructor ({ getScriptOrchestrator, eventManager, renderMessage, onError } = {}) {
        this.getScriptOrchestrator = getScriptOrchestrator;
        this.eventManager = eventManager;
        this.renderMessage = renderMessage;
        this.onError = onError || (() => {});
    }

    async handleIntent (intent, data) {
        if (!intent) {
            return;
        }

        try {
            if (intent === 'EDIT_SCRIPT' || intent === 'WRITE_SCRIPT') {
                await this._handleScriptEdit(data);
            } else if (intent === 'ANALYZE_SCRIPT') {
                await this._handleScriptAnalysis(data);
            } else if (intent === 'APPEND_SCRIPT') {
                await this._handleScriptAppend(data);
            }
        } catch (error) {
            this.onError(error, 'handleScriptIntent');
        }
    }

    async _handleScriptEdit (data) {
        const orchestrator = this.getScriptOrchestrator && this.getScriptOrchestrator();
        const content = data.response && data.response.content;
        const commands = data.response && data.response.commands;
        const versionNumber = data.response && (data.response.versionNumber ?? data.response.version_number);

        if (!content) {
            console.warn('[ScriptOperationsHandler] No content provided for script edit');
            return;
        }

        if (!orchestrator) {
            console.warn('[ScriptOperationsHandler] No script orchestrator available for script edit');
            return;
        }

        try {
            await orchestrator.handleScriptEdit({
                content,
                isFromEdit: true,
                versionNumber,
                commands
            });
        } catch (error) {
            console.error('[ScriptOperationsHandler] Script edit failed:', error);
            this.onError(error, 'handleScriptEdit');
        }
    }

    async _handleScriptAnalysis (data) {
        try {
            if (!data || !data.response) {
                throw new Error('Invalid analysis data received');
            }

            const analysis = data.response;
            if (this.renderMessage) {
                await this.renderMessage(analysis, MESSAGE_TYPES.ASSISTANT);
            }

            if (this.eventManager) {
                this.eventManager.publish(EventManager.EVENTS.SCRIPT.ANALYSIS_COMPLETE, {
                    analysis,
                    scriptId: data.scriptId
                });
            }
        } catch (error) {
            console.error('[ScriptOperationsHandler] Script analysis failed:', error);
            this.onError(error, 'scriptAnalysis');
        }
    }

    async _handleScriptAppend (data) {
        const orchestrator = this.getScriptOrchestrator && this.getScriptOrchestrator();
        const metadata = data?.response?.metadata || null;
        const validationIntent = metadata?.contract || metadata?.generationMode || 'APPEND_SCRIPT';
        const aiValidation = validateAiResponse(validationIntent, data?.response);
        if (!aiValidation.valid) {
            console.warn('[ScriptOperationsHandler] Validation failed for append response', {
                errors: aiValidation.errors
            });
            this.onError(new Error('AI response format invalid for append'), 'handleScriptAppend');
            return;
        }

        if (this._hasLineInsertionData(data)) {
            await this._handleLineInsertion(data);
            return;
        }

        const rawContent = this._extractAppendContent(data) || aiValidation.script || '';
        const content = this._sanitizeAppendContent(rawContent);
        if (!content || !content.trim()) {
            this._emitScriptBlockedEmpty({
                intent: 'APPEND_SCRIPT',
                reason: 'empty_script_output'
            });
            return;
        }
        const normalizedContent = orchestrator?.splitLongAiLines
            ? orchestrator.splitLongAiLines(content)
            : content;
        if (typeof content === 'string') {
            const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
            const taggedCount = lines.filter(line =>
                /^<([\w-]+)>([\s\S]*)<\/\1>$/.test(line) ||
                /^<chapter-break\s*\/>$/.test(line)
            ).length;
            console.log('[ScriptOperationsHandler] append content format check', {
                totalLines: lines.length,
                taggedLines: taggedCount,
                sample: lines.slice(0, 5)
            });
        }
        console.log('[ScriptOperationsHandler] append intent received', {
            hasContent: !!content,
            contentLength: typeof content === 'string' ? content.length : null,
            hasOrchestrator: !!orchestrator,
            validationError: metadata?.validationError || null
        });
        if (metadata?.validationError) {
            console.warn('[ScriptOperationsHandler] Append blocked due to validation error', {
                validationError: metadata.validationError
            });
            return;
        }
        if (!orchestrator) {
            console.warn('[ScriptOperationsHandler] No script orchestrator available for append');
            return;
        }
        try {
            const appendSuccess = await orchestrator.handleScriptAppend({
                content: normalizedContent,
                isFromAppend: true
            });
            console.log('[ScriptOperationsHandler] append result', {
                appendSuccess
            });
        } catch (error) {
            console.error('[ScriptOperationsHandler] Script append failed:', error);
            this.onError(error, 'handleScriptAppend');
        }
    }

    /**
     * Extract script content from API response.
     * CANONICAL SHAPE (v2): data.response.script
     */
    _extractAppendContent (data) {
        if (!data?.response) {
            return '';
        }

        if (typeof data.response === 'string') {
            return data.response;
        }

        // CANONICAL field only (v2)
        return data.response.script || '';
    }

    _sanitizeAppendContent (content) {
        if (!content || typeof content !== 'string') {
            return '';
        }

        const normalized = content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/<chapter-break\s*\/>/gi, '<chapter-break></chapter-break>')
            .replace(/>\s*</g, '>\n<')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                const tagMatch = line.match(/^<([\w-]+)>([\s\S]*?)<\/\1>$/);
                if (tagMatch) {
                    const tag = tagMatch[1].toLowerCase();
                    const inner = tag === 'chapter-break'
                        ? ''
                        : tagMatch[2].replace(/\s+/g, ' ').trim();
                    return `<${tag}>${inner}</${tag}>`;
                }
                return line.replace(/\s+/g, ' ');
            })
            .filter(line => line.length > 0)
            .join('\n');

        return normalized;
    }

    _emitScriptBlockedEmpty (details = {}) {
        console.warn('[ScriptOperationsHandler] Script blocked due to empty output', details);
        if (this.eventManager) {
            this.eventManager.publish(EventManager.EVENTS.AI.SCRIPT_BLOCKED_EMPTY, {
                ...details,
                timestamp: Date.now()
            });
        }
    }

    _hasLineInsertionData (data) {
        const content = data.response && data.response.content;
        if (!content || typeof content !== 'string') {
            return false;
        }

        const lineNumberPatterns = [
            /line\s+(\d+)/gi,
            /at\s+line\s+(\d+)/gi,
            /insert\s+at\s+line\s+(\d+)/gi,
            /after\s+line\s+(\d+)/gi,
            /before\s+line\s+(\d+)/gi
        ];

        return lineNumberPatterns.some(pattern => pattern.test(content));
    }

    async _handleLineInsertion (data) {
        try {
            if (this.eventManager) {
                this.eventManager.publish(EventManager.EVENTS.AI.RESPONSE_RECEIVED, {
                    response: data.response,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('[ScriptOperationsHandler] Line insertion failed:', error);
            this.onError(error, 'handleLineInsertion');
        }
    }
}
