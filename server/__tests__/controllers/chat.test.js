/**
 * Tests for Chat intent response mapping
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { INTENT_TYPES } from '../../controllers/langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../controllers/script-services/AppendPageService.js';

jest.mock('../../controllers/script-services/ScriptManager.js', () => ({
  ScriptManager: class {
    constructor () {
      this.getScript = jest.fn().mockResolvedValue({
        id: 1,
        title: 'Test Script',
        content: '<action>Test content</action>',
        updatedAt: new Date(),
        versionNumber: 1,
        status: 'draft'
      });
    }
  }
}));

jest.mock('../../controllers/chat/history/HistoryManager.js', () => ({
  HistoryManager: class {
    constructor () {
      this.getHistory = jest.fn().mockResolvedValue([]);
      this.saveInteraction = jest.fn().mockResolvedValue(true);
    }
  }
}));

const mockRoute = jest.fn();
jest.mock('../../controllers/langchain/router/index.js', () => ({
  router: {
    route: mockRoute
  }
}));

describe('Chat intent response mapping', () => {
  let Chat;

  beforeEach(async() => {
    jest.clearAllMocks();
    Chat = (await import('../../controllers/chat/orchestrator/ConversationCoordinator.js')).ConversationCoordinator;
  });

  it('maps WRITE_CONTINUE responses to APPEND_SCRIPT intent', async() => {
    mockRoute.mockResolvedValue({
      message: 'Added 1 line to your script.',
      script: '<action>Appended line</action>',
      metadata: {}
    });

    const chat = new Chat(1, 1);
    const result = await chat.processMessage('Continue the script', {});

    expect(result.outcome).toBe('WRITE_CONTINUE');
    expect(result.intent).toBe(APPEND_SCRIPT_INTENT);
    expect(result.response.script).toBe('<action>Appended line</action>');
    expect(result.response.message).not.toMatch(/<action>/);
  });

  it('routes write-next-lines prompts through WRITE_CONTINUE to append intent', async() => {
    mockRoute.mockResolvedValue({
      message: 'Added lines.',
      script: '<action>Line 1</action>',
      metadata: {}
    });

    const chat = new Chat(1, 1);
    const result = await chat.processMessage('Write the next five lines', {});

    expect(result.outcome).toBe('WRITE_CONTINUE');
    expect(result.intent).toBe(APPEND_SCRIPT_INTENT);
    expect(result.response.script).toBe('<action>Line 1</action>');
  });
});
