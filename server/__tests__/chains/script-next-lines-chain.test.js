import { ScriptNextLinesChain } from '../../../server/controllers/langchain/chains/script/ScriptNextLinesChain.js';
import { INTENT_TYPES } from '../../../server/controllers/langchain/constants.js';

describe('ScriptNextLinesChain.formatResponse', () => {
  it('accepts common tag aliases and inline tagged text without throwing script_lines_invalid', () => {
    const chain = new ScriptNextLinesChain();
    const payload = {
      lines: [
        { tag: '<scene-heading>', text: 'INT. GARAGE - NIGHT' },
        { tag: 'character', text: 'MIA' },
        { tag: 'dialogue', text: 'Keep the engine warm.' },
        { tag: '', text: '<action>A truck rolls past the open bay door.</action>' },
        { tag: 'parenthetical', text: '(whispers)' }
      ],
      assistantResponse: 'Momentum continues with pressure outside the garage.'
    };

    const result = chain.formatResponse({
      aiMessage: {
        function_call: {
          name: 'provide_next_lines',
          arguments: JSON.stringify(payload)
        }
      },
      metadata: {}
    });

    expect(result.type).toBe(INTENT_TYPES.NEXT_FIVE_LINES);
    expect(result.script).toContain('<header>INT. GARAGE - NIGHT</header>');
    expect(result.script).toContain('<speaker>MIA</speaker>');
    expect(result.script).toContain('<dialog>Keep the engine warm.</dialog>');
    expect(result.script).toContain('<action>A truck rolls past the open bay door.</action>');
    expect(result.script).toContain('<directions>(whispers)</directions>');
  });

  it('accepts plain-text lines by inferring screenplay tags', () => {
    const chain = new ScriptNextLinesChain();
    const payload = {
      lines: [
        { tag: 'header', text: 'INT. ROAD - DAY' },
        { tag: 'action', text: 'Wind pulls at the tall grass.' },
        { tag: 'speaker', text: 'JESS' },
        { tag: 'dialog', text: 'We should keep moving.' },
        { tag: 'action', text: 'She checks the rearview mirror.' }
      ],
      assistantResponse: 'Five lines.'
    };

    const result = chain.formatResponse({
      aiMessage: {
        function_call: {
          name: 'provide_next_lines',
          arguments: JSON.stringify(payload)
        }
      }
    });

    expect(result.script.split('\n').length).toBe(5);
  });

  it('accepts at least two valid lines when the model returns fewer than five', () => {
    const chain = new ScriptNextLinesChain();
    const payload = {
      lines: [
        { tag: 'speaker', text: 'MIA' },
        { tag: 'dialog', text: 'Not yet.' }
      ],
      assistantResponse: 'Short beat.'
    };

    const result = chain.formatResponse({
      aiMessage: {
        function_call: {
          name: 'provide_next_lines',
          arguments: JSON.stringify(payload)
        }
      }
    });

    expect(result.script).toContain('<speaker>MIA</speaker>');
    expect(result.script).toContain('<dialog>Not yet.</dialog>');
  });
});
