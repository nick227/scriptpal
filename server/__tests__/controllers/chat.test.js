/**
 * Tests for Chat intent response mapping
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { INTENT_TYPES } from '../../../controllers/langchain/constants.js';
import { APPEND_SCRIPT_INTENT } from '../../../controllers/scripts/AppendPageService.js';

jest.mock('../../../controllers/scripts/ScriptManager.js', () => ({
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

jest.mock('../../../controllers/chat/ChatHistoryManager.js', () => ({
  ChatHistoryManager: class {
    constructor () {
      this.getHistory = jest.fn().mockResolvedValue([]);
      this.saveInteraction = jest.fn().mockResolvedValue(true);
    }
  }
}));

const classifyMock = jest.fn();
jest.mock('../../../controllers/langchain/chains/system/IntentClassifier.js', () => ({
  IntentClassifier: class {
    constructor () {
      this.classify = classifyMock;
    }
  }
}));

const routeMock = jest.fn();
jest.mock('../../../controllers/langchain/router/index.js', () => ({
  router: {
    route: routeMock
  }
}));

describe('Chat intent response mapping', () => {
  let Chat;

  beforeEach(async() => {
    jest.clearAllMocks();
    Chat = (await import('../../../controllers/chat/Chat.js')).Chat;
  });

  it('maps SCRIPT_CONVERSATION responses to APPEND_SCRIPT intent', async() => {
    classifyMock.mockResolvedValue({
      intent: INTENT_TYPES.SCRIPT_CONVERSATION,
      confidence: 0.9,
      reason: 'append the script'
    });
    routeMock.mockResolvedValue({
      response: '<action>Appended line</action>',
      metadata: {}
    });

    const chat = new Chat(1, 1);
    const result = await chat.processMessage('Continue the script', {});

    expect(result.intent).toBe(APPEND_SCRIPT_INTENT);
    expect(result.response.content).toBe('<action>Appended line</action>');
  });

  it('keeps NEXT_FIVE_LINES intent unchanged', async() => {
    classifyMock.mockResolvedValue({
      intent: INTENT_TYPES.NEXT_FIVE_LINES,
      confidence: 0.9,
      reason: 'next five lines'
    });
    routeMock.mockResolvedValue({
      response: 'Reasoning response',
      metadata: {
        formattedScript: '<action>Line 1</action>'
      }
    });

    const chat = new Chat(1, 1);
    const result = await chat.processMessage('Write next five lines', {});

    expect(result.intent).toBe(INTENT_TYPES.NEXT_FIVE_LINES);
  });
});
