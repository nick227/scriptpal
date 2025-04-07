// Regex patterns for screenplay format detection
export const scriptPatterns = {
    header: {
        scene: /^(?:INT|EXT|INT\/EXT|I\/E)[. ]/i,
        transition: /^(?:FADE (?:IN|OUT)|CUT TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|JUMP CUT TO|FADE TO BLACK|END CREDITS)[:.]?$/i,
        continued: /^(?:CONTINUED|CONTINUING|CONTINUOUS)[:.]?$/i,
        overBlack: /^OVER BLACK/i,
        timeOfDay: /(?:dawn|day|morning|afternoon|dusk|evening|night|later|moments later|continuous)$/i
    },
    formatting: {
        pageNumber: /^\d+\.?$/,
        sceneNumber: /^[A-Z]?\d+[A-Z]?$/,
        continued: /^CONTINUED:?$/i,
        moreDialog: /^\((?:cont'?d|continuing|more)\)$/i
    },
    character: {
        voiceOver: /\(V\.?O\.?\)|\(VOICE OVER\)$/i,
        offScreen: /\(O\.?S\.?\)|\(OFF\)|\(OFF SCREEN\)$/i,
        filterWords: /\b(?:ANGLE ON|BACK TO|CLOSE ON|CUT TO|FADE IN|FADE OUT|FLASHBACK|FLASH CUT|FROM|INTERCUT|PRELAP|POV|REVERSE ON|SCENE|STOCK SHOT|TIME CUT|TITLE|VIEW ON|WIDER)\b/
    }
};

// Common words that appear in directions but shouldn't be treated as speakers
export const commonDirectionWords = new Set([
    'THE', 'AND', 'BUT', 'THEN', 'NOW', 'SUDDENLY', 'ANGLE', 'CAMERA',
    'CLOSE', 'WIDE', 'PAN', 'TRACKING', 'MOVING', 'BACK', 'FRONT',
    'WE', 'HE', 'SHE', 'THEY', 'VIEW', 'SCENE', 'SHOT', 'ANGLE'
]);