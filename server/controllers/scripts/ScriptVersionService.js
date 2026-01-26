import { ScriptEditHelper } from '../langchain/chains/helpers/ScriptEditHelper.js';
import scriptModel from '../../models/script.js';
import scriptVersionRepository from '../../repositories/scriptVersionRepository.js';

export class ScriptVersionService {
  /**
     * Apply edit commands to a script and create a new versionNumber
     * @param {number} scriptId - The ID of the script to edit
     * @param {Array} commands - Array of edit commands
     * @param {string} currentContent - Current script content
     * @returns {Promise<Object>} The edit result and new script versionNumber
     */
  async applyEdits(scriptId, commands, currentContent) {
    try {
      console.log('Applying edits to script:', { scriptId, commandCount: commands.length });

      // First verify the script exists
      const currentScript = await scriptModel.getScript(scriptId);
      if (!currentScript) {
        throw new Error(`Script not found with ID: ${scriptId}`);
      }

      console.log('Current script before edits:', {
        id: currentScript.id,
        versionNumber: currentScript.versionNumber
      });

      // Apply edits using the helper
      const editResult = ScriptEditHelper.editScript(currentContent, commands);

      // If no modifications were made, return current versionNumber
      if (!editResult.modified) {
        console.log('No modifications made to script:', scriptId);
        return {
          script: currentScript,
          editResult
        };
      }

      // Create new versionNumber with updated content
      const script = await scriptModel.updateScript(scriptId, {
        content: editResult.content,
        title: currentScript.title,
        status: currentScript.status,
        author: currentScript.author || null,
        description: currentScript.description || null
      });

      console.log('Updated script versionNumber:', {
        id: script.id,
        versionNumber: script.versionNumber,
        previousVersion: currentScript.versionNumber
      });

      return {
        script,
        editResult
      };

    } catch (error) {
      console.error('Error applying script edits:', error);
      throw error;
    }
  }

  /**
     * Get a specific versionNumber of a script
     * @param {number} scriptId - The ID of the script
     * @param {number} versionNumber - The versionNumber number to retrieve
     * @returns {Promise<Object>} The script versionNumber
     */
  async getVersion(scriptId, versionNumber) {
    return await scriptModel.getScript(scriptId, versionNumber);
  }

  /**
     * Get all versions of a script
     * @param {number} scriptId - The ID of the script
     * @returns {Promise<Array>} Array of script versions
     */
  async getAllVersions(scriptId) {
    return await scriptVersionRepository.listByScriptId(scriptId);
  }

  /**
     * Validate edit commands against script content
     * @param {Array} commands - Array of edit commands
     * @param {Array} scriptLines - Array of script lines
     * @returns {Array} Array of validation errors
     */
  validateCommands(commands, scriptLines) {
    const errors = [];
    const seenLines = new Set();

    for (const cmd of commands) {
      // Check line bounds
      if (cmd.lineNumber > scriptLines.length) {
        errors.push(`Line number ${cmd.lineNumber} exceeds script length`);
      }
      // Check for duplicate edits
      if (seenLines.has(cmd.lineNumber)) {
        errors.push(`Multiple edits targeting line ${cmd.lineNumber}`);
      }
      seenLines.add(cmd.lineNumber);
    }
    return errors;
  }

  static validateCommands(commands, scriptContent) {
    if (!Array.isArray(commands)) {
      throw new Error('Commands must be an array');
    }

    const lines = ScriptEditHelper.parseScriptToLines(scriptContent);
    const currentLength = lines.length;

    // Sort commands by line number to process in sequence
    const sortedCommands = [...commands].sort((a, b) => a.lineNumber - b.lineNumber);

    console.log('Validating commands:', {
      commandCount: commands.length,
      currentScriptLines: currentLength,
      firstCommand: sortedCommands[0],
      lastCommand: sortedCommands[sortedCommands.length - 1]
    });

    // For ADD commands beyond script length, adjust them to append sequentially
    let nextAppendLine = currentLength + 1;

    for (const cmd of sortedCommands) {
      const { command, lineNumber, value } = cmd;

      // Validate command type
      if (!['ADD', 'EDIT', 'DELETE'].includes(command)) {
        throw new Error(`Invalid command type: ${command}`);
      }

      if (command === 'ADD' && lineNumber < 0) {
        throw new Error(`Invalid line number: ${lineNumber} (must be positive)`);
      } else if (command === 'ADD' && lineNumber > currentLength) {
        console.log(`Adjusting ADD command line number from ${lineNumber} to ${nextAppendLine}`);
        cmd.lineNumber = nextAppendLine++;
      } else if (command !== 'ADD' && (lineNumber < 1 || lineNumber > currentLength)) {
        // For EDIT and DELETE, enforce valid line numbers
        throw new Error(`Invalid line number: ${lineNumber} (script has ${currentLength} lines)`);
      }

      // Validate value for ADD/EDIT commands
      if (['ADD', 'EDIT'].includes(command) && !value) {
        throw new Error(`Value is required for ${command} command`);
      }
    }

    // Log the adjusted commands
    console.log('Commands after validation:', {
      commandCount: commands.length,
      firstCommand: commands[0],
      lastCommand: commands[commands.length - 1]
    });
  }
}
