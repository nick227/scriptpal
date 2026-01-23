import { BaseChain } from '../base/BaseChain.js';

import { EditScriptLoader } from './EditScriptLoader.js';
import { WriteScriptMessages } from './WriteScriptMessages.js';
import { ScriptVersionService } from '../../../scripts/ScriptVersionService.js';
import scriptModel from '../../../../models/script.js';
import { ai } from '../../../../lib/ai.js';

export class WriteScriptChain extends BaseChain {
  constructor(config = {}) {
    super({ ...config, type: 'WRITE_SCRIPT' });

    this.versionService = new ScriptVersionService();
  }

  async buildMessages(context, prompt) {
    const scriptContent = await EditScriptLoader.loadScriptContent(context.scriptId);
    return WriteScriptMessages.buildMessages(scriptContent, prompt);
  }

  async execute(messages, metadata = {}, _shouldGenerateQuestions = true) {
    try {
      const { scriptId, _prompt } = metadata;

      const completionParams = {
        messages,
        functions: [WriteScriptMessages.getFunctionSchema()],
        function_call: { name: 'write_script' }
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
        throw new Error('AI response is missing write_script function call');
      }

      const editCommands = JSON.parse(functionCallArgs);
      const commands = Array.isArray(editCommands.commands) ? editCommands.commands : [];

      console.log('Generated commands:', commands);

      // Load script content and current version
      const scriptContent = await EditScriptLoader.loadScriptContent(scriptId);
      const currentScript = await scriptModel.getScript(scriptId);

      // Validate commands
      EditScriptLoader.validateCommands(commands, scriptContent);

      // Apply edits and create new versionNumber
      const editResult = await this.versionService.applyEdits(scriptId, commands, scriptContent);

      // If no modifications were made, return early
      if (!editResult || !editResult.editResult || !editResult.editResult.modified) {
        return this.createResponse({
          commands,
          results: [],
          content: scriptContent,
          message: 'No changes were made to the script. This could be because the commands were invalid or the target lines don\'t exist.',
          versionNumber: currentScript.versionNumber
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
        versionNumber: editResult.script.versionNumber
      }, {
        ...metadata,
        versionNumber: editResult.script.versionNumber // Add version to metadata
      });

    } catch (error) {
      console.error('WriteScriptChain execution error:', error);
      throw error;
    }
  }
}
