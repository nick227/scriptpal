import { FORMAT_FLOW, VALID_FORMAT_VALUES } from '../../../constants/formats.js';

/**
 * Editor Format Flow Manager - now uses centralized format constants
 */
export class EditorFormatFlowManager {
    /**
     * Constructor - uses centralized format flow
     */
    constructor () {
        // Use centralized format flow from constants
        this.FORMAT_FLOW = FORMAT_FLOW;
        this.FORMAT_CYCLE = VALID_FORMAT_VALUES;
    }

    /**
     *
     * @param currentFormat
     */
    getNextFormat (currentFormat) {
        return this.FORMAT_FLOW[currentFormat] || 'action';
    }

    /**
     *
     * @param currentFormat
     */
    cycleFormatUp (currentFormat) {
        const currentIndex = this.FORMAT_CYCLE.indexOf(currentFormat);
        if (currentIndex === -1) return 'action';
        const nextIndex = (currentIndex + 1) % this.FORMAT_CYCLE.length;
        return this.FORMAT_CYCLE[nextIndex];
    }

    /**
     *
     * @param currentFormat
     */
    cycleFormatDown (currentFormat) {
        const currentIndex = this.FORMAT_CYCLE.indexOf(currentFormat);
        if (currentIndex === -1) return 'action';
        const prevIndex = (currentIndex - 1 + this.FORMAT_CYCLE.length) % this.FORMAT_CYCLE.length;
        return this.FORMAT_CYCLE[prevIndex];
    }

    /**
     *
     * @param currentFormat
     * @param direction
     */
    cycleFormat (currentFormat, direction = 'up') {
        return direction === 'up' ?
            this.cycleFormatUp(currentFormat) :
            this.cycleFormatDown(currentFormat);
    }

    /**
     *
     * @param format
     */
    isValidFormat (format) {
        return this.FORMAT_CYCLE.includes(format);
    }
}
