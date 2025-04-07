export const createBlock = (lines = []) => ({
    text: '',
    format: null,
    lines // Reference to lines array for easier management
});

export const cleanText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
};

export const appendToBlock = (block, text) => {
    const cleanedText = cleanText(text);
    if (!cleanedText) return;

    if (block.text) {
        block.text += ' ' + cleanedText;
    } else {
        block.text = cleanedText;
    }
};

export const commitBlock = (block) => {
    if (block.text && block.format && block.lines) {
        block.lines.push({ text: block.text, format: block.format });
    }
    return createBlock(block.lines);
};

// Pattern matching utilities
const SCENE_HEADERS = new Set([
    'INT.', 'EXT.', 'INT/EXT.', 'I/E.', 'INT./EXT.', 'EXT./INT.'
]);

export const isSceneHeader = (line) => {
    const cleaned = cleanText(line).toUpperCase();
    return SCENE_HEADERS.has(cleaned.split(' ')[0]) ||
        /^(?:INT\.|EXT\.|INT\/EXT\.|\.|I\/E\.)/i.test(cleaned);
};

export const isSpeaker = (line, prevLine, nextLine) => {
    if (!line) return false;
    const line_clean = cleanText(line);

    // More flexible speaker pattern
    const speakerPattern = /^[A-Z][A-Z\s\d]*$/;
    const containsLowerCase = /[a-z]/.test(line_clean);

    return (
        speakerPattern.test(line_clean) &&
        !containsLowerCase &&
        line_clean.length < 40 &&
        line_clean.length > 1 &&
        (!prevLine || /^\s*$/.test(prevLine)) &&
        (!nextLine || /^\s*\(/.test(nextLine) || /^[a-z]/i.test(nextLine))
    );
};

export const isDialog = (line, prevLine) => {
    if (!line || !prevLine) return false;
    const cleanedLine = cleanText(line);
    const cleanedPrev = cleanText(prevLine);

    return (
        /^[a-z]/i.test(cleanedLine) &&
        (isSpeaker(cleanedPrev, '', '') || /^\(.*\)$/.test(cleanedPrev))
    );
};

export const hasParenthetical = (line) => {
    const cleaned = cleanText(line);
    return /^\(.*\)$/.test(cleaned) &&
        // Check for balanced parentheses
        (cleaned.match(/\(/g) || []).length === (cleaned.match(/\)/g) || []).length;
};

// Enhanced direction patterns
const DIRECTION_MARKERS = new Set([
    'ANGLE ON', 'BACK TO', 'CLOSE ON', 'CUT TO', 'DISSOLVE TO',
    'FADE IN', 'FADE OUT', 'FADE TO', 'FLASH CUT', 'FLASHBACK',
    'BACK TO PRESENT', 'INTERCUT', 'MATCH CUT', 'PAN TO',
    'POINT OF VIEW', 'POV', 'SCENE', 'SMASH CUT', 'TIME CUT',
    'TITLE', 'TITLES', 'TRANSITION', 'WIPE TO'
]);

const CAMERA_TERMS = new Set([
    'CAMERA', 'ANGLE', 'TRACKING', 'MOVING', 'CRANE', 'DOLLY',
    'STEADY CAM', 'HANDHELD', 'AERIAL', 'UNDERWATER'
]);

const TIME_INDICATORS = new Set([
    'LATER', 'CONTINUOUS', 'MOMENTS LATER', 'SAME TIME',
    'MEANWHILE', 'NIGHT', 'DAY', 'MORNING', 'EVENING'
]);

export const isDirection = (line, prevLine, nextLine) => {
    if (!line) return false;
    const line_clean = cleanText(line).toUpperCase();

    // Quick checks first
    if (isSceneHeader(line_clean) ||
        isSpeaker(line_clean, prevLine, nextLine) ||
        hasParenthetical(line_clean) ||
        isDialog(line_clean, prevLine)) {
        return false;
    }

    // Check for common direction markers
    const words = line_clean.split(' ');
    if (DIRECTION_MARKERS.has(words[0]) ||
        DIRECTION_MARKERS.has(words.slice(0, 2).join(' '))) {
        return true;
    }

    // Check for camera terms
    if (CAMERA_TERMS.has(words[words.length - 1])) {
        return true;
    }

    // Check for time indicators
    if (TIME_INDICATORS.has(line_clean)) {
        return true;
    }

    // Check for action descriptions
    return (
        /^[A-Z]/.test(line_clean) && // Starts with capital letter
        line_clean.length > 1 && // Not just a single character
        !/^[A-Z\s]+$/.test(line_clean) // Not all caps (which might be a character name)
    );
};