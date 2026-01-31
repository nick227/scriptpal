import { CATEGORY_KEYS } from './constants.js';
import { buildId, normalizeSeed, shuffle, takeUnique } from './brainstormUtils.js';

const generalAssociations = [
    'echo', 'spark', 'rift', 'pulse', 'mirror', 'thread', 'orbit', 'signal',
    'shade', 'whisper', 'turning point', 'glow', 'fragment', 'tide', 'anchor',
    'veil', 'compass', 'storm', 'catalyst', 'drift', 'threshold', 'sparkline',
    'fracture', 'horizon', 'afterimage', 'curve', 'hinge', 'hollow'
];

const storyTemplates = [
    'A promise tied to {seed} unravels at the worst time.',
    'A secret about {seed} forces a risky alliance.',
    '{seed} becomes the countdown to a public reckoning.',
    'A forgotten {seed} resurfaces and changes the stakes.',
    'A rival steals {seed}, forcing a daring recovery.'
];

const characterTemplates = [
    'A guardian of {seed} who hides a fragile past.',
    'A fixer who treats {seed} like a personal debt.',
    'A rival who sees {seed} as proof of their worth.',
    'A mentor who warns that {seed} always costs more.',
    'A newcomer obsessed with decoding {seed}.'
];

const locationTemplates = [
    'A coastal outpost where {seed} is spoken like a prayer.',
    'A high-rise lab built around {seed} protocols.',
    'A market district where {seed} is traded in whispers.',
    'A mountain relay station guarding {seed}.',
    'An underground archive storing the history of {seed}.'
];

const replaceSeed = (template, seed) => template.replace('{seed}', seed);

const buildGeneralNotes = (seed, count) => {
    const seedLabel = normalizeSeed(seed);
    const associationMix = shuffle(generalAssociations);
    const base = associationMix.map((word) => `${seedLabel} · ${word}`);
    const variations = associationMix.map((word) => `${word} around ${seedLabel}`);
    const combined = takeUnique([...base, ...variations], count * 2);
    return takeUnique(shuffle(combined), count);
};

const buildTemplateNotes = (templates, seed, count) =>
    templates.map((template) => replaceSeed(template, seed)).slice(0, count);

const generators = {
    [CATEGORY_KEYS.GENERAL]: buildGeneralNotes,
    [CATEGORY_KEYS.STORY]: (seed, count) => buildTemplateNotes(storyTemplates, seed, count),
    [CATEGORY_KEYS.CHARACTER]: (seed, count) => buildTemplateNotes(characterTemplates, seed, count),
    [CATEGORY_KEYS.LOCATION]: (seed, count) => buildTemplateNotes(locationTemplates, seed, count)
};

export const generateNotes = (categoryKey, seed, count) => {
    const seedValue = normalizeSeed(seed);
    const generator = generators[categoryKey];
    if (!generator) {
        throw new Error(`Unknown category "${categoryKey}"`);
    }
    const notes = generator(seedValue, count);

    return notes.map((text) => ({
        id: buildId(categoryKey),
        category: categoryKey,
        text
    }));
};
