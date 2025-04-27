import { BaseChain } from '../base/BaseChain.js';
import { ChatOpenAI } from '@langchain/openai';
import { EditScriptLoader } from './EditScriptLoader.js';
import { EditScriptMessages } from './EditScriptMessages.js';
import { ScriptVersionService } from '../../../scripts/ScriptVersionService.js';

export class EditScriptChain extends BaseChain {
    constructor(config = {}) {
        super({...config, type: 'EDIT_SCRIPT' });
        this.llm = new ChatOpenAI({ modelName: 'gpt-4', temperature: 0 });
        this.versionService = new ScriptVersionService();
    }

    async buildMessages(context, prompt) {
        const scriptContent = await EditScriptLoader.loadScriptContent(context.scriptId);
        return EditScriptMessages.buildMessages(scriptContent, prompt);
    }

    async execute(messages, metadata = {}, shouldGenerateQuestions = true) {
        try {
            const { scriptId, prompt } = metadata;

            // Get edit commands from LLM
            const llmResponse = await this.llm.invoke(messages, {
                functions: [EditScriptMessages.getFunctionSchema()],
                function_call: { name: 'edit_script' }
            });

            // Parse commands from response
            const editCommands = JSON.parse(llmResponse.additional_kwargs.function_call.arguments);
            const commands = editCommands.commands;

            console.log('Generated edit commands:', commands);

            // Load script content
            const scriptContent = await EditScriptLoader.loadScriptContent(scriptId);

            // Validate commands
            EditScriptLoader.validateCommands(commands, scriptContent);

            // Apply edits and create new version_number
            const editResult = await this.versionService.applyEdits(scriptId, commands, scriptContent);

            // If no modifications were made, return early
            if (!editResult || !editResult.editResult) {
                return this.createResponse({
                    commands,
                    results: [],
                    content: scriptContent,
                    message: "No changes were made to the script. This could be because the commands were invalid or the target lines don't exist.",
                    version_number: null
                }, metadata);
            }

            // Generate response
            return this.createResponse({
                commands,
                results: editResult.editResult.results,
                content: editResult.editResult.content,
                message: EditScriptLoader.generateResponseMessage(commands, editResult.editResult.content),
                version_number: editResult.script.version_number || null
            }, metadata);

        } catch (error) {
            console.error('EditScriptChain execution error:', error);
            throw error;
        }
    }
}