const APPEND_PAGE_PATTERNS = [
  /\bnext page\b/i,
  /\bnext scene\b/i,
  /\b(add|write|generate|continue|append)\b[\s\S]{0,40}\bpage\b/i,
  /\b(add|append|continue|write)\b[\s\S]{0,30}\bscene\b[\s\S]{0,25}\b(to|into|in)?\s*(the\s+)?(script|screenplay)\b/i,
  /\b(write|continue)\b[\s\S]{0,30}\bnext\s+scene\b/i,
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

  if (isAddSceneOutlineRequest(prompt)) {
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
  /\b(write|generate|draft|create|complete|finish|start)\b[\s\S]{0,50}\b(script|screenplay)\b[\s\S]{0,50}\bfrom\b[\s\S]{0,30}\b(scenes?|scene\s*list|outline)\b/i,
  /\b(write|generate|draft|create)\b[\s\S]{0,60}\b(script|screenplay)\b[\s\S]{0,60}\b(based on|from|using)\b[\s\S]{0,60}\b(scenes?|scene\s*list|outline|collection)\b/i,
  /\b(script|screenplay)\b[\s\S]{0,50}\b(based on|from|using)\b[\s\S]{0,50}\b(scenes?|scene\s*list|outline|collection)\b/i,
  /\b(write|generate|draft|create)\b[\s\S]{0,80}\b(scenes?)\b[\s\S]{0,40}\b(collection|outline|list)\b/i,
  /\b(write|generate)\b[\s\S]{0,40}\bfrom\s+my\s+(scenes?|outline)\b(?!\s*(#|\d))/i,
  /\bgenerate\s+(the\s+)?(script|screenplay)\s+from\s+(my\s+)?(scenes?|outline)\b/i,
  /\b(use|using)\b[\s\S]{0,40}\b(current\s+)?scenes?\b[\s\S]{0,50}\b(write|complete|finish)\b/i,
  /\b(use|using)\b[\s\S]{0,40}\b(current\s+)?scenes?\b[\s\S]{0,50}\b(our|the|my)?\s*(script|screenplay)\b/i,
  /\bstart\s+writing\b[\s\S]{0,40}\b(the\s+)?(script|screenplay)\b[\s\S]{0,40}\bfrom\b/i
];

const SCENE_WRITE_CONTINUATION_PATTERN = /^(?:ok(?:ay)?|yes|yep|sure|proceed|go ahead|continue|do it|start(?:\s+now)?|please\s+(?:go ahead|proceed|continue))(?:[.!,?\s]+(?:please|now|proceed|continue|go ahead))?$/i;

/** Add a scene row to the outline/list — not screenplay append */
export const isAddSceneOutlineRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return /\b(add|create|insert|include)\b[\s\S]{0,35}\b(?:a\s+)?scene\b/i.test(prompt)
    && !/\b(add|write|generate|continue|append)\b[\s\S]{0,40}\b(script|screenplay|page)\b/i.test(prompt);
};

/** Write screenplay content for one scene (numbered or "about X") */
export const isWriteSceneScreenplayRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string' || isAddSceneOutlineRequest(prompt)) {
    return false;
  }

  if (/\b(write|generate|draft|create)\b[\s\S]{0,40}\bscene\s*(?:#?\s*)?\d+\b/i.test(prompt)) {
    return true;
  }

  return /\b(write|generate|draft|create|start)\b[\s\S]{0,40}\b(?:a\s+)?scene\b/i.test(prompt)
    && !/\b(scene\s*list|scene\s*outline|character\s*list)\b/i.test(prompt)
    && !/\bto\s+(?:our|my|the)\s+scene\s*list\b/i.test(prompt)
    && !/\bfrom\s+(?:the\s+)?scene\s*list\b/i.test(prompt)
    && !/\b(script|screenplay)\b[\s\S]{0,30}\bfrom\b/i.test(prompt);
};

export const isWriteFromScenesRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  return WRITE_FROM_SCENES_PATTERNS.some((pattern) => pattern.test(prompt));
};

/** Short confirmation after a scene-list → script request (e.g. "ok proceed") */
export const isSceneWriteContinuationRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > 48) {
    return false;
  }

  return SCENE_WRITE_CONTINUATION_PATTERN.test(trimmed);
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
  isWriteSceneScreenplayRequest(prompt) ||
  /\b(continue|keep going|next lines|more lines|write more|add more)\b/i.test(prompt) ||
  /\b(rewrite|rephrase|revise)\b/i.test(prompt)
);

/** Discuss/compare scenes vs plan or script — chat only */
export const isDiscussScenesRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  if (isWriteFromScenesRequest(prompt) || isWriteSceneScreenplayRequest(prompt)) {
    return false;
  }

  const generateTypes = resolveGenerateCollectionTypes(prompt);
  if (isPrimaryGenerateCollectionsRequest(prompt, generateTypes)) {
    return false;
  }

  return (
    /\b(are\s+we|do\s+we|should\s+we|is\s+there)\b[\s\S]{0,40}\b(missing|lack|need)\b[\s\S]{0,40}\bscenes?\b/i.test(prompt)
    || /\b(missing|gap|gaps|coverage)\b[\s\S]{0,50}\b(scenes?|scene\s*list|plan|outline)\b/i.test(prompt)
    || /\bscenes?\b[\s\S]{0,40}\b(in\s+)?(script|plan|outline)\b[\s\S]{0,30}\b(from|vs|versus|match)\b/i.test(prompt)
    || /\b(scene\s*list|scene\s*outline|my\s+scenes)\b[\s\S]{0,40}\b(work|fit|match)\b/i.test(prompt)
  );
};

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

/** User rejecting prior collection/scene suggestions — chat only, no script append */
export const isCollectionFeedbackRequest = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return false;
  }

  const types = resolveGenerateCollectionTypes(prompt);
  if (isPrimaryGenerateCollectionsRequest(prompt, types)) {
    return false;
  }

  if (hasStrongWriteIntent(prompt)) {
    return false;
  }

  const rejection = /\b(too obvious|not good enough|try again|start over|redo|do over|wrong ones|bad ones|don't like)\b/i;
  const deleteish = /\b(delete|remove|drop|clear|undo|get rid of)\b[\s\S]{0,40}\b(those|these|them|all)\b/i;
  return rejection.test(prompt) || deleteish.test(prompt);
};
