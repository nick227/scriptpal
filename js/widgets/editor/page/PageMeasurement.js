export class PageMeasurement {
    constructor() {
        this.lineHeightCache = new WeakMap();
        this.pageHeightCache = new WeakMap();
        this._measurementTimeout = null;
    }

    getLineHeight(line) {
        if (!line) return 0;

        let height = this.lineHeightCache.get(line);
        if (height === undefined) {
            height = line.offsetHeight;
            this.lineHeightCache.set(line, height);
        }
        return height;
    }

    getPageHeight(page) {
        if (!page) return 0;

        let height = this.pageHeightCache.get(page);
        if (height === undefined) {
            height = page.offsetHeight;
            this.pageHeightCache.set(page, height);
        }
        return height;
    }

    invalidateLineCache(line) {
        if (line) {
            this.lineHeightCache.delete(line);
        }
    }

    invalidatePageCache(page) {
        if (page) {
            this.pageHeightCache.delete(page);
        }
    }

    clearCaches() {
        this.lineHeightCache = new WeakMap();
        this.pageHeightCache = new WeakMap();
    }

    batchMeasure(elements, callback) {
        if (this._measurementTimeout) {
            clearTimeout(this._measurementTimeout);
        }

        this._measurementTimeout = setTimeout(() => {
            // Force reflow to get accurate measurements
            elements.forEach(element => element.offsetHeight);

            if (callback) {
                callback();
            }

            this._measurementTimeout = null;
        }, 0);
    }

    destroy() {
        if (this._measurementTimeout) {
            clearTimeout(this._measurementTimeout);
        }
        this.clearCaches();
    }
}