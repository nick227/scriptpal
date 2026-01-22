import { BaseChain } from '../base/BaseChain.js';

import { EditScriptLoader } from './EditScriptLoader.js';
import { WriteScriptMessages } from './WriteScriptMessages.js';
import { ScriptVersionService } from '../../../scripts/ScriptVersionService.js';
import scriptModel from '../../../../models/script.js';

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

      // Get commands from LLM
      const llmResponse = await this.llm.invoke(messages, {
        functions: [WriteScriptMessages.getFunctionSchema()],
        function_call: { name: 'write_script' }
      });

      // Parse commands from response
      const editCommands = JSON.parse(llmResponse.additional_kwargs.function_call.arguments);
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
