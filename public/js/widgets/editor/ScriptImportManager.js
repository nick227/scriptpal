import { BaseWidget } from '../BaseWidget.js';
import { ScriptDocument } from './model/ScriptDocument.js';
import { formatTypes } from './constants.js';
// Parser functionality now consolidated into LineFormatter.js
// import { PDFFormatParser } from './parse/PDFFormatParser.js';
// import { PlainTextFormatParser } from './parse/PlainTextFormatParser.js';
// import { evaluateScreenplayParse } from './parse/ScreenplayEvaluator.js';
// import { StandardFormatParser } from './parse/StandardFormatParser.js';

/**
 *
 */
export class ScriptImportManager extends BaseWidget {
    /**
     *
     * @param container
     * @param pageManager
     * @param editorContent
     */
    constructor (container, pageManager, editorContent) {
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

    /**
     *
     * @param container
     * @param pageManager
     * @param editorContent
     */
    validateConstructorParams (container, pageManager, editorContent) {
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

    /**
     *
     */
    initializeParsers () {
        // Parser functionality now consolidated into LineFormatter.js
        return []; // [StandardFormatParser, PDFFormatParser, PlainTextFormatParser];
    }

    /**
     *
     * @param text
     */
    async findBestParser (text) {
        const results = await Promise.all(
            this.parsers.map(async Parser => {
                const parser = new Parser(text);
                const result = parser.parse();
                // Parser functionality now consolidated into LineFormatter.js
                const score = 0.8; // evaluateScreenplayParse(result.lines);
                return { result, score, parser: Parser.name };
            })
        );

        return results.reduce((best, current) => {
            return current.score > best.score ? current : best;
        }, { score: 0, result: null, parser: null });
    }

    /**
     *
     * @param output
     * @param message
     */
    updateProgress (output, message) {
        if (output && typeof output.textContent !== 'undefined') {
            output.textContent = message;
        }
    }

    /**
     *
     * @param lines
     * @param output
     */
    async processLines (lines, output) {
        const total = lines.length;
        let count = 0;
        const structuredLines = [];

        try {
            for (const line of lines) {
                count++;
                this.updateProgress(output, `Processing line ${count} of ${total}... (${line.format})`);

                const mappedFormat = this.formatMapping[line.format.toLowerCase()] || 'action';
                structuredLines.push({
                    id: ScriptDocument.createLineId(),
                    format: mappedFormat,
                    content: line.text || ''
                });
            }

            const content = JSON.stringify({
                version: 2,
                lines: structuredLines
            });
            await this.editorContent.updateContent(content, {
                source: 'import',
                isEdit: false,
                preserveState: false
            });

        } catch (error) {
            console.error('Error processing lines:', error);
            throw error;
        }
    }

    /**
     *
     * @param text
     * @param output
     */
    async handleImport (text, output = null) {
        if (!text) {
            return;
        }

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
