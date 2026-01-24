import { MESSAGE_TYPES } from '../../constants.js';
import { EventManager } from '../../core/EventManager.js';

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
                versionNumber: data.response.versionNumber,
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

        if (this._hasLineInsertionData(data)) {
            await this._handleLineInsertion(data);
            return;
        }

        const content = data.response && data.response.content;
        console.log('[ScriptOperationsHandler] append intent received', {
            hasContent: !!content,
            contentLength: typeof content === 'string' ? content.length : null,
            hasOrchestrator: !!orchestrator
        });
        if (!orchestrator) {
            console.warn('[ScriptOperationsHandler] No script orchestrator available for append');
            return;
        }
        if (content && orchestrator) {
            try {
                const appendSuccess = await orchestrator.handleScriptAppend({
                    content,
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
