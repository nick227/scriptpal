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
});
