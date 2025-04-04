import { ScreenplayParser } from './ScreenplayParser.js';
import {
    isSceneHeader,
    isSpeaker,
    isDialog,
    hasParenthetical,
    isDirection,
    cleanText,
    createBlock,
    appendToBlock
} from './utils/ParserUtils.js';

export class PlainTextFormatParser extends ScreenplayParser {
    constructor(text) {
        super(text);
        this.state = {
            inDialogBlock: false,
            currentBlock: createBlock([]),
            consecutiveBlankLines: 0,
            lastFormat: null
        };
    }

    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';

        for (let i = 0; i < rawLines.length; i++) {
            const line = cleanText(rawLines[i]);
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (!line) {
                this.handleBlankLine();
                continue;
            }

            this.state.consecutiveBlankLines = 0;
            this.processLine(line, previousLine, nextLine);
            previousLine = line;
        }

        // Commit any remaining block
        this.commitCurrentBlock();
        return this.getParseResult();
    }

    handleBlankLine() {
        this.state.consecutiveBlankLines++;
        if (this.state.consecutiveBlankLines > 1) {
            this.commitCurrentBlock();
            this.state.inDialogBlock = false;
        }
    }

    processLine(line, previousLine, nextLine) {
        // Try to detect format with more lenient rules for plain text
        let format = this.determineFormat(line, previousLine, nextLine);

        if (format) {
            this.handleFormattedLine(line, format);
        } else {
            this.handleUnformattedLine(line, previousLine);
        }
    }

    determineFormat(line, previousLine, nextLine) {
        // More lenient scene header detection for plain text
        if (this.isLenientSceneHeader(line)) {
            return 'header';
        }

        // More lenient speaker detection
        if (this.isLenientSpeaker(line, previousLine, nextLine)) {
            return 'speaker';
        }

        if (hasParenthetical(line)) {
            return 'directions';
        }

        if (this.state.inDialogBlock && this.isLenientDialog(line, previousLine)) {
            return 'dialog';
        }

        if (isDirection(line, previousLine, nextLine)) {
            return 'directions';
        }

        return null;
    }

    handleFormattedLine(line, format) {
        if (format === 'speaker') {
            this.commitCurrentBlock();
            this.addLine(line, format);
            this.state.inDialogBlock = true;
            this.state.lastFormat = format;
        } else if (format === 'dialog' && this.state.lastFormat === 'dialog') {
            appendToBlock(this.state.currentBlock, line);
        } else {
            this.commitCurrentBlock();
            this.state.currentBlock.format = format;
            this.state.currentBlock.text = line;
            this.state.lastFormat = format;
        }
    }

    handleUnformattedLine(line, previousLine) {
        // If we're in a dialog block and the line looks like continued dialog
        if (this.state.inDialogBlock && this.isLenientDialog(line, previousLine)) {
            if (this.state.currentBlock.format === 'dialog') {
                appendToBlock(this.state.currentBlock, line);
            } else {
                this.commitCurrentBlock();
                this.state.currentBlock.format = 'dialog';
                this.state.currentBlock.text = line;
            }
        } else {
            // Default to directions for unformatted lines
            if (this.state.currentBlock.format === 'directions') {
                appendToBlock(this.state.currentBlock, line);
            } else {
                this.commitCurrentBlock();
                this.state.currentBlock.format = 'directions';
                this.state.currentBlock.text = line;
            }
        }
    }

    commitCurrentBlock() {
        if (this.state.currentBlock.text && this.state.currentBlock.format) {
            this.addLine(
                this.state.currentBlock.text,
                this.state.currentBlock.format
            );
        }
        this.state.currentBlock = createBlock([]);
    }

    isLenientSceneHeader(line) {
        const upperLine = line.toUpperCase();
        return (
            isSceneHeader(line) ||
            /^(?:SCENE|ACT|CHAPTER|LOCATION)[\s\d]*[:.-]/.test(upperLine) ||
            /^(?:INT|EXT|[IE]\/[IE]|EST)[\s.]+/.test(upperLine)
        );
    }

    isLenientSpeaker(line, prevLine, nextLine) {
        if (isSpeaker(line, prevLine, nextLine)) return true;

        const upperLine = line.toUpperCase();
        return (
            /^[@A-Z][A-Z\s\d@]*$/.test(upperLine) && // Allow @ for email-style names
            line.length < 40 &&
            line.length > 1 &&
            (!prevLine || /^\s*$/.test(prevLine)) &&
            (!nextLine || /^[a-z]/i.test(nextLine))
        );
    }

    isLenientDialog(line, previousLine) {
        return (
            /^[a-z]/i.test(line) &&
            !this.isLenientSceneHeader(line) &&
            (this.state.inDialogBlock || isSpeaker(previousLine, '', '') || hasParenthetical(previousLine))
        );
    }
}