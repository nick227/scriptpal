import { describe, expect, it } from '@jest/globals';
import { normalizeTitleKey, normalizeLooseCollections, dedupeNormalizedCollections } from '../../controllers/chat/collections/normalizeCollections.js';
import { validateLooseCollections, validateNormalizedCollections } from '../../controllers/chat/collections/validateCollections.js';
import {
  resolveGenerateCollectionTypes,
  isAttachEntityContextRequest,
  isPrimaryGenerateCollectionsRequest
} from '../../controllers/chat/intent/heuristics.js';
import { resolveOutcome } from '../../controllers/chat/intent/resolveOutcome.js';
import { CHAT_OUTCOME, CONTEXT_PROFILE } from '../../controllers/chat/intent/outcomes.js';

describe('collection heuristics', () => {
  it('detects generate collection types from prompt', () => {
    expect(resolveGenerateCollectionTypes('Create 3 characters for this script')).toEqual(['characters']);
    expect(resolveGenerateCollectionTypes('Generate locations and themes')).toEqual(
      expect.arrayContaining(['locations', 'themes'])
    );
  });

  it('separates attachEntityContext from generation', () => {
    expect(isAttachEntityContextRequest('Use my existing characters')).toBe(true);
    expect(resolveGenerateCollectionTypes('Use my existing characters')).toEqual([]);
  });

  it('marks primary collection requests', () => {
    const types = resolveGenerateCollectionTypes('Create 5 characters');
    expect(isPrimaryGenerateCollectionsRequest('Create 5 characters', types)).toBe(true);
    expect(isPrimaryGenerateCollectionsRequest('Write the next five lines and add characters', ['characters'])).toBe(false);
  });
});

describe('collection validation and normalization', () => {
  it('rejects missing title', () => {
    const result = validateLooseCollections([
      { type: 'characters', items: [{ description: 'No name' }] }
    ]);
    expect(result.valid).toBe(false);
  });

  it('rejects unsupported type', () => {
    const result = validateLooseCollections([
      { type: 'props', items: [{ title: 'Gun' }] }
    ]);
    expect(result.valid).toBe(false);
  });

  it('rejects UI-specific payload keys', () => {
    const result = validateLooseCollections([
      { type: 'characters', items: [{ title: 'Mara', panel: 'sidebar' }] }
    ]);
    expect(result.valid).toBe(false);
  });

  it('normalizes title and description', () => {
    const result = normalizeLooseCollections({
      collections: [{
        type: 'characters',
        items: [{ title: '  Mara Voss ', description: '  Detective. ' }]
      }],
      scriptId: 9,
      chatRequestId: 'req-1',
      generatedFromIntent: 'GENERATE_COLLECTIONS'
    });

    expect(result.valid).toBe(true);
    expect(result.collections[0].items[0].title).toBe('Mara Voss');
    expect(result.collections[0].items[0].description).toBe('Detective.');
    expect(result.collections[0].items[0].source).toBe('ai');
  });

  it('dedupes by script type and normalized title', () => {
    const key = '9:characters:' + normalizeTitleKey('Mara Voss');
    const { collections, skipped } = dedupeNormalizedCollections([
      {
        type: 'characters',
        items: [{ scriptId: 9, title: 'Mara Voss', collectionType: 'characters' }]
      }
    ], [key]);

    expect(collections).toHaveLength(0);
    expect(skipped).toHaveLength(1);
  });
});

describe('resolveOutcome GENERATE_COLLECTIONS', () => {
  const baseContext = { scriptId: 42 };

  it('routes create characters to GENERATE_COLLECTIONS with minimal profile', () => {
    const result = resolveOutcome('Create 3 characters for this script', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.GENERATE_COLLECTIONS);
    expect(result.contextProfile).toBe(CONTEXT_PROFILE.MINIMAL);
    expect(result.generateCollections).toContain('characters');
    expect(result.attachEntityContext).toBe(false);
  });

  it('routes use my characters to attachEntityContext without generation', () => {
    const result = resolveOutcome('What do you think of my characters?', baseContext);
    expect(result.attachEntityContext).toBe(true);
    expect(result.generateCollections).toEqual([]);
    expect(result.outcome).not.toBe(CHAT_OUTCOME.GENERATE_COLLECTIONS);
  });

  it('keeps WRITE_CONTINUE without default entity attachment', () => {
    const result = resolveOutcome('Please continue the script', baseContext);
    expect(result.outcome).toBe(CHAT_OUTCOME.WRITE_CONTINUE);
    expect(result.attachEntityContext).toBe(false);
    expect(result.generateCollections).toEqual([]);
  });
});

describe('validateNormalizedCollections', () => {
  it('requires groups for GENERATE contract-style validation', () => {
    const result = validateNormalizedCollections([], { required: true });
    expect(result.valid).toBe(false);
  });
});
