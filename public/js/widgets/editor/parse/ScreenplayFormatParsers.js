import { ScreenplayParser } from './ScreenplayParser.js';

// Parser for standard screenplay format
export class StandardFormatParser extends ScreenplayParser {
    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';
        let inDialogBlock = false;

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i];
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (this.shouldSkipLine(line)) continue;

            const cleanedLine = this.cleanText(line);
            let format = null;

            if (this.isSceneHeader(cleanedLine)) {
                format = 'header';
                inDialogBlock = false;
            } else if (this.isSpeaker(cleanedLine, previousLine, nextLine)) {
                format = 'speaker';
                inDialogBlock = true;
            } else if (inDialogBlock && this.isDialog(cleanedLine, previousLine)) {
                format = 'dialog';
            } else if (this.hasParenthetical(cleanedLine)) {
                format = 'directions';
                inDialogBlock = inDialogBlock && this.isDialog(nextLine, cleanedLine);
            } else if (this.isDirection(cleanedLine, previousLine, nextLine)) {
                format = 'directions';
                inDialogBlock = false;
            } else if (this.isChapterBreak(cleanedLine)) {
                format = 'chapter-break';
                inDialogBlock = false;
            }

            if (format) {
                this.addLine(cleanedLine, format);
            }
            previousLine = cleanedLine;
        }

        return this.getParseResult();
    }
}

// Parser for PDF-extracted format with special handling for page breaks and formatting
export class PDFFormatParser extends ScreenplayParser {
    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';
        let skipNext = false;
        let currentBlock = this.createBlock();
        let inDialogBlock = false;

        for (let i = 0; i < rawLines.length; i++) {
            if (skipNext) {
                skipNext = false;
                continue;
            }

            const line = rawLines[i];
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (this.shouldSkipLine(line)) continue;

            if (this.isSceneHeader(line)) {
                currentBlock = this.commitBlock(currentBlock);
                currentBlock.format = 'header';
                currentBlock.text = line;
                inDialogBlock = false;

                if (nextLine && !this.isSceneHeader(nextLine) &&
                    !this.isSpeaker(nextLine) &&
                    !this.patterns.formatting.pageNumber.test(nextLine)) {
                    this.appendToBlock(currentBlock, nextLine);
                    skipNext = true;
                }
                currentBlock = this.commitBlock(currentBlock);
            } else if (this.isSpeaker(line, previousLine, nextLine)) {
                currentBlock = this.commitBlock(currentBlock);
                this.addLine(line, 'speaker');
                inDialogBlock = true;
            } else if (inDialogBlock) {
                if (this.hasParenthetical(line)) {
                    currentBlock = this.commitBlock(currentBlock);
                    this.addLine(line, 'directions');
                } else if (this.isDialog(line, previousLine)) {
                    if (currentBlock.format === 'dialog') {
                        this.appendToBlock(currentBlock, line);
                    } else {
                        currentBlock = this.commitBlock(currentBlock);
                        currentBlock.format = 'dialog';
                        currentBlock.text = line;
                    }
                } else {
                    currentBlock = this.commitBlock(currentBlock);
                    inDialogBlock = false;
                    if (this.isDirection(line, previousLine, nextLine)) {
                        currentBlock.format = 'directions';
                        currentBlock.text = line;
                    }
                }
            } else if (this.isDirection(line, previousLine, nextLine)) {
                if (currentBlock.format === 'directions') {
                    this.appendToBlock(currentBlock, line);
                } else {
                    currentBlock = this.commitBlock(currentBlock);
                    currentBlock.format = 'directions';
                    currentBlock.text = line;
                }
            } else if (this.isChapterBreak(line)) {
                currentBlock = this.commitBlock(currentBlock);
                currentBlock.format = 'chapter-break';
                currentBlock.text = line;
                inDialogBlock = false;
            }

            previousLine = line;
        }

        this.commitBlock(currentBlock);
        return this.getParseResult();
    }
}

// Parser for plain text format with more lenient parsing rules
export class PlainTextFormatParser extends ScreenplayParser {
    parse() {
        const rawLines = this.splitIntoLines();
        let previousLine = '';
        let nextLine = '';
        let inDialogBlock = false;
        let currentBlock = this.createBlock();
        let consecutiveBlankLines = 0;

        for (let i = 0; i < rawLines.length; i++) {
            const line = rawLines[i].trim();
            nextLine = i < rawLines.length - 1 ? rawLines[i + 1] : '';

            if (!line) {
                consecutiveBlankLines++;
                if (consecutiveBlankLines > 1) {
                    currentBlock = this.commitBlock(currentBlock);
                    inDialogBlock = false;
                }
                continue;
            }
            consecutiveBlankLines = 0;

            if (this.isSceneHeader(line)) {
                currentBlock = this.commitBlock(currentBlock);
                this.addLine(line, 'header');
                inDialogBlock = false;
            } else if (this.isSpeaker(line, previousLine, nextLine)) {
                currentBlock = this.commitBlock(currentBlock);
                this.addLine(line, 'speaker');
                inDialogBlock = true;
            } else if (inDialogBlock) {
                if (this.hasParenthetical(line)) {
                    currentBlock = this.commitBlock(currentBlock);
                    this.addLine(line, 'directions');
                } else if (this.isDialog(line, previousLine)) {
                    if (currentBlock.format === 'dialog') {
                        this.appendToBlock(currentBlock, line);
                    } else {
                        currentBlock = this.commitBlock(currentBlock);
                        currentBlock.format = 'dialog';
                        currentBlock.text = line;
                    }
                } else {
                    currentBlock = this.commitBlock(currentBlock);
                    inDialogBlock = false;
                }
            } else if (this.isDirection(line, previousLine, nextLine)) {
                if (currentBlock.format === 'directions' && !consecutiveBlankLines) {
                    this.appendToBlock(currentBlock, line);
                } else {
                    currentBlock = this.commitBlock(currentBlock);
                    currentBlock.format = 'directions';
                    currentBlock.text = line;
                }
            } else if (this.isChapterBreak(line)) {
                currentBlock = this.commitBlock(currentBlock);
                currentBlock.format = 'chapter-break';
                currentBlock.text = line;
                inDialogBlock = false;
            }

            previousLine = line;
        }

        this.commitBlock(currentBlock);
        return this.getParseResult();
    }
}