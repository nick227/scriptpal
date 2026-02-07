/**
 * Chat message contract test — prevents silent drift in API response shapes.
 * Run against serializer output and buildAiResponse output.
 */

import { describe, it, expect } from '@jest/globals';
import { ChatMessageSerializer } from '../../serializers/chatMessageSerializer.js';
import { buildAiResponse } from '../../controllers/common/ai-response.service.js';

const MESSAGE_CONTRACT = {
  id: expect.any(String),
  role: expect.stringMatching(/^user|assistant$/),
  content: expect.any(String),
  timestamp: expect.anything(),
  scriptId: expect.anything()
};

function assertMessageMatchesContract(message) {
  expect(message).toMatchObject(MESSAGE_CONTRACT);
  expect(typeof message.id).toBe('string');
  expect(['user', 'assistant']).toContain(message.role);
  expect(typeof message.content).toBe('string');
}

describe('Chat message contract', () => {
  describe('ChatMessageSerializer.flattenRows', () => {
    it('produces messages matching contract for assistant rows with userPrompt', () => {
      const rows = [{
        id: 1,
        userId: 1,
        scriptId: 2,
        role: 'assistant',
        content: 'Added 5 lines.',
        intent: 'NEXT_FIVE_LINES',
        metadata: JSON.stringify({ userPrompt: 'next 5', chainType: 'NEXT_FIVE_LINES' }),
        createdAt: new Date(),
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120
      }];
      const messages = ChatMessageSerializer.flattenRows(rows);
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      messages.forEach(assertMessageMatchesContract);
    });

    it('produces messages matching contract for user rows', () => {
      const rows = [{
        id: 2,
        userId: 1,
        scriptId: 2,
        role: 'user',
        content: 'Write the next scene',
        intent: null,
        metadata: null,
        createdAt: new Date()
      }];
      const messages = ChatMessageSerializer.flattenRows(rows);
      expect(messages).toHaveLength(1);
      assertMessageMatchesContract(messages[0]);
    });
  });

  describe('ChatMessageSerializer.toMessages (addChatMessage response shape)', () => {
    it('produces messages matching contract for assistant row', () => {
      const row = {
        id: 3,
        userId: 1,
        scriptId: 2,
        role: 'assistant',
        content: 'Here are some ideas.',
        metadata: JSON.stringify({ userPrompt: 'give me ideas' }),
        createdAt: new Date()
      };
      const messages = ChatMessageSerializer.toMessages(row);
      expect(Array.isArray(messages)).toBe(true);
      messages.forEach(assertMessageMatchesContract);
    });
  });

  describe('buildAiResponse (startChat / system-prompts shape)', () => {
    it('response.message is present and string when provided', () => {
      const payload = buildAiResponse({
        intentResult: { intent: 'SCRIPT_CONVERSATION' },
        scriptId: 1,
        scriptTitle: 'Test',
        response: { message: 'Added lines.', script: '<action>X</action>', metadata: {} }
      });
      expect(payload.response).toBeDefined();
      expect(typeof payload.response.message).toBe('string');
      expect(payload.response.message).toBe('Added lines.');
    });

    it('produces response shape consumable as Message when history is empty', () => {
      const payload = buildAiResponse({
        intentResult: { intent: 'GENERAL_CONVERSATION' },
        scriptId: 1,
        response: { message: 'I can help with that.', metadata: {} }
      });
      const msg = payload.response;
      expect(msg).toMatchObject({
        message: expect.any(String)
      });
    });
  });

  describe('history array from startChat', () => {
    it('each history item matches message contract', () => {
      const rows = [
        { id: 1, userId: 1, scriptId: 2, role: 'assistant', content: 'Hi.', metadata: JSON.stringify({ userPrompt: 'hello' }), createdAt: new Date() }
      ];
      const history = ChatMessageSerializer.flattenRows(rows);
      history.forEach(assertMessageMatchesContract);
    });
  });
});
