import { SYSTEM_PROMPTS_MAP } from '../../../../../shared/systemPrompts.js';
import { MESSAGE_TYPES } from '../../../constants.js';
import { EventManager } from '../../../core/EventManager.js';

const STATUS_LINE_STEP = 10;
const IDEAS_LINE_THRESHOLD = 150;
const IDEAS_COOLDOWN_MS = 10 * 60 * 1000;

export class SystemPromptOrchestrator {
    constructor ({ api, chatManager, eventManager }) {
        if (!api) throw new Error('API instance is required');
        if (!chatManager) throw new Error('ChatManager instance is required');
        if (!eventManager) throw new Error('EventManager instance is required');

        this.api = api;
        this.chatManager = chatManager;
        this.chatHistoryManager = chatManager.chatHistoryManager;
        this.eventManager = eventManager;
        this.promptHistoryByScript = new Map();
        this.subscriptions = [];
    }

    initialize () {
        this.subscribe(EventManager.EVENTS.SCRIPT.SELECTED, this.handleScriptSelected);
        this.subscribe(EventManager.EVENTS.SCRIPT.CONTEXT_UPDATED, this.handleContextUpdated);
        this.subscribe(EventManager.EVENTS.SCRIPT.DELETED, this.handleScriptDeleted);
    }

    destroy () {
        this.subscriptions.forEach(({ event, handler }) => {
            this.eventManager.unsubscribe(event, handler);
        });
        this.subscriptions = [];
        this.promptHistoryByScript.clear();
    }

    subscribe (event, handler) {
        const boundHandler = handler.bind(this);
        this.eventManager.subscribe(event, boundHandler);
        this.subscriptions.push({ event, handler: boundHandler });
    }

    handleScriptSelected (payload) {
        if (!payload || !payload.script || !payload.script.id) {
            return;
        }
        this.ensurePromptState(payload.script.id);
    }

    handleScriptDeleted (payload) {
        if (!payload || !payload.scriptId) {
            return;
        }
        this.promptHistoryByScript.delete(payload.scriptId);
    }

    async handleContextUpdated (payload) {
        if (!payload || !payload.scriptId || !payload.context) {
            return;
        }
        let context = payload.context;
        if (context && typeof context.then === 'function') {
            try {
                context = await context;
            } catch (error) {
                console.error('[SystemPromptOrchestrator] Failed to resolve context promise:', error);
                return;
            }
        }
        if (!context) {
            return;
        }
        await this.evaluateTriggers(payload.scriptId, context);
    }

    async evaluateTriggers (scriptId, context) {
        const lineCount = context?.contentStats?.lines || context?.contentLength || 0;
        const state = this.ensurePromptState(scriptId);

        if (this.shouldTriggerStatus(state, lineCount)) {
            await this.triggerPrompt('status', scriptId, context);
            return;
        }

        if (this.shouldTriggerIdeas(state, lineCount)) {
            await this.triggerPrompt('ideas', scriptId, context);
        }
    }

    ensurePromptState (scriptId) {
        if (!this.promptHistoryByScript.has(scriptId)) {
            this.promptHistoryByScript.set(scriptId, {
                initialTriggeredAt: null,
                statusNextLine: STATUS_LINE_STEP,
                ideasLastTriggeredAt: null,
                fingerprints: {}
            });
        }
        return this.promptHistoryByScript.get(scriptId);
    }

    shouldTriggerStatus (state, lineCount) {
        if (typeof lineCount !== 'number' || lineCount < STATUS_LINE_STEP) {
            return false;
        }

        const nextLine = state.statusNextLine || STATUS_LINE_STEP;
        if (lineCount >= nextLine) {
            const steps = Math.floor(lineCount / STATUS_LINE_STEP);
            state.statusNextLine = (steps + 1) * STATUS_LINE_STEP;
            return true;
        }

        return false;
    }

