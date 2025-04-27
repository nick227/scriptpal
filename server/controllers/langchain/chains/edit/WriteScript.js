import { BaseChain } from '../base/BaseChain.js';
import { ChatOpenAI } from '@langchain/openai';
import { EditScriptLoader } from './EditScriptLoader.js';
import { WriteScriptMessages } from './WriteScriptMessages.js';
import { ScriptVersionService } from '../../../scripts/ScriptVersionService.js';

export class WriteScriptChain extends BaseChain {
    constructor(config = {}) {
        super({...config, type: 'WRITE_SCRIPT' });
        this.llm = new ChatOpenAI({ modelName: 'gpt-4', temperature: 0 });
        this.versionService = new ScriptVersionService();
    }

    async buildMessages(context, prompt) {
        const scriptContent = await EditScriptLoader.loadScriptContent(context.scriptId);
        return WriteScriptMessages.buildMessages(scriptContent, prompt);
    }

    async execute(messages, metadata = {}, shouldGenerateQuestions = true) {
        try {
            const { scriptId, prompt } = metadata;

            // Get edit commands from LLM
            const llmResponse = await this.llm.invoke(messages, {
                functions: [WriteScriptMessages.getFunctionSchema()],
                function_call: { name: 'edit_script' }
            });

            // Parse commands from response
            const editCommands = JSON.parse(llmResponse.additional_kwargs.function_call.arguments);
            const commands = editCommands.commands;

            console.log('Generated edit commands:', commands);

            // Load script content and current version
            const scriptContent = await EditScriptLoader.loadScriptContent(scriptId);
            const currentScript = await db.getScript(scriptId);

            // Validate commands
            EditScriptLoader.validateCommands(commands, scriptContent);

            // Apply edits and create new version_number
            const editResult = await this.versionService.applyEdits(scriptId, commands, scriptContent);

            // If no modifications were made, return early
            if (!editResult || !editResult.editResult || !editResult.editResult.modified) {
                return this.createResponse({
                    commands,
                    results: [],
                    content: scriptContent,
                    message: "No changes were made to the script. This could be because the commands were invalid or the target lines don't exist.",
                    version_number: currentScript.version_number
                }, metadata);
            }

            // Count successful edits
            const successfulEdits = editResult.editResult.results.filter(r => r.success).length;

            // Generate response with successful changes
            return this.createResponse({
                commands,
                results: editResult.editResult.results,
                content: editResult.editResult.content,
                message: `Successfully applied ${successfulEdits} out of ${commands.length} edits. The script now has ${editResult.editResult.content.split('\n').length} lines.`,
                version_number: editResult.script.version_number
            }, {
                ...metadata,
                version_number: editResult.script.version_number // Add version to metadata
            });

        } catch (error) {
            console.error('EditScriptChain execution error:', error);
            throw error;
        }
    }
}