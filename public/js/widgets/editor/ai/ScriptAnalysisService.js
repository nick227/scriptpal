import { debugLog } from '../../../core/logger.js';

/**
 * ScriptAnalysisService
 * Deterministic, read-only analysis of script content.
 * Separated from AICommandManager to isolate analysis logic from editor mutations.
 */
export class ScriptAnalysisService {
    /**
     * @param {object} stateManager - Access to script metadata
     */
    constructor (stateManager) {
        this.stateManager = stateManager;
        this.content = null;
        this._analysisCache = new Map();
    }

    /**
     * @param {object} content - The editor content object
     */
    setContent (content) {
        this.content = content;
    }

    /**
     * Clear the analysis cache (usually called after mutations)
     */
    clearCache () {
        this._analysisCache.clear();
        debugLog('[ScriptAnalysisService] Analysis cache cleared');
    }

    /**
     * Analyze script statistics (Main entry point)
     * @param {string} rawContent - Optional raw content string
     * @returns {object} - Broad analysis object
     */
    analyzeStats (rawContent) {
        const normalized = this.getContentForAnalysis(rawContent);
        const cached = this._analysisCache.get(normalized);
        if (cached) return cached;

        // 1. Compute basic facts (counts, characters, line-types)
        const stats = this._computeStats(normalized);
        const structure = this._computeStructure(normalized);
        
        // 2. Build the analysis response envelope
        const result = this._buildAnalysisEnvelope(stats, structure);

        this._analysisCache.set(normalized, result);
        return result;
    }

    /**
     * Analyze script structure
     * @param {string} rawContent
     */
    analyzeStructure (rawContent) {
        const normalized = this.normalizeContent(rawContent || this.getContentForAnalysis());
        return {
            lineCount: normalized.split('\n').length,
            paragraphCount: normalized.split('\n\n').length,
            chapterCount: this.content?.getChapterCount ? this.content.getChapterCount() : 0
        };
    }

    /**
     * Analyze script format distribution
     */
    analyzeFormat () {
        const formats = new Map();
        const lines = this.content?.getLines ? this.content.getLines() : [];

        if (lines.length === 0) return {};

        lines.forEach(line => {
            const format = line?.format || 'action';
            formats.set(format, (formats.get(format) || 0) + 1);
        });

        return Object.fromEntries(formats);
    }

    /**
     * Compute raw metrics and basic counts
     * @private
     */
    _computeStats (normalized) {
        const words = normalized.split(/\s+/).filter(word => word.length > 0);
        const totalLines = this.content?.getLineCount ? this.content.getLineCount() : normalized.split('\n').length;
        const totalWords = this.content?.getWordCount ? this.content.getWordCount() : words.length;
        const totalCharacters = this.content?.getCharacterCount ? this.content.getCharacterCount() : normalized.length;

        return {
            totalLines,
            totalWords,
            totalCharacters,
            averageWordsPerLine: totalWords / Math.max(totalLines, 1)
        };
    }

    /**
     * Compute script structure and character data
     * @private
     */
    _computeStructure (normalized) {
        const lines = normalized.split('\n');
        const structureCounts = {
            actionLines: 0,
            dialogueLines: 0,
            characterLines: 0,
            parentheticalLines: 0
        };

        const characters = new Map();
        let inDialogueBlock = false;
        let currentCharacter = null;

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                inDialogueBlock = false;
                currentCharacter = null;
                return;
            }

            if (/^\(.+\)$/.test(trimmed)) {
                structureCounts.parentheticalLines += 1;
                return;
            }

            if (/^(INT\.|EXT\.)/.test(trimmed)) {
                structureCounts.actionLines += 1;
                inDialogueBlock = false;
                currentCharacter = null;
                return;
            }

            if (trimmed === trimmed.toUpperCase() && trimmed.length <= 30) {
                structureCounts.characterLines += 1;
                inDialogueBlock = true;
                currentCharacter = trimmed;
                if (!characters.has(trimmed)) {
                    characters.set(trimmed, { lines: 0, words: 0 });
                }
                return;
            }

            if (inDialogueBlock && currentCharacter) {
                structureCounts.dialogueLines += 1;
                const entry = characters.get(currentCharacter);
                entry.lines += 1;
                entry.words += trimmed.split(/\s+/).filter(word => word.length > 0).length;
                return;
            }

            structureCounts.actionLines += 1;
        });

        const sceneCount = lines.filter(line => /^(INT\.|EXT\.)/.test(line.trim())).length;

        return {
            counts: structureCounts,
            characters,
            sceneCount
        };
    }

    /**
     * Build the final analysis response object from computed components
     * @private
     */
    _buildAnalysisEnvelope (stats, structure) {
        const { counts, characters, sceneCount } = structure;
        const dialogueWordCount = Array.from(characters.values()).reduce((total, entry) => total + entry.words, 0);
        const dialoguePercentage = stats.totalLines > 0
            ? Math.round((counts.dialogueLines / stats.totalLines) * 100)
            : 0;

        const state = this.stateManager?.getState ? this.stateManager.getState() : null;
        const context = {
            title: state?.title || '',
            author: state?.author || '',
            status: state?.status || ''
        };

        return {
            structure: counts,
            characters: {
                count: characters.size,
                list: Array.from(characters.keys()),
                dialogueDistribution: Object.fromEntries(
                    Array.from(characters.entries()).map(([name, data]) => [name, data.words])
                ),
                development: 'unknown',
                voiceConsistency: 'unknown',
                dialogueQuality: 'unknown'
            },
            scenes: {
                count: sceneCount,
                locations: [],
                transitions: []
            },
            dialogue: {
                totalWords: dialogueWordCount,
                averageWordsPerLine: dialogueWordCount / Math.max(counts.dialogueLines, 1),
                characterVoice: Object.fromEntries(
                    Array.from(characters.entries()).map(([name, data]) => [name, data.lines])
                )
            },
            format: {
                actionLines: counts.actionLines,
                actionEffectiveness: 'unknown',
                visualElements: [],
                compliance: 'unknown',
                suggestions: [],
                errors: []
            },
            insights: ['Script analysis completed with baseline metrics.'],
            strengths: [],
            weaknesses: [],
            recommendations: [
                {
                    type: 'structure',
                    description: 'Review scene pacing and dialogue balance.',
                    priority: 'medium'
                }
            ],
            metrics: {
                ...stats,
                dialoguePercentage
            },
            pacing: {
                overall: 'unknown',
                sceneTransitions: 'unknown',
                dialogueFlow: 'unknown'
            },
            genre: {
                type: 'unknown',
                conventions: [],
                compliance: 'unknown'
            },
            feedback: {
                overall: 'Analysis generated.',
                specific: [],
                actionable: []
            },
            improvements: [],
            context,
            complexity: {
                level: stats.totalLines > 200 ? 'high' : 'medium',
                factors: [],
                recommendations: []
            },
            status: {
                current: context.status || 'draft',
                suggestions: [],
                nextSteps: []
            },
            aiData: {
                summary: 'Script analysis summary.',
                keyPoints: [],
                context
            },
            aiResponse: {
                format: 'structured',
                tone: 'constructive',
                structure: 'sections'
            }
        };
    }

    normalizeContent (content) {
        return typeof content === 'string' ? content : '';
    }

    getContentForAnalysis (content) {
        if (typeof content === 'string') {
            return content;
        }

        if (this.content?.getPlainText) {
            return this.content.getPlainText() || '';
        }

        return '';
    }
}
