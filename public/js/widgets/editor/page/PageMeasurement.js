export class PageMeasurement {
    constructor() {
        // Cache line heights
        this.heightCache = new WeakMap();
        // Cache computed styles that affect height
        this.styleCache = new WeakMap();
        // Track when we need to invalidate cache
        this.lastWindowResize = Date.now();
        this.setupResizeListener();
    }

    setupResizeListener() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.lastWindowResize = Date.now();
                this.heightCache = new WeakMap();
                this.styleCache = new WeakMap();
            }, 100);
        });
    }

    getLineHeight(line) {
        // Check cache first
        const cachedHeight = this.heightCache.get(line);
        if (cachedHeight && this.styleCache.get(line).timestamp > this.lastWindowResize) {
            return cachedHeight;
        }

        // Calculate height including margins
        const computedStyle = getComputedStyle(line);
        const lineRect = line.getBoundingClientRect();
        const marginTop = parseFloat(computedStyle.marginTop);
        const marginBottom = parseFloat(computedStyle.marginBottom);
        const height = lineRect.height + marginTop + marginBottom;

        // Cache the result with timestamp
        this.heightCache.set(line, height);
        this.styleCache.set(line, {
            timestamp: Date.now(),
            marginTop,
            marginBottom
        });

        return height;
    }

    getCachedStyle(line) {
        return this.styleCache.get(line);
    }

    // Batch measure multiple lines
    batchMeasureLines(lines) {
        let totalHeight = 0;
        let measurements = [];

        // Force a single reflow by reading all heights first
        const heightMeasurements = lines.map(line => ({
            line,
            rect: line.getBoundingClientRect()
        }));

        // Then process all measurements
        heightMeasurements.forEach(({ line, rect }) => {
            const style = this.getCachedStyle(line) || {
                marginTop: parseFloat(getComputedStyle(line).marginTop),
                marginBottom: parseFloat(getComputedStyle(line).marginBottom)
            };

            const height = rect.height + style.marginTop + style.marginBottom;
            totalHeight += height;
            measurements.push({ line, height });

            // Update caches
            this.heightCache.set(line, height);
            this.styleCache.set(line, {...style, timestamp: Date.now() });
        });

        return {
            totalHeight,
            measurements
        };
    }

    // Estimate height for new lines based on format
    estimateLineHeight(format) {
        // Base heights for different formats
        const baseHeights = {
            'format-header': 24,
            'format-action': 20,
            'format-speaker': 20,
            'format-dialog': 20,
            'format-directions': 20,
            'default': 20,
            'format-chapter-break': 20
        };

        return baseHeights[format] || baseHeights.default;
    }

    invalidateCache() {
        this.heightCache = new WeakMap();
        this.styleCache = new WeakMap();
        this.lastWindowResize = Date.now();
    }
}