/*
    The page tracker determines the current page based on scroll position
    and updates the .current-page span page counter value.
*/

export class PageTracker {
    constructor() {
        this.currentPageElement = null;
        this.observer = null;
    }

    initialize() {
        this.currentPageElement = document.querySelector('.current-page');
        this.setupIntersectionObserver();
    }

    setupIntersectionObserver() {
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                        const pageNumber = entry.target.dataset.pageNumber;
                        if (pageNumber) {
                            this.currentPageElement.textContent = pageNumber;
                        }
                        break;
                    }
                }
            }, {
                threshold: 0.5 // Trigger when page is 50% visible
            }
        );

        // Observe all existing pages
        document.querySelectorAll('.editor-page').forEach(page => {
            console.log('Observing page', page);
            this.observer.observe(page);
        });
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.currentPageElement = null;
    }
}