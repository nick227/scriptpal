import { UI_ELEMENTS } from '../../constants.js';
import { StateManager } from '../../core/StateManager.js';
import { BaseWidget } from '../BaseWidget.js';
import { createMediaListAdapter } from './MediaListAdapter.js';
import { MediaListController } from './MediaListController.js';
import { MediaListModel } from './MediaListModel.js';
import { MediaListView } from './MediaListView.js';

/**
 * MediaBrowserWidget - Manages the media panel in the side panel
 * Uses MediaPickerWidget for adding new media from the unified library
 * Supports images and will support other media types in the future
 */
export class MediaBrowserWidget extends BaseWidget {
    constructor () {
        super();
        this.containerSelector = UI_ELEMENTS.USER_MEDIA_PANEL;
        this.itemsKey = StateManager.KEYS.MEDIA;
        this.container = null;
        this.listAdapter = null;
        this.listModel = null;
        this.listView = null;
        this.listController = null;
        this.mediaPicker = null;
        this.mediaViewerModal = null;
    }

    setStore (store) {
        this.listAdapter = createMediaListAdapter(store);
        this.listModel = new MediaListModel({
            adapter: this.listAdapter,
            getContextId: this.getCurrentScriptId.bind(this)
        });
    }

    setMediaPicker (mediaPicker) {
        this.mediaPicker = mediaPicker;
    }

    async initialize () {
        await super.initialize();
        this.container = document.querySelector(this.containerSelector);
        if (!this.container) {
            throw new Error('Media browser container element not found');
        }
        if (!this.listAdapter) {
            throw new Error('Media adapter must be set before initialize');
        }

        this.listView = new MediaListView({
            container: this.container,
            adapter: this.listAdapter
        });
        this.listController = new MediaListController({
            model: this.listModel,
            view: this.listView,
            onOpenMedia: this.openMediaPicker.bind(this),
            onViewMedia: this.viewMedia.bind(this)
        });
        this.listController.initialize();
        this.createMediaViewerModal();
        this.setupStateSubscriptions();
    }

    setupStateSubscriptions () {
        this.subscribeToState(this.itemsKey, this.handleItemsUpdate.bind(this));
        this.handleItemsUpdate(this.stateManager.getState(this.itemsKey));
    }

    handleItemsUpdate (items) {
        if (!this.listController) return;
        this.listController.setItems(Array.isArray(items) ? items : []);
    }

    openMediaPicker () {
        const scriptId = this.getCurrentScriptId();
        if (!scriptId || !this.mediaPicker) return;
        this.mediaPicker.open({
            ownerType: 'script',
            ownerId: scriptId,
            role: 'gallery'
        });
    }

    viewMedia (itemId) {
        const item = this.listModel.getItemById(itemId);
        if (!item || !item.url) return;
        this.showMediaViewer(item.url, item.title, item.type);
    }

    createMediaViewerModal () {
        this.mediaViewerModal = document.createElement('div');
        this.mediaViewerModal.className = 'media-viewer-modal hidden';
        this.mediaViewerModal.innerHTML = `
            <div class="media-viewer-modal__backdrop"></div>
            <div class="media-viewer-modal__content">
                <div class="media-viewer-modal__media"></div>
                <button type="button" class="media-viewer-modal__close">Close</button>
            </div>
        `;
        document.body.appendChild(this.mediaViewerModal);

        const backdrop = this.mediaViewerModal.querySelector('.media-viewer-modal__backdrop');
        const closeBtn = this.mediaViewerModal.querySelector('.media-viewer-modal__close');
        backdrop.addEventListener('click', () => this.hideMediaViewer());
        closeBtn.addEventListener('click', () => this.hideMediaViewer());
    }

    showMediaViewer (url, title, type = 'image') {
        if (!this.mediaViewerModal) return;
        const mediaContainer = this.mediaViewerModal.querySelector('.media-viewer-modal__media');
        mediaContainer.innerHTML = '';

        if (type === 'image' || type.startsWith('image')) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = title || 'Media';
            img.className = 'media-viewer-modal__img';
            mediaContainer.appendChild(img);
        } else if (type === 'video' || type.startsWith('video')) {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.autoplay = true;
            video.className = 'media-viewer-modal__video';
            mediaContainer.appendChild(video);
        } else {
            mediaContainer.textContent = 'Preview not available';
        }

        this.mediaViewerModal.classList.remove('hidden');
    }

    hideMediaViewer () {
        if (!this.mediaViewerModal) return;
        this.mediaViewerModal.classList.add('hidden');
        const mediaContainer = this.mediaViewerModal.querySelector('.media-viewer-modal__media');
        mediaContainer.innerHTML = '';
    }

    getCurrentScriptId () {
        const script = this.stateManager.getState(StateManager.KEYS.CURRENT_SCRIPT);
        return script ? script.id : null;
    }

    destroy () {
        if (this.mediaViewerModal && this.mediaViewerModal.parentNode) {
            this.mediaViewerModal.parentNode.removeChild(this.mediaViewerModal);
        }
        super.destroy();
    }
}
