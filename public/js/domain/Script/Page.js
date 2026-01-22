/**
 * Page - Domain model for a script page
 * Single responsibility: Represent a page of script content
 */
export class Page {
    /**
     *
     * @param id
     * @param content
     * @param format
     */
    constructor (id, content = '', format = 'action') {
        this.id = id;
        this.content = content;
        this.format = format;
        this.lineCount = 0;
        this.wordCount = 0;
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
    }

    /**
     * Update page content
     * @param content
     */
    updateContent (content) {
        this.content = content;
        this.updatedAt = Date.now();
        this.calculateStats();
    }

    /**
     * Calculate page statistics
     */
    calculateStats () {
        this.lineCount = this.content.split('\n').length;
        this.wordCount = this.content.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Get page as plain text
     */
    getText () {
        return this.content;
    }

    /**
     * Check if page is empty
     */
    isEmpty () {
        return !this.content.trim();
    }
}
