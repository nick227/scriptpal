import { BaseWidget } from '../BaseWidget.js';
import { formatTypes } from './constants.js';
import { StandardFormatParser } from './parse/StandardFormatParser.js';
import { PDFFormatParser } from './parse/PDFFormatParser.js';
import { PlainTextFormatParser } from './parse/PlainTextFormatParser.js';
import { evaluateScreenplayParse } from './parse/ScreenplayEvaluator.js';

export class ScriptImportManager extends BaseWidget {
    constructor(container, pageManager, editorContent) {
        super();
        this.validateConstructorParams(container, pageManager, editorContent);

        this.container = container;
        this.pageManager = pageManager;
        this.editorContent = editorContent;
        this.formatTypes = formatTypes;
        this.parsers = this.initializeParsers();

        // Format mapping for imported content
        this.formatMapping = {
            'directions': 'action', // Map directions to action
            'direction': 'action', // Some parsers might use singular
            'parenthetical': 'parenthetical',
            'dialog': 'dialog',
            'dialogue': 'dialog', // Handle alternate spelling
            'speaker': 'speaker',
            'character': 'speaker', // Some formats use character
            'header': 'header',
            'scene': 'header', // Some formats use scene
            'transition': 'transition',
            'action': 'action',
            'chapter-break': 'chapter-break'
        };

        this.handleImport = this.handleImport.bind(this);
    }

    validateConstructorParams(container, pageManager, editorContent) {
        if (!container) {
            throw new Error('Container is required for ScriptImportManager');
        }
        if (!pageManager) {
            throw new Error('PageManager instance is required for ScriptImportManager');
        }
        if (!editorContent) {
            throw new Error('EditorContent instance is required for ScriptImportManager');
        }
    }

    initializeParsers() {
        return [StandardFormatParser, PDFFormatParser, PlainTextFormatParser];
    }

    async findBestParser(text) {
        const results = await Promise.all(
            this.parsers.map(async Parser => {
                const parser = new Parser(text);
                const result = parser.parse();
                const score = evaluateScreenplayParse(result.lines);
                return { result, score, parser: Parser.name };
            })
        );

        return results.reduce((best, current) => {
            return current.score > best.score ? current : best;
        }, { score: 0, result: null, parser: null });
    }

    createFormattedLine(text, format) {
        // Map the format to an accepted format type
        const mappedFormat = this.formatMapping[format.toLowerCase()] || 'action'; // Default to action if no mapping

        const line = document.createElement('div');
        line.className = `script-line format-${mappedFormat}`;
        line.contentEditable = 'true';
        line.textContent = text;

        // Add keydown handler from EditorContent
        line.addEventListener('keydown', this.editorContent._boundHandlers.keydown);

        return line;
    }

    updateProgress(output, message) {
        if (output && typeof output.textContent !== 'undefined') {
            output.textContent = message;
        }
    }

    async processLines(lines, output) {
        const total = lines.length;
        let count = 0;
        const debugMsg = [];

        try {
            for (const line of lines) {
                count++;
                this.updateProgress(output, `Processing line ${count} of ${total}... (${line.format})`);

                // Map the format before creating the line
                const mappedFormat = this.formatMapping[line.format.toLowerCase()] || 'action';
                const formattedLine = this.createFormattedLine(line.text, mappedFormat);
                debugMsg.push(formattedLine);

                // Add the line using PageManager
                await this.pageManager.addLine(formattedLine);

                // Update state in EditorContent
                this.editorContent.stateManager.setCurrentLine(formattedLine);
                this.editorContent.stateManager.setCurrentFormat(mappedFormat);

                // Emit line added event
                this.editorContent.emit(this.editorContent.constructor.EVENTS.LINE_ADDED, formattedLine);
            }

            // After all lines are added, trigger content update and change events
            if (this.editorContent.contentManager) {
                // Force immediate content update
                await this.editorContent.contentManager.debouncedContentUpdate();

                // Get the updated content
                const content = this.editorContent.getContent();

                // Emit change events to trigger autosave
                this.editorContent.contentManager.emit('contentChanged', content);
                this.editorContent.emit(this.editorContent.constructor.EVENTS.CHANGE, content);
            }

            console.log('debugMsg:');
            console.log(debugMsg);
            console.log('--------------------------------');

        } catch (error) {
            console.error('Error processing lines:', error);
            throw error;
        }
    }

    async handleImport(text, output = null) {
        if (!text) return;

        try {
            this.updateProgress(output, 'Analyzing script format...');

            const { result, score, parser } = await this.findBestParser(text);

            if (!result) {
                throw new Error('No suitable parser found for the text');
            }

            this.updateProgress(output, `Using ${parser} (score: ${score.toFixed(2)})`);
            await this.processLines(result.lines, output);

            this.updateProgress(output, 'Import complete!');
            return { success: true, parser, score };

        } catch (error) {
            console.error('Error importing script:', error);
            this.updateProgress(output, `Error importing script: ${error.message}`);
            throw error;
        }
    }
}