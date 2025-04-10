import { scriptPatterns, commonDirectionWords } from './scriptPatterns.js';

// Base parser with core screenplay format detection methods
export class ScreenplayParser {
    constructor(text) {
        this.text = text;
        this.lines = [];
        this.patterns = scriptPatterns;
        this.result = {
            lines: [],
            metadata: {
                parserName: this.constructor.name,
                totalLines: 0,
                formats: {
                    header: 0,
                    speaker: 0,
                    dialog: 0,
                    directions: 0,
                    'chapter-break': 0
                }
            }
        };
    }

    // Core parsing methods
    splitIntoLines() {
        return this.text.split(/\r?\n/);
    }

    addLine(text, format) {
        this.lines.push({ text, format });
    }

    // Block handling methods
    createBlock() {
        return { text: '', format: null };
    }

    commitBlock(block) {
        if (block.text && block.format) {
            this.addLine(block.text, block.format);
            return this.createBlock();
        }
        return block;
    }

    appendToBlock(block, text) {
        if (block.text) {
            block.text += ' ' + text;
        } else {
            block.text = text;
        }
    }

    // Format detection methods
    isAllCaps(text) {
        const trimmed = text.trim();
        return trimmed === trimmed.toUpperCase() &&
            trimmed.length > 1 &&
            /[A-Z]/.test(trimmed);
    }

    hasParenthetical(text) {
        return /^\(.*\)$/.test(text.trim());
    }

    isSceneHeader(text) {
        const trimmed = text.trim().toUpperCase();
        if (!this.isAllCaps(trimmed)) return false;

        return this.patterns.header.scene.test(trimmed) ||
            this.patterns.header.transition.test(trimmed) ||
            this.patterns.header.continued.test(trimmed) ||
            this.patterns.header.overBlack.test(trimmed) ||
            (trimmed.includes('-') && this.patterns.header.timeOfDay.test(trimmed));
    }

    isSpeaker(text, previousLine = '', nextLine = '') {
        const trimmed = text.trim();

        if (!this.isAllCaps(trimmed) ||
            trimmed.length > 40 ||
            this.hasParenthetical(trimmed) ||
            this.isSceneHeader(trimmed) ||
            this.patterns.formatting.pageNumber.test(trimmed) ||
            this.patterns.formatting.sceneNumber.test(trimmed) ||
            previousLine.trim().endsWith('"')) {
            return false;
        }

        const words = trimmed.split(/\s+/);
        if (words.length === 1 && commonDirectionWords.has(trimmed)) {
            return false;
        }

        const hasDialogContext =
            this.isDialog(nextLine) ||
            this.hasParenthetical(nextLine) ||
            this.patterns.character.voiceOver.test(trimmed) ||
            this.patterns.character.offScreen.test(trimmed);

        const looksLikeAction = this.patterns.character.filterWords.test(trimmed);

        return hasDialogContext && !looksLikeAction;
    }

    isDialog(text, previousLine = '') {
        if (!text || this.isAllCaps(text) || this.isSceneHeader(text)) {
            return false;
        }

        const validPrevLine = previousLine && (
            this.isSpeaker(previousLine) ||
            this.hasParenthetical(previousLine) ||
            this.patterns.formatting.moreDialog.test(previousLine)
        );

        const reasonableLength = text.length < 100;

        return validPrevLine && reasonableLength;
    }

    isDirection(text, previousLine = '', nextLine = '') {
        if (!text || text.length < 3) return false;

        if (this.isSceneHeader(text) ||
            (this.isSpeaker(text, previousLine, nextLine) && !this.hasParenthetical(text))) {
            return false;
        }

        if (this.hasParenthetical(text)) return true;

        const hasActionIndicators = /^(?:ANGLE|CAMERA|CLOSE|WIDE|PAN|TRACKING|MOVING)/i.test(text) ||
            /^(?:ON|TO|AT|IN|THROUGH)/i.test(text);

        return hasActionIndicators ||
            !this.patterns.formatting.pageNumber.test(text);
    }

    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\b-\b/g, ' - ')
            .trim();
    }

    // Utility methods
    shouldSkipLine(line) {
        return !line || /^\s*$/.test(line);
    }

    getParseResult() {
        return {
            lines: this.lines,
            totalLines: this.lines.length
        };
    }

    // Abstract method to be implemented by specific parsers
    parse() {
        throw new Error('parse() method must be implemented by specific parser');
    }
}