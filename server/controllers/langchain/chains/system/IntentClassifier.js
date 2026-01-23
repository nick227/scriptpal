import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES } from '../../constants.js';

const SYSTEM_INSTRUCTION = `You are an intent classifier for a scriptwriting assistant. Use the user prompt and available script context to pick the single most appropriate intent from the following list: ${Object.values(INTENT_TYPES).join(', ')}. Respond with valid JSON: {"intent": "INTENT_NAME", "confidence": 0.0, "reason": "short rationale"}. Intent names must match exactly.`;

export class IntentClassifier extends BaseChain {
    constructor () {
        super({
            type: 'INTENT_CLASSIFIER',
            temperature: 0.2,
            modelConfig: {
                response_format: { type: 'text' }
            }
        });
    }

    buildMessages (context, prompt) {
        const scriptTitle = context?.scriptTitle || 'Untitled Script';
        const snippet = context?.scriptContent ? context.scriptContent.substring(0, 400) : 'Script content unavailable';

        return [
            {
                role: 'system',
                content: SYSTEM_INSTRUCTION
            },
            {
                role: 'user',
                content: `Script Title: ${scriptTitle}\nScript Content Snippet:\n${snippet}\n\nUser Prompt: ${prompt}`
            }
        ];
    }

    async classify (context, prompt) {
        try {
            const messages = await this.buildMessages(context, prompt);
            const response = await this.execute(messages, {
                context,
                chainConfig: {
                    shouldGenerateQuestions: false
                }
            });

            const payload = typeof response === 'string' ? response : (response.response || response);
            const normalized = typeof payload === 'string' ? payload.trim() : null;
            if (!normalized) {
                return null;
            }

            try {
                const parsed = JSON.parse(normalized);
                if (!parsed.intent) return null;
                return {
                    intent: parsed.intent,
                    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
                    reason: parsed.reason || ''
                };
            } catch (error) {
                console.warn('[IntentClassifier] Invalid JSON response:', normalized);
                return null;
            }
        } catch (error) {
            console.error('[IntentClassifier] Classification failed:', error);
            return null;
        }
    }
}
