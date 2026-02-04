/**
 *
 */
export class MediaPickerWidget {
    /**
     *
     * @param options
     */
    constructor (options = {}) {
        if (!options.api) {
            throw new Error('API is required for MediaPickerWidget');
        }
        this.api = options.api;
        this.container = options.container || null;
        this.ownerType = options.ownerType || null;
        this.ownerId = options.ownerId || null;
        this.role = options.role || 'cover';
        this.type = options.type || 'image';
        this.label = options.label || 'Media';
        this.onAttached = options.onAttached || null;
        this.modal = null;
        this.modalOpen = false;
        this.previewUrl = '';
        this.pendingPreviewUrl = '';
        this.pendingAssetId = null;
        this.libraryItems = [];
        this.pollTimer = null;
        this.isGenerating = false;
    }

    /**
     *
     */
    async initialize () {
        if (this.container) {
            this.renderInline();
        }
        this.renderModal();
        await this.refreshPreview();
    }

    /**
     *
     * @param root0
     * @param root0.ownerType
     * @param root0.ownerId
     * @param root0.role
     */
    setOwner ({ ownerType, ownerId, role }) {
        if (ownerType) {
            this.ownerType = ownerType;
        }
        if (ownerId) {
            this.ownerId = ownerId;
        }
        if (role) {
            this.role = role;
        }
    }

    /**
     *
     */
    async refreshPreview () {
        if (!this.ownerType || !this.ownerId) {
            return;
        }
        try {
            const data = await this.api.getOwnerMedia(this.ownerType, this.ownerId, this.role);
            const attachments = data && data.attachments ? data.attachments : [];
            const attachment = attachments.length > 0 ? attachments[0] : null;
            this.previewUrl = this.resolvePreviewUrl(attachment);
            this.updateInlinePreview();
            this.updateModalPreview();
        } catch (error) {
            console.warn('[MediaPickerWidget] Failed to load preview:', error);
        }
    }

    /**
     *
     */
    renderInline () {
        this.container.innerHTML = `
            <div class="media-picker-inline">
                <div class="media-picker-preview">
                    <img class="media-picker-preview__img" alt="Media preview" />
                    <div class="media-picker-preview__placeholder">No image</div>
                </div>
                <button type="button" class="media-picker-trigger">${this.label}</button>
            </div>
        `;
        const trigger = this.container.querySelector('.media-picker-trigger');
        trigger.addEventListener('click', () => this.open());
    }

    /**
     *
     */
    renderModal () {
        this.modal = document.createElement('div');
        this.modal.className = 'media-picker-modal hidden';
        this.modal.innerHTML = `
            <div class="media-picker-backdrop"></div>
            <div class="media-picker-panel">
                <header class="media-picker-header">
                    <h3>${this.label}</h3>
                </header>
                <div class="media-picker-preview">
                    <img class="media-picker-preview__img" alt="Media preview" />
                    <div class="media-picker-preview__placeholder">No image selected</div>
                </div>
                <div class="media-picker-status" aria-live="polite"></div>
                <div class="media-picker-section">
                    <h4>Upload</h4>
                    <input type="file" class="media-picker-file" accept="image/*" />
                    <button type="button" class="media-picker-upload">Upload</button>
                </div>
                <div class="media-picker-section">
                    <h4>Generate</h4>
                    <input type="text" class="media-picker-prompt" placeholder="Describe the image" />
                    <button type="button" class="media-picker-generate">Generate</button>
                </div>
                <div class="media-picker-section hidden">
                    <h4>Library</h4>
                    <div class="media-picker-grid"></div>
                </div>
                <div class="media-picker-actions">
                    <button type="button" class="media-picker-cancel">Cancel</button>
                    <button type="button" class="media-picker-save" disabled>Save</button>
                </div>
            </div>
        `;
        document.body.appendChild(this.modal);

        const backdrop = this.modal.querySelector('.media-picker-backdrop');
        const cancelButton = this.modal.querySelector('.media-picker-cancel');
        cancelButton.addEventListener('click', () => this.close());
        backdrop.addEventListener('click', () => this.close());

        const uploadButton = this.modal.querySelector('.media-picker-upload');
        uploadButton.addEventListener('click', () => this.handleUpload());

        const generateButton = this.modal.querySelector('.media-picker-generate');
        generateButton.addEventListener('click', () => this.handleGenerate());

        const saveButton = this.modal.querySelector('.media-picker-save');
        saveButton.addEventListener('click', () => this.commitPendingSelection());
    }

    /**
     *
     * @param options
     */
    async open (options = {}) {
        if (options.ownerType || options.ownerId || options.role) {
            this.setOwner(options);
        }
        if (!this.ownerType || !this.ownerId) {
            return;
        }
        this.modal.classList.remove('hidden');
        this.modalOpen = true;
        this.pendingAssetId = null;
        this.pendingPreviewUrl = '';
        this.setStatus('');
        this.setGenerating(false);
        this.updateModalPreview();
        await this.loadLibrary();
        await this.refreshPreview();
    }

    /**
     *
     */
    close () {
        if (!this.modal) {
            return;
        }
        this.modal.classList.add('hidden');
        this.modalOpen = false;
    }

    /**
     *
     */
    async loadLibrary () {
        try {
            const result = await this.api.listMedia({ type: this.type, page: 1, pageSize: 24 });
            this.libraryItems = result && result.assets ? result.assets : [];
            this.renderLibrary();
        } catch (error) {
            console.warn('[MediaPickerWidget] Failed to load library:', error);
        }
    }

    /**
     *
     */
    renderLibrary () {
        const grid = this.modal.querySelector('.media-picker-grid');

        grid.innerHTML = '';
        if (!this.libraryItems || this.libraryItems.length === 0) {
            grid.textContent = 'No media yet';
            return;
        }
        const parent = grid.closest('.media-picker-section');
        parent.classList.remove('hidden');
        this.libraryItems.forEach(item => {
            const card = document.createElement('div');
            card.className = 'media-picker-card';
            card.innerHTML = `
                <div class="media-picker-card__thumb">${this.renderCardThumb(item)}</div>
            `;
            card.addEventListener('click', () => this.selectPendingAsset(item));
            grid.appendChild(card);
        });
    }

    /**
     *
     * @param item
     */
    renderCardThumb (item) {
        const url = this.getAssetPreviewUrl(item);
        return url ? `<img src="${url}" alt="" />` : '';
    }

    /**
     *
     * @param asset
     */
    getAssetPreviewUrl (asset) {
        if (!asset) {
            return '';
        }
        const variants = asset.variants || [];
        const preferred = variants.find(variant => variant.kind === 'preview') || variants[0];
        const key = preferred ? preferred.storageKey : asset.storageKey;
        if (!key) {
            return '';
        }
        const origin = this.api.baseUrl ? this.api.baseUrl.replace(/\/api$/, '') : '';
        return `${origin}${this.buildPublicPath(key)}`;
    }

    /**
     *
     * @param key
     */
    buildPublicPath (key) {
        if (!key) return '';
        return `/uploads/${key}`;
    }

    /**
     *
     * @param attachment
     */
    resolvePreviewUrl (attachment) {
        if (!attachment || !attachment.asset) {
            return '';
        }
        return this.getAssetPreviewUrl(attachment.asset);
    }

    /**
     *
     */
    updateInlinePreview () {
        if (!this.container) {
            return;
        }
        const img = this.container.querySelector('.media-picker-preview__img');
        const placeholder = this.container.querySelector('.media-picker-preview__placeholder');
        if (this.previewUrl) {
            img.src = this.previewUrl;
            img.classList.add('is-visible');
            placeholder.classList.add('hidden');
        } else {
            img.removeAttribute('src');
            img.classList.remove('is-visible');
            placeholder.classList.remove('hidden');
        }
    }

    /**
     *
     */
    updateModalPreview () {
        if (!this.modal) {
            return;
        }
        const img = this.modal.querySelector('.media-picker-preview__img');
        const placeholder = this.modal.querySelector('.media-picker-preview__placeholder');
        const saveButton = this.modal.querySelector('.media-picker-save');
        const preview = this.pendingPreviewUrl || this.previewUrl;
        if (preview) {
            img.src = preview;
            img.classList.add('is-visible');
            placeholder.classList.add('hidden');
        } else {
            img.removeAttribute('src');
            img.classList.remove('is-visible');
            placeholder.classList.remove('hidden');
        }
        if (saveButton) {
            saveButton.disabled = !this.pendingAssetId;
        }
    }

    /**
     *
     * @param asset
     */
    selectPendingAsset (asset) {
        if (!asset || !asset.id) {
            return;
        }
        this.pendingAssetId = asset.id;
        this.pendingPreviewUrl = this.getAssetPreviewUrl(asset);
        this.updateModalPreview();
    }

    /**
     *
     */
    async handleUpload () {
        const fileInput = this.modal.querySelector('.media-picker-file');
        const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!file) {
            return;
        }
        try {
            const result = await this.api.uploadMedia(file, this.type);
            if (result && result.asset) {
                this.selectPendingAsset(result.asset);
                await this.loadLibrary();
            }
        } catch (error) {
            console.warn('[MediaPickerWidget] Upload failed:', error);
        }
    }

    /**
     *
     */
    async handleGenerate () {
        const input = this.modal.querySelector('.media-picker-prompt');
        const prompt = input && input.value ? input.value.trim() : '';
        if (!prompt) {
            return;
        }
        try {
            this.setGenerating(true);
            this.setStatus('Generating image...');
            const job = await this.api.generateMedia({ type: 'image', prompt });
            if (job && job.id) {
                this.setStatus('Request sent. Generating...');
                await this.pollJob(job.id);
            }
        } catch (error) {
            console.warn('[MediaPickerWidget] Generate failed:', error);
            this.setStatus('Generation failed.');
            this.setGenerating(false);
        }
    }

    /**
     *
     * @param jobId
     */
    async pollJob (jobId) {
        if (!jobId) {
            return;
        }
        let attempts = 0;
        const maxAttempts = 20;
        const poll = async () => {
            attempts += 1;
            try {
                const job = await this.api.getMediaJob(jobId);
                if (job && job.status === 'succeeded' && job.resultAssetId) {
                    const asset = await this.findAssetById(job.resultAssetId);
                    if (asset) {
                        this.selectPendingAsset(asset);
                    } else {
                        this.pendingAssetId = job.resultAssetId;
                        this.pendingPreviewUrl = '';
                        this.updateModalPreview();
                    }
                    await this.loadLibrary();
                    this.setStatus('Image ready. Click Save.');
                    this.setGenerating(false);
                    return;
                }
                if (job && job.status === 'failed') {
                    this.setStatus(job.error || 'Generation failed.');
                    this.setGenerating(false);
                    return;
                }
            } catch (error) {
                console.warn('[MediaPickerWidget] Job polling failed:', error);
            }
            if (attempts < maxAttempts) {
                this.pollTimer = setTimeout(poll, 1500);
                return;
            }
            this.setStatus('Generation timed out.');
            this.setGenerating(false);
        };
        poll();
    }

    /**
     *
     * @param assetId
     */
    async attachAsset (assetId) {
        if (!assetId || !this.ownerType || !this.ownerId) {
            return;
        }
        await this.api.attachMedia(assetId, {
            ownerType: this.ownerType,
            ownerId: this.ownerId,
            role: this.role
        });
        await this.refreshPreview();
        if (typeof this.onAttached === 'function') {
            this.onAttached(assetId);
        }
    }

    /**
     *
     */
    async commitPendingSelection () {
        if (!this.pendingAssetId) {
            return;
        }
        await this.attachAsset(this.pendingAssetId);
        this.pendingAssetId = null;
        this.pendingPreviewUrl = '';
        this.setStatus('Saved.');
        this.updateModalPreview();
        this.close();
    }

    /**
     *
     * @param assetId
     */
    async findAssetById (assetId) {
        if (!assetId) {
            return null;
        }
        try {
            const result = await this.api.listMedia({ type: this.type, page: 1, pageSize: 50 });
            const assets = result && result.assets ? result.assets : [];
            return assets.find(asset => String(asset.id) === String(assetId)) || null;
        } catch (error) {
            return null;
        }
    }

    /**
     *
     * @param isGenerating
     */
    setGenerating (isGenerating) {
        this.isGenerating = isGenerating;
        if (!this.modal) {
            return;
        }
        const generateButton = this.modal.querySelector('.media-picker-generate');
        if (generateButton) {
            generateButton.disabled = isGenerating;
            generateButton.classList.toggle('is-loading', isGenerating);
            generateButton.textContent = isGenerating ? 'Generating...' : 'Generate';
        }
    }

    /**
     *
     * @param message
     */
    setStatus (message) {
        if (!this.modal) {
            return;
        }
        const status = this.modal.querySelector('.media-picker-status');
        if (status) {
            status.textContent = message || '';
        }
    }
}
