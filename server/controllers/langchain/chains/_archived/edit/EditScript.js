import { BaseChain } from '../base/BaseChain.js';

import { EditScriptLoader } from './EditScriptLoader.js';
import { EditScriptMessages } from './EditScriptMessages.js';
import { ScriptVersionService } from '../../../script-services/ScriptVersionService.js';
import { ai } from '../../../../lib/ai.js';

export class EditScriptChain extends BaseChain {
  constructor(config = {}) {
    super({ ...config, type: 'EDIT_SCRIPT' });

    this.versionService = new ScriptVersionService();
  }

  async buildMessages(context, prompt) {
    const scriptContent = context.scriptContent ??
            await EditScriptLoader.loadScriptContent(context.scriptId);
    return EditScriptMessages.buildMessages(scriptContent, prompt);
  }

  async execute(messages, metadata = {}, _shouldGenerateQuestions = true) {
    try {
      const { scriptId, _prompt } = metadata;

      const completionParams = {
        messages,
        functions: [EditScriptMessages.getFunctionSchema()],
        function_call: { name: 'edit_script' }
      };

      const chainConfig = metadata.chainConfig || {};
      if (chainConfig.modelConfig) {
        Object.assign(completionParams, chainConfig.modelConfig);
      }

      const result = await ai.generateCompletion(completionParams);
      if (!result.success) {
        throw new Error(result.error?.message || 'AI completion failed');
      }

      const choice = result.data?.choices?.[0];
      const functionCallArgs = choice?.message?.function_call?.arguments;
      if (!functionCallArgs) {
        throw new Error('AI response is missing edit_script function call');
      }

      const editCommands = JSON.parse(functionCallArgs);
      const commands = Array.isArray(editCommands.commands) ? editCommands.commands : [];

      console.log('Generated edit commands:', commands);

      const scriptContent = metadata.scriptContent ??
              await EditScriptLoader.loadScriptContent(scriptId);

      // Validate commands
      EditScriptLoader.validateCommands(commands, scriptContent);

      // Apply edits and create new versionNumber
      const editResult = await this.versionService.applyEdits(scriptId, commands, scriptContent);

      // If no modifications were made, return early
      if (!editResult || !editResult.editResult) {
        return this.createResponse({
          commands,
          results: [],
          content: scriptContent,
          message: 'No changes were made to the script. This could be because the commands were invalid or the target lines don\'t exist.',
          versionNumber: null
        }, metadata);
      }

      // Generate response
      return this.createResponse({
        commands,
        results: editResult.editResult.results,
        content: editResult.editResult.content,
        message: EditScriptLoader.generateResponseMessage(commands, editResult.editResult.content),
        versionNumber: editResult.script.versionNumber || null
      }, metadata);

    } catch (error) {
      console.error('EditScriptChain execution error:', error);
      throw error;
    }
  }
}