    shouldTriggerIdeas (state, lineCount) {
        const now = Date.now();
        return (
            typeof lineCount === 'number' &&
            lineCount >= IDEAS_LINE_THRESHOLD &&
            (!state.ideasLastTriggeredAt || now - state.ideasLastTriggeredAt >= IDEAS_COOLDOWN_MS)
        );
    }

    async firePrompt (promptId, scriptId = null, context = {}) {
        return this.triggerPrompt(promptId, scriptId, context);
    }

    async triggerPrompt (promptId, scriptId, context) {
        const definition = SYSTEM_PROMPTS_MAP[promptId];
        if (!definition) {
            return;
        }

        const state = this.ensurePromptState(scriptId);
        state.lastTriggerRequestAt = Date.now();

        if (promptId === 'initial') {
            state.initialTriggeredAt = state.initialTriggeredAt || Date.now();
        }

        if (promptId === 'status') {
            const currentLineCount = context?.contentStats?.lines || context?.contentLength || 0;
            if (typeof currentLineCount === 'number' && currentLineCount > 0) {
                const steps = Math.floor(currentLineCount / STATUS_LINE_STEP);
                state.statusNextLine = (steps + 1) * STATUS_LINE_STEP;
            } else {
                state.statusNextLine = (state.statusNextLine || STATUS_LINE_STEP) + STATUS_LINE_STEP;
            }
        }

        if (promptId === 'ideas') {
            state.ideasLastTriggeredAt = Date.now();
        }

        this.eventManager.publish(EventManager.EVENTS.SYSTEM_PROMPT.READY, {
            scriptId,
            promptType: promptId,
            clientCopy: definition.clientCopy
        });

        const fingerprint = this.computeFingerprint(context);
        if (fingerprint) {
            const previousFingerprint = state.fingerprints[promptId];
            if (previousFingerprint && previousFingerprint === fingerprint) {
                return null;
            }
            state.fingerprints[promptId] = fingerprint;
        }

        const requestContext = {
            ...context,
            lineCount: context?.contentStats?.lines || context?.contentLength || 0,
            promptId,
            triggeredAt: new Date().toISOString()
        };

        try {
            const response = await this.api.triggerSystemPrompt(promptId, scriptId, requestContext);
            await this.renderResponse(response, promptId, scriptId);
            this.eventManager.publish(EventManager.EVENTS.SYSTEM_PROMPT.FIRED, {
                scriptId,
                promptType: promptId,
                response
            });
            return response;
        } catch (error) {
            console.error('[SystemPromptOrchestrator] Trigger failed:', error);
            this.eventManager.publish(EventManager.EVENTS.SYSTEM_PROMPT.FAILED, {
                scriptId,
                promptType: promptId,
                error
            });
        }
    }

    async renderResponse (response, promptId, scriptId) {
        if (!response) {
            return;
        }

        const { chatManager, chatHistoryManager } = this;
        const decoratedResponse = typeof response === 'string'
            ? { response, metadata: { promptType: promptId } }
            : {
                ...response,
                metadata: {
                    ...(response.metadata || {}),
                    promptType: promptId
                }
            };

        await chatManager.processAndRenderMessage(decoratedResponse, MESSAGE_TYPES.ASSISTANT);

        const content = chatManager.extractMessageContent(decoratedResponse);

        if (content && chatHistoryManager) {
            await chatHistoryManager.addMessage({
                content,
                type: MESSAGE_TYPES.ASSISTANT,
                metadata: {
                    promptType: promptId,
                    scriptId
                }
            });
        }
    }

    computeFingerprint (context = {}) {
        const lineCount = context?.contentStats?.lines ?? context?.contentLength ?? 0;
        const content = typeof context?.content === 'string' ? context.content : '';
        if (!content) {
            return `${lineCount}:`;
        }

        const lines = content.split('\n');
        const snippetCount = 3;
        const lastLines = lines
            .slice(-snippetCount)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        const snippet = lastLines.join('|');
        return `${lineCount}:${snippet}`;
    }
}
