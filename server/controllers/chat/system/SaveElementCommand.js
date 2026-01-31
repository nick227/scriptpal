import { ERROR_TYPES } from '../../langchain/constants.js';
import { aiSystemEventHandler } from '../../langchain/handlers/AISystemEventHandler.js';

export class SaveElementCommand {
  constructor(scriptId, intentResult) {
    this.scriptId = scriptId;
    this.intentResult = intentResult;
  }

  validateSaveCommand() {
    if (!this.intentResult.target || !this.intentResult.value) {
      throw new Error(ERROR_TYPES.INVALID_FORMAT);
    }
  }

  prepareSaveCommand() {
    return {
      target: this.intentResult.target.toLowerCase(),
      value: this.intentResult.value,
      script_id: this.scriptId
    };
  }

  async execute() {
    console.log('\n=== Handling Save Element Operation ===');

    this.validateSaveCommand();
    const saveCommand = this.prepareSaveCommand();

    console.log('Executing save command:', JSON.stringify(saveCommand, null, 2));

    try {
      const result = await aiSystemEventHandler.processCommand('save', saveCommand);
      if (!result.success) {
        throw new Error(result.error || 'Save operation failed');
      }

      return {
        success: true,
        message: `Successfully saved ${saveCommand.target} element`,
        details: {
          type: saveCommand.target,
          id: result.id,
          operation: result.operationId
        }
      };
    } catch (error) {
      console.error('Save operation failed:', error);
      throw new Error(`Save operation failed: ${error.message}`);
    }
  }
}
