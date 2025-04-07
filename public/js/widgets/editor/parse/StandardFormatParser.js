import { ScreenplayParser } from './ScreenplayParser.js';
import {
    isSceneHeader,
    isSpeaker,
    isDialog,
    hasParenthetical,
    isDirection,
    cleanText
} from './utils/ParserUtils.js';

export class StandardFormatParser extends ScreenplayParser {
    constructor(text) {
        super(text);
        this.state = {
            inDialogBlock: false,
            consecutiveDirections: 0,
            lastSpeaker: null,
            lastFormat: null
        };
    }

    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (this.shouldSkipLine(line)) {
                this.resetStateIfNeeded();
                continue;
            }

            const cleanedLine = cleanText(line);
            let format = this.determineFormat(cleanedLine, previousLine, nextLine);

            format = this.applyContextualRules(format, cleanedLine);

            if (format) {
                this.addLine(cleanedLine, format);
                this.updateState(format, cleanedLine);
            } else {
                this.resetStateIfNeeded();
            }

            previousLine = cleanedLine;
        }

        return this.getParseResult();
    }

    determineFormat(line, previousLine, nextLine) {
        // Early return for empty lines
        if (!line) return null;

        // Scene headers take precedence
        if (isSceneHeader(line)) {
            return 'header';
        }

        // Speaker detection
        if (isSpeaker(line, previousLine, nextLine)) {
            return 'speaker';
        }

        // Dialog block handling
        if (this.state.inDialogBlock) {
            if (hasParenthetical(line)) {
                return 'directions';
            }
            if (isDialog(line, previousLine)) {
                return 'dialog';
            }
        }

        // Direction detection
        if (isDirection(line, previousLine, nextLine)) {
            return 'directions';
        }

        return null;
    }

    applyContextualRules(format, line) {
        // Don't modify certain formats
        if (format === 'header' || format === 'speaker') {
            return format;
        }

        // Handle consecutive directions
        if (format === 'directions') {
            this.state.consecutiveDirections++;
            if (this.state.consecutiveDirections > 3 && this.state.inDialogBlock) {
                return 'dialog';
            }
        } else {
            this.state.consecutiveDirections = 0;
        }

        // Handle potential dialog continuation
        if (!format && this.state.lastFormat === 'dialog' &&
            /^[a-z]/i.test(line) && !isSceneHeader(line)) {
            return 'dialog';
        }

        return format;
    }

    updateState(format, line) {
        this.state.lastFormat = format;

        switch (format) {
            case 'speaker':
                this.state.inDialogBlock = true;
                this.state.lastSpeaker = line;
                this.state.consecutiveDirections = 0;
                break;
            case 'header':
                this.resetState();
                break;
            case 'dialog':
                this.state.consecutiveDirections = 0;
                break;
        }
    }

    resetStateIfNeeded() {
        if (this.state.consecutiveDirections > 5) {
            this.resetState();
        }
    }

    resetState() {
        this.state = {
            inDialogBlock: false,
            consecutiveDirections: 0,
            lastSpeaker: null,
            lastFormat: null
        };
    }

    shouldSkipLine(line) {
        const cleaned = cleanText(line);
        return !cleaned || /^[-—_\s*]*$/.test(cleaned);
    }
}