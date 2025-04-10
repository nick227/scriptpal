import { ScreenplayParser } from './ScreenplayParser.js';
import {
    isSceneHeader,
    isSpeaker,
    isDialog,
    hasParenthetical,
    isDirection,
    cleanText,
    createBlock,
    appendToBlock,
    commitBlock
} from './utils/ParserUtils.js';

export class PDFFormatParser extends ScreenplayParser {
    constructor(text) {
        super(text);
        this.state = {
            inDialogBlock: false,
            currentBlock: createBlock([]),
            lastFormat: null
        };
    }

    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';
        let skipNext = false;

        for (let i = 0; i < rawLines.length; i++) {
            if (skipNext) {
                skipNext = false;
                continue;
            }

            const line = rawLines[i];
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (this.shouldSkipLine(line)) continue;

            const cleanedLine = cleanText(line);
            this.processLine(cleanedLine, previousLine, nextLine);

            // Handle potential line continuation in PDF format
            if (this.shouldCombineWithNext(cleanedLine, nextLine)) {
                appendToBlock(this.state.currentBlock, nextLine);
                skipNext = true;
            }

            previousLine = cleanedLine;
        }

        // Commit any remaining block
        this.commitCurrentBlock();
        return this.getParseResult();
    }

    processLine(line, previousLine, nextLine) {
        if (this.isSceneHeader(line)) {
            this.handleSceneHeader(line, nextLine);
        } else if (this.isSpeaker(line, previousLine, nextLine)) {
            this.handleSpeaker(line);
        } else if (this.state.inDialogBlock) {
            this.handleDialogBlock(line, previousLine);
        } else if (this.isDirection(line, previousLine, nextLine)) {
            this.handleDirection(line);
        }
    }

    handleSceneHeader(line, nextLine) {
        this.commitCurrentBlock();
        this.state.currentBlock.format = 'header';
        this.state.currentBlock.text = line;
        this.state.inDialogBlock = false;
    }

    handleSpeaker(line) {
        this.commitCurrentBlock();
        this.addLine(line, 'speaker');
        this.state.inDialogBlock = true;
    }

    handleDialogBlock(line, previousLine) {
        if (hasParenthetical(line)) {
            this.commitCurrentBlock();
            this.addLine(line, 'directions');
        } else if (isDialog(line, previousLine)) {
            if (this.state.currentBlock.format === 'dialog') {
                appendToBlock(this.state.currentBlock, line);
            } else {
                this.commitCurrentBlock();
                this.state.currentBlock.format = 'dialog';
                this.state.currentBlock.text = line;
            }
        } else {
            this.commitCurrentBlock();
            this.state.inDialogBlock = false;
        }
    }

    handleChapterBreak(line) {
        this.commitCurrentBlock();
        this.state.currentBlock.format = 'chapter-break';
        this.state.currentBlock.text = line;
        this.state.inDialogBlock = false;
        this.state.currentBlock.text = line;
    }

    handleDirection(line) {
        if (this.state.currentBlock.format === 'directions') {
            appendToBlock(this.state.currentBlock, line);
        } else {
            this.commitCurrentBlock();
            this.state.currentBlock.format = 'directions';
            this.state.currentBlock.text = line;
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

    shouldCombineWithNext(line, nextLine) {
        // PDF-specific rules for line continuation
        return (
            nextLine &&
            !this.isNewBlock(nextLine) &&
            !this.endsWithPunctuation(line)
        );
    }

    isNewBlock(line) {
        return (
            isSceneHeader(line) ||
            isSpeaker(line, '', '') ||
            hasParenthetical(line)
        );
    }

    endsWithPunctuation(line) {
        return /[.!?]$/.test(line.trim());
    }

    shouldSkipLine(line) {
        const cleaned = cleanText(line);
        // Additional PDF-specific skip rules
        return (!cleaned ||
            /^[-—_\s*]*$/.test(cleaned) ||
            /^\d+\.$/.test(cleaned) || // Page numbers
            /^\([Cc]ontinued\)$/.test(cleaned) // Continuation markers
        );
    }
}