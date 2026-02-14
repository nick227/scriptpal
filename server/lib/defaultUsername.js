import { normalizeUsername } from './username.js';

const ADJECTIVES = [
  'bright', 'calm', 'cosmic', 'daring', 'eager', 'fancy', 'gentle', 'happy',
  'jazzy', 'kind', 'lucky', 'mellow', 'nimble', 'orbit', 'peppy', 'quick',
  'royal', 'sunny', 'tidy', 'vivid', 'witty', 'zesty'
];

const NOUNS = [
  'badger', 'comet', 'otter', 'falcon', 'lion', 'panda', 'writer', 'raven',
  'pixel', 'scene', 'story', 'actor', 'sage', 'tiger', 'wolf', 'yak'
];

const randomItem = (list) => list[Math.floor(Math.random() * list.length)];
const randomSuffix = () => Math.random().toString(36).slice(2, 6);

const createCandidate = () => {
  const raw = `${randomItem(ADJECTIVES)}_${randomItem(NOUNS)}_${randomSuffix()}`;
  return normalizeUsername(raw).slice(0, 32);
};

export const generateDefaultUsername = async({ isTaken, maxAttempts = 200 } = {}) => {
  if (typeof isTaken !== 'function') {
    throw new Error('generateDefaultUsername requires an isTaken function');
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createCandidate();
    if (!candidate) continue;
    // Keep route identity globally unique.
    const taken = await isTaken(candidate);
    if (!taken) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique default username');
};

