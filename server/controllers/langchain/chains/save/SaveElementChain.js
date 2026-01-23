import { BaseChain } from '../base/BaseChain.js';
import { OUTPUT_FORMATS } from '../../constants.js';
import { ai } from '../../../../lib/ai.js';

import { SaveElementHandler } from '../../../chat/handlers/SaveElementHandler.js';

export class SaveElementChain extends BaseChain {
  constructor(config = {}) {
    super({ ...config, type: 'SAVE_ELEMENT' });

  }

  buildMessages(context, prompt) {
    const userPrompt = prompt || context?.prompt || 'Save element request';
    const scriptContent = context?.scriptContent ? context.scriptContent : 'No script content provided.';

    const systemInstruction = `You are a script assistant that only responds with a JSON object specifying what to save. Return an object with exactly two fields:
- target: one of CHARACTER, SCENE, DIALOG, PLOT_POINT
- value: the structured data to save

Example:
${JSON.stringify(OUTPUT_FORMATS.SAVE_ELEMENT.example, null, 2)}

Use the script content below for context and provide the safest target/value pair based on the request.`;

    return [
      {
        role: 'system',
        content: systemInstruction
      },
      {
        role: 'user',
        content: `${userPrompt}\n\nScript content:\n${scriptContent}`
      }
    ];
  }

  async execute(messages, metadata = {}) {
    try {
      const { scriptId } = metadata;

      const completionParams = { messages };
      const chainConfig = metadata.chainConfig || {};
      if (chainConfig.modelConfig) {
        Object.assign(completionParams, chainConfig.modelConfig);
      }

      const result = await ai.generateCompletion(completionParams);
      if (!result.success) {
        throw new Error(result.error?.message || 'AI completion failed');
      }

      const content = result.data?.choices?.[0]?.message?.content || '';
      const saveCommand = this.parseSaveCommand(content);

      // Create handler instance
      const handler = new SaveElementHandler(scriptId, saveCommand);

      // Execute the save operation
      const handlerResult = await handler.execute();

      // Generate response
      return this.createResponse({
        success: true,
        target: saveCommand.target,
        value: saveCommand.value,
        message: handlerResult.message,
        details: handlerResult.details
      }, metadata);

    } catch (error) {
      console.error('SaveElementChain execution error:', error);
      throw error;
    }
  }

  /**
     * Parse LLM response into a save command
     * @private
     */
  parseSaveCommand(content) {
    try {
      // Clean the response and parse JSON
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate required fields
      if (!parsed.target || !parsed.value) {
        throw new Error('Invalid save command format: missing target or value');
      }

      return {
        target: parsed.target.toLowerCase(),
        value: parsed.value
      };

    } catch (error) {
      throw new Error(`Failed to parse save command: ${error.message}`);
    }
  }
}
