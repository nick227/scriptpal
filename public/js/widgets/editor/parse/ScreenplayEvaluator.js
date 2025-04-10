// Scoring weights for different screenplay elements
const SCORE_WEIGHTS = {
    header: 2.0, // Scene headers are strong indicators
    speaker: 1.5, // Character names are good indicators
    dialog: 1.0, // Dialog is common but not as distinctive
    directions: 0.5, // Action/directions are least distinctive
    'chapter-break': 0.5 // Chapter breaks are least distinctive
};

// Minimum thresholds for a valid screenplay
const MIN_THRESHOLDS = {
    totalLines: 10,
    headers: 2,
    speakers: 2,
    dialogs: 4
};

/**
 * Evaluates how well the parsed text matches screenplay format
 * @param {Array} lines Array of parsed lines with format information
 * @returns {number} Score between 0 and 1, where 1 is most likely a screenplay
 */
export function evaluateScreenplayParse(lines) {
    if (!lines || lines.length < MIN_THRESHOLDS.totalLines) {
        return 0;
    }

    const stats = calculateStats(lines);
    const structureScore = evaluateStructure(stats);
    const formatScore = evaluateFormatting(stats, lines.length);
    const consistencyScore = evaluateConsistency(lines);

    // Weighted average of different scoring aspects
    return (
        structureScore * 0.4 +
        formatScore * 0.4 +
        consistencyScore * 0.2
    );
}

function calculateStats(lines) {
    const stats = {
        header: 0,
        speaker: 0,
        dialog: 0,
        directions: 0,
        dialogBlocks: 0, // Complete dialog blocks (speaker + dialog)
        consecutiveDirections: 0,
        maxConsecutiveDirections: 0,
        chapterBreak: 0
    };

    let lastFormat = null;
    let inDialogBlock = false;

    for (const line of lines) {
        stats[line.format]++;

        // Track dialog blocks
        if (line.format === 'speaker') {
            inDialogBlock = true;
        } else if (line.format === 'dialog' && inDialogBlock) {
            stats.dialogBlocks++;
            inDialogBlock = false;
        }

        // Track consecutive directions
        if (line.format === 'directions') {
            stats.consecutiveDirections++;
            stats.maxConsecutiveDirections = Math.max(
                stats.maxConsecutiveDirections,
                stats.consecutiveDirections
            );
        } else {
            stats.consecutiveDirections = 0;
        }

        lastFormat = line.format;
    }

    return stats;
}

function evaluateStructure(stats) {
    // Check if meets minimum thresholds
    if (stats.header < MIN_THRESHOLDS.headers ||
        stats.speaker < MIN_THRESHOLDS.speakers ||
        stats.dialog < MIN_THRESHOLDS.dialogs ||
        stats.chapterBreak < MIN_THRESHOLDS.chapterBreaks) {
        return 0;
    }

    // Evaluate ratio of dialog blocks to speakers
    const dialogBlockRatio = stats.dialogBlocks / stats.speaker;

    // Evaluate distribution of different elements
    const total = Object.values(stats).reduce((sum, val) => sum + val, 0);
    let score = 0;

    for (const [format, weight] of Object.entries(SCORE_WEIGHTS)) {
        const ratio = stats[format] / total;
        score += ratio * weight;
    }

    // Penalize for too many consecutive directions
    if (stats.maxConsecutiveDirections > 5) {
        score *= 0.8;
    }

    return Math.min(1, score * dialogBlockRatio);
}

function evaluateFormatting(stats, totalLines) {
    // Expected ratios for a typical screenplay
    const expectedRatios = {
        header: 0.05, // About 5% scene headers
        speaker: 0.15, // About 15% character names
        dialog: 0.40, // About 40% dialog
        directions: 0.40, // About 40% action/directions,
        'chapter-break': 0.05 // About 5% chapter breaks
    };

    let score = 1;
    for (const [format, expectedRatio] of Object.entries(expectedRatios)) {
        const actualRatio = stats[format] / totalLines;
        const difference = Math.abs(actualRatio - expectedRatio);
        // Reduce score based on how far from expected ratios
        score *= (1 - difference);
    }

    return Math.max(0, score);
}

function evaluateConsistency(lines) {
    let score = 1;
    let lastFormat = null;
    let validTransitions = 0;
    let totalTransitions = 0;

    // Valid format transitions in a screenplay
    const validSequences = new Set([
        'header:directions',
        'header:speaker',
        'directions:speaker',
        'directions:header',
        'speaker:dialog',
        'speaker:directions',
        'dialog:speaker',
        'dialog:directions',
        'dialog:header',
        'chapter-break:header',
        'chapter-break:directions',
        'chapter-break:speaker',
        'chapter-break:dialog',
        'chapter-break:chapter-break'
    ]);

    for (const line of lines) {
        if (lastFormat) {
            totalTransitions++;
            const transition = `${lastFormat}:${line.format}`;
            if (validSequences.has(transition)) {
                validTransitions++;
            }
        }
        lastFormat = line.format;
    }

    return totalTransitions > 0 ? validTransitions / totalTransitions : 0;
}