import { BaseChain } from '../base/BaseChain.js';
import { INTENT_TYPES, SCRIPT_CONTEXT_PREFIX, VALID_FORMAT_VALUES } from '../../constants.js';
import { buildScriptHeader } from '../helpers/ScriptPromptUtils.js';
import { formatScriptCollections } from '../helpers/ScriptCollectionsFormatter.js';
import { getDefaultQuestions } from '../helpers/ChainInputUtils.js';
import { buildContractMetadata } from '../helpers/ChainOutputGuards.js';

const VALID_TAGS = VALID_FORMAT_VALUES.join(', ');
const SYSTEM_INSTRUCTION = `You are a scriptwriting assistant tasked specifically with appending or continuing scripts.
- Output ONLY new script lines.
- Return 16-20 lines.
- Each line must be a single XML-style script tag using only: ${VALID_TAGS}.
- Do not include markdown, numbering, or commentary.
- Do not rewrite or repeat existing lines.`;

export class ScriptAppendChain extends BaseChain {
    constructor () {
        super({
        type: INTENT_TYPES.SCRIPT_CONVERSATION,
            temperature: 0.5,
            modelConfig: {
                response_format: { type: 'text' }
            }
        });
    }

    buildMessages (context, prompt) {
        const scriptContent = context?.scriptContent || '';
        const scriptHeader = buildScriptHeader(context?.scriptTitle, context?.scriptDescription);
        const collectionBlock = formatScriptCollections(context?.scriptCollections);
        const contextBlocks = [
            collectionBlock,
            scriptContent ? `${SCRIPT_CONTEXT_PREFIX}\n${scriptContent}` : ''
        ].filter(Boolean).join('\n\n');
        const scriptSnippet = contextBlocks
            ? `${prompt}\n\n${scriptHeader}\n\n${contextBlocks}`
            : prompt;
        const systemPrompt = context?.systemInstruction || SYSTEM_INSTRUCTION;

        const messages = [{
            role: 'system',
            content: systemPrompt
        }, {
            role: 'user',
            content: scriptSnippet
        }];

        return this.addCommonInstructions(messages);
    }

    formatResponse (response) {
        const responseText = typeof response === 'string' ? response : response.response || response;
        const metadata = {
            ...this.extractMetadata(response, ['scriptId', 'scriptTitle']),
            appendWithScript: true,
            timestamp: new Date().toISOString()
        };
        const canonical = {
            message: responseText,
            script: responseText,
            metadata
        };

        Object.assign(metadata, buildContractMetadata(INTENT_TYPES.SCRIPT_CONVERSATION, canonical));

        return this.ensureCanonicalResponse(canonical);
    }

    getDefaultQuestions () {
        return getDefaultQuestions();
    }

    async run (context, prompt) {
        try {
            const messages = await this.buildMessages(context, prompt);
            const response = await this.execute(messages, context);
            const formattedResponse = await this.formatResponse(response);
            return {
                ...formattedResponse,
                questions: this.resolveQuestions(response)
            };
        } catch (error) {
            console.error('ScriptAppendChain execution error:', error);
            const fallback = {
                message: 'I appended to your script.',
                script: '',
                metadata: {
                    appendWithScript: true,
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
            Object.assign(
                fallback.metadata,
                buildContractMetadata(INTENT_TYPES.SCRIPT_CONVERSATION, fallback)
            );
            const canonicalFallback = this.ensureCanonicalResponse(fallback);
            return {
                ...canonicalFallback,
                questions: this.getDefaultQuestions()
            };
        }
    }
}
