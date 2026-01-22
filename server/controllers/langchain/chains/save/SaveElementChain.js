import { BaseChain } from '../base/BaseChain.js';

import { SaveElementHandler } from '../../../chat/handlers/SaveElementHandler.js';

export class SaveElementChain extends BaseChain {
  constructor(config = {}) {
    super({ ...config, type: 'SAVE_ELEMENT' });

  }

  async execute(messages, metadata = {}) {
    try {
      const { scriptId } = metadata;

      // Get structured command from LLM
      const llmResponse = await this.llm.invoke(messages);

      // Parse the response to get save command
      const saveCommand = this.parseSaveCommand(llmResponse.content);

      // Create handler instance
      const handler = new SaveElementHandler(scriptId, saveCommand);

      // Execute the save operation
      const result = await handler.execute();

      // Generate response
      return this.createResponse({
        success: true,
        target: saveCommand.target,
        value: saveCommand.value,
        message: result.message,
        details: result.details
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
