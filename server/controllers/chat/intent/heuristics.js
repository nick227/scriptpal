const APPEND_PAGE_PATTERNS = [
  /\bnext page\b/i,
  /\bnext scene\b/i,
  /\b(add|write|generate|continue|append)\b[\s\S]{0,40}\bpage\b/i,
  /\b(add|write|generate|continue|append)\b[\s\S]{0,40}\bscene\b/i,
  /\b(add|write|generate|continue)\b[\s\S]{0,40}\bscript\b/i,
  /\b(add|write|generate|continue)\b[\s\S]{0,40}\bscreenplay\b/i
];

const NEXT_FIVE_LINES_PATTERN = /\b(next|write|generate|add|continue)\b[\s\S]{0,40}\b(5|five)\b[\s\S]{0,20}\blines?\b/i;

const FULL_SCRIPT_PATTERNS = [
  /\b(generate|write|create)\b[\s\S]{0,50}\bfull script\b/i,
  /\b(generate|write|create)\b[\s\S]{0,50}\bfull screenplay\b/i,
  /\b(generate|write|create)\b[\s\S]{0,50}\blong script\b/i,
  /\blong[- ]form script\b/i,
  /\b(full story arc)\b/i,
  /\b(10|ten|11|eleven|12|twelve|13|thirteen|14|fourteen|15|fifteen)\s*[- ]?\s*(page|pages)\b/i,
  /\b(continue|expand)\b[\s\S]{0,50}\bseries\b/i,
  /\b(generate|write|create)\b[\s\S]{0,50}\bnovel\b/i
];

const CHAT_ONLY_PATTERN = /\b(?:just chat|talk about|chit chat|quick question|small talk|random|how are you|anything else)\b/i;
const REFLECTION_REQUEST_PATTERN = /\b(?:critique|feedback|discussion|discuss|analysis|analyze|reflect|reflection|thoughts|review)\b/i;

export const isAppendPageRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  if (NEXT_FIVE_LINES_PATTERN.test(prompt)) {
    return false;
  }

  return APPEND_PAGE_PATTERNS.some(pattern => pattern.test(prompt));
};

export const isNextFiveLinesRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return NEXT_FIVE_LINES_PATTERN.test(prompt);
};

export const isFullScriptRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return FULL_SCRIPT_PATTERNS.some(pattern => pattern.test(prompt));
};

export const isGeneralConversation = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return true;
  }

  return CHAT_ONLY_PATTERN.test(prompt);
};

export const isReflectionRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return REFLECTION_REQUEST_PATTERN.test(prompt);
};

const ATTACH_HISTORY_PATTERN = /\b(that|what you (wrote|said)|last (version|time|response)|change (it|that)|like you suggested|you (just |)(wrote|said)|previous (message|reply))\b/i;

const WRITE_FROM_SCENES_PATTERNS = [
  /\b(write|generate|draft|create)\b[\s\S]{0,50}\b(all|every)\b[\s\S]{0,30}\bscenes?\b/i,
  /\b(write|generate|draft|create)\b[\s\S]{0,50}\b(script|screenplay)\b[\s\S]{0,50}\bfrom\b[\s\S]{0,30}\b(scenes?|outline)\b/i,
  /\b(write|generate)\b[\s\S]{0,40}\bfrom\s+my\s+(scenes?|outline)\b(?!\s*(#|\d))/i,
  /\bgenerate\s+(the\s+)?(script|screenplay)\s+from\s+(my\s+)?(scenes?|outline)\b/i
];

export const isWriteFromScenesRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return WRITE_FROM_SCENES_PATTERNS.some((pattern) => pattern.test(prompt));
};

const GENERATE_COLLECTION_VERBS = /\b(create|generate|add|suggest|make|draft|build)\b/i;
const LIST_ENTITIES_PATTERN = /\b(?:make\s+(?:a\s+)?list\s+(?:of\s+)?|list\s+(?:of\s+)?)(characters?|locations?|scenes?|themes?|outlines?|story\s*elements)\b/i;

const COLLECTION_NOUN_PATTERNS = {
  characters: /\bcharacters?\b/i,
  locations: /\blocations?\b/i,
  scenes: /\b(scenes?|scene\s*list)\b/i,
  themes: /\bthemes?\b/i,
  outlines: /\b(outlines?|beat\s*sheet|story\s*beats?)\b/i
};

const ATTACH_ENTITY_CONTEXT_PATTERN = /\b(use|based on|from|existing|my|already have|what|keep)\b[\s\S]{0,50}\b(my\s+)?(characters?|locations?|scenes?|scene\s*list|themes?|outlines?)\b/i;

const EXTRACT_ENTITIES_FROM_SCRIPT_PATTERN = /\b(pull|extract|find|identify)\b[\s\S]{0,50}\b(characters?|locations?|scenes?|entities|themes?)\b[\s\S]{0,50}\b(from|in)\b[\s\S]{0,50}\b(script|scene|page|wrote|written|screenplay)\b/i;

const hasGenerateCollectionVerb = (prompt) => (
  GENERATE_COLLECTION_VERBS.test(prompt) || LIST_ENTITIES_PATTERN.test(prompt)
);

export const resolveGenerateCollectionTypes = (prompt) => {
  if (!prompt || typeof prompt !== 'string' || !hasGenerateCollectionVerb(prompt)) {
    return [];
  }

  return Object.entries(COLLECTION_NOUN_PATTERNS)
    .filter(([, pattern]) => pattern.test(prompt))
    .map(([type]) => type);
};

export const isAttachEntityContextRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return ATTACH_ENTITY_CONTEXT_PATTERN.test(prompt);
};

export const isExtractEntitiesFromScriptRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return EXTRACT_ENTITIES_FROM_SCRIPT_PATTERN.test(prompt);
};

const hasStrongWriteIntent = (prompt) => (
  isNextFiveLinesRequest(prompt) ||
  isAppendPageRequest(prompt) ||
  isFullScriptRequest(prompt) ||
  isWriteFromScenesRequest(prompt) ||
  /\b(write|generate|draft|create)\b[\s\S]{0,40}\bscene\s*(?:#?\s*)?\d+\b/i.test(prompt) ||
  /\b(continue|keep going|next lines|more lines|write more|add more)\b/i.test(prompt) ||
  /\b(rewrite|rephrase|revise)\b/i.test(prompt)
);

export const isPrimaryGenerateCollectionsRequest = (prompt, generateTypes = []) => {
  if (!generateTypes.length) {
    return false;
  }

  if (!hasGenerateCollectionVerb(prompt)) {
    return false;
  }

  return !hasStrongWriteIntent(prompt);
};

export const isAttachHistoryRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return ATTACH_HISTORY_PATTERN.test(prompt);
};
