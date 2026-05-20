import { GenerateCollectionsChain } from '../../langchain/chains/collections/GenerateCollectionsChain.js';
import { dedupeNormalizedCollections, normalizeLooseCollections } from './normalizeCollections.js';
import { validateNormalizedCollections } from './validateCollections.js';
import { persistNormalizedCollections, loadExistingCollectionKeys } from './persistCollections.js';
import { CHAT_OUTCOME } from '../intent/outcomes.js';

const mergeCollections = (primary = [], secondary = []) => {
  const byType = new Map();

  [...primary, ...secondary].forEach((group) => {
    if (!group?.type) {
      return;
    }
    const existing = byType.get(group.type) || { type: group.type, items: [] };
    existing.items.push(...(Array.isArray(group.items) ? group.items : []));
    byType.set(group.type, existing);
  });

  return Array.from(byType.values());
};

export const augmentResponseWithGeneratedCollections = async ({
  response,
  context,
  prompt,
  intent
}) => {
  const requested = Array.isArray(context?.generateCollections)
    ? context.generateCollections
    : [];

  if (!requested.length || (Array.isArray(response?.collections) && response.collections.length)) {
    return response;
  }

  const chain = new GenerateCollectionsChain();
  const generated = await chain.run({
    ...context,
    requestedCollectionTypes: requested
  }, prompt);

  return {
    ...response,
    collections: mergeCollections(response?.collections, generated?.collections),
    message: response?.message || generated?.message,
    metadata: {
      ...(response?.metadata || {}),
      ...(generated?.metadata || {}),
      collectionAugmented: true
    }
  };
};

export const processResponseCollections = async ({
  response,
  scriptId,
  resolution,
  intent,
  chatRequestId = null,
  context = null,
  prompt = '',
  persist = true
}) => {
  let working = response;

  if (
    resolution?.outcome !== CHAT_OUTCOME.GENERATE_COLLECTIONS &&
    resolution?.generateCollections?.length
  ) {
    working = await augmentResponseWithGeneratedCollections({
      response: working,
      context: {
        ...(context || {}),
        generateCollections: resolution.generateCollections,
        scriptId,
        chatRequestId
      },
      prompt: prompt || context?.prompt || '',
      intent
    });
  }

  const loose = working?.collections;
  if (!Array.isArray(loose) || !loose.length) {
    return working;
  }

  const normalized = normalizeLooseCollections({
    collections: loose,
    scriptId,
    chatRequestId,
    generatedFromIntent: intent
  });

  if (!normalized.valid) {
    if (resolution?.outcome === CHAT_OUTCOME.GENERATE_COLLECTIONS) {
      throw new Error(`collections_invalid: ${normalized.errors.join('; ')}`);
    }
    return {
      ...working,
      collections: [],
      metadata: {
        ...(working.metadata || {}),
        collectionsRejected: normalized.errors
      }
    };
  }

  const existingKeys = persist && scriptId
    ? await loadExistingCollectionKeys(scriptId)
    : [];
  const deduped = dedupeNormalizedCollections(normalized.collections, existingKeys);

  const contractCheck = validateNormalizedCollections(deduped.collections, {
    required: resolution?.outcome === CHAT_OUTCOME.GENERATE_COLLECTIONS
  });

  if (!contractCheck.valid) {
    throw new Error(`collections_invalid: ${contractCheck.errors.join('; ')}`);
  }

  let apiCollections = deduped.collections;
  let skipped = deduped.skipped;

  if (persist && scriptId) {
    const persisted = await persistNormalizedCollections(deduped.collections, scriptId);
    apiCollections = persisted.collections;
    skipped = [...skipped, ...persisted.skipped];
  }

  return {
    ...working,
    script: working.script ?? null,
    collections: apiCollections,
    metadata: {
      ...(working.metadata || {}),
      collectionsSkipped: skipped,
      collectionsItemCount: contractCheck.itemCount
    }
  };
};
