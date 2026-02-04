import {
    CATEGORY_BY_KEY,
    STAGGER_DELAY_MS
} from './constants.js';
import { BrainstormDom } from './BrainstormDom.js';
import { buildId } from './brainstormUtils.js';

export class BrainstormBoard {
    constructor ({ api, rootSelector = '.brainstorm-widget' } = {}) {
        if (!api) {
            throw new Error('Brainstorm API is required');
        }
        this.api = api;
        this.dom = new BrainstormDom(rootSelector);
        this.seedText = '';
        this.seeds = [];
        this.title = '';
        this.notes = [];
        this.boardId = null;
        this.boards = [];
        this.isHydrating = false;
        this.saveTimer = null;
        this.userEditedTitle = false;
        this.titleRequestInFlight = false;
        this.seedSavedText = '';
        this.titleAutoSuggestionUsed = false;
    }

    async initialize () {
        this.dom.bindSeedSubmit((seedValue) => {
            this.setSeed(seedValue);
        });
        this.dom.bindSeedInputChange((value) => {
            this.handleSeedInputChange(value);
        });
        this.dom.setSeedButtonEnabled(false);
        this.updateBoardActionButtons();
        this.dom.bindDeleteBoard(() => {
            this.handleDeleteBoard();
        });
        this.dom.bindActionClicks((categoryKey) => {
            this.handleGenerate(categoryKey);
        });
        this.dom.bindBoardSelect((boardId) => {
            this.handleBoardSelect(boardId);
        });
        this.dom.bindNewBoard(() => {
            this.handleNewBoard();
        });
        this.dom.bindTitleChange((title) => {
            this.handleTitleChange(title);
        });
        this.dom.bindAddCard((category, value) => {
            this.handleManualAdd(category, value);
        });
        this.dom.bindDeleteCard((noteId, category) => {
            this.handleDeleteNote(noteId, category);
        });

        await this.loadBoards();
    }

    async setSeed (seedValue) {
        this.seeds = this.parseSeeds(seedValue);
        this.seedText = this.formatSeeds(this.seeds);
        if (!this.title) {
            this.title = this.seedText;
            this.dom.setBoardTitle(this.title);
        }
        this.userEditedTitle = false;
        this.dom.setSeedInputValue(this.seedText);
        this.dom.setActionsEnabled(this.seeds.length > 0);
        this.clearNotes();
        this.dom.clearStatusMessage();
        this.boardId = null;
        const saved = await this.saveBoard();
        if (saved) {
            this.seedSavedText = this.seedText;
            this.dom.setSeedButtonEnabled(false);
            this.updateBoardActionButtons();
            if (!this.titleAutoSuggestionUsed && !this.title) {
                await this.generateTitleIfNeeded();
            }
        }
    }

    handleSeedInputChange (value) {
        const normalized = this.normalizeSeedInput(value);
        const hasValue = normalized.length > 0;
        const isDifferent = normalized !== this.seedSavedText;
        this.dom.setSeedButtonEnabled(hasValue && isDifferent);
    }

    clearNotes () {
        this.notes = [];
        this.dom.clearNotes();
    }

    updateBoardActionButtons () {
        const hasBoardId = !!this.boardId;
        const canDelete = hasBoardId && this.boards.length > 1;
        this.dom.setNewBoardEnabled(hasBoardId);
        this.dom.setDeleteBoardEnabled(canDelete);
    }

    async handleGenerate (categoryKey) {
        const category = CATEGORY_BY_KEY[categoryKey];
        if (!category) {
            throw new Error(`Unknown category "${categoryKey}"`);
        }

        this.dom.setAllActionsLoading(true, this.seeds.length > 0, category.key);
        this.dom.setActionLoading(category.key, true, this.seeds.length > 0);
        if (!this.boardId) {
            await this.saveBoard();
        }

        try {
            const response = await this.api.brainstorm.requestNotes(this.boardId, category.key);
            const { notes, error } = this.parseAiNotes(response, category.key);
            if (error) {
                this.dom.showStatusMessage(error);
                return;
            }
            this.dom.clearStatusMessage();
            this.renderNotesStaggered(notes, category);
        } catch (error) {
            console.error('[BrainstormBoard] Brainstorm AI request failed:', error);
            this.dom.showStatusMessage('AI response failed. Try again.');
        } finally {
            this.dom.setActionLoading(category.key, false, this.seeds.length > 0);
            this.dom.setAllActionsLoading(false, this.seeds.length > 0);
        }
    }

    async handleBoardSelect (boardId) {
        const parsed = Number(boardId);
        if (!Number.isFinite(parsed)) {
            this.resetBoardState();
            return;
        }
        this.dom.clearStatusMessage();
        const loaded = await this.loadBoardById(parsed);
        if (!loaded) {
            this.resetBoardState();
        }
    }

    handleNewBoard () {
        this.dom.setBoardOptions(this.boards, '');
        this.resetBoardState();
    }

    async handleDeleteBoard () {
        if (!this.boardId) {
            return;
        }
        const confirmed = window.confirm('Delete this board? This action cannot be undone.');
        if (!confirmed) {
            return;
        }
        const boardId = this.boardId;
        this.dom.setDeleteBoardEnabled(false);
        try {
            await this.api.brainstorm.deleteBoard(boardId);
            this.boards = this.boards.filter((entry) => entry.id !== boardId);
            if (this.boards.length) {
                const nextBoard = this.boards[0];
                this.dom.setBoardOptions(this.boards, nextBoard.id);
                const loaded = await this.loadBoardById(nextBoard.id);
                if (!loaded) {
                    this.resetBoardState();
                }
            } else {
                this.dom.setBoardOptions([], '');
                this.resetBoardState();
                this.dom.showStatusMessage('Board deleted. Create a new one or pick another board.');
            }
        } catch (error) {
            console.error('[BrainstormBoard] Failed to delete board:', error);
            this.dom.showStatusMessage('Unable to delete board.');
        } finally {
            this.updateBoardActionButtons();
        }
    }

    async handleTitleChange (title) {
        if (!title) {
            this.dom.showStatusMessage('Title is required.');
            return;
        }
        this.title = title;
        this.userEditedTitle = true;
        this.dom.clearStatusMessage();
        await this.saveBoard();
    }

    async handleManualAdd (categoryKey, value) {
        if (!value) {
            this.dom.showStatusMessage('Note text is required.');
            return;
        }
        this.dom.clearStatusMessage();
        if (!this.boardId) {
            await this.saveBoard();
        }
        const note = {
            id: buildId(categoryKey),
            category: categoryKey,
            text: value
        };
        this.appendNote(note);
        this.queueSave();
    }

    handleDeleteNote (noteId, category) {
        if (!noteId || !category) {
            return;
        }
        this.notes = this.notes.filter((note) => note.id !== noteId);
        this.dom.removeNoteElement(noteId);
        this.queueSave();
    }

    renderNotesStaggered (notes, category) {
        if (!notes.length) {
            this.queueSave();
            return;
        }
        notes.forEach((note, index) => {
            this.appendNote(note, index * STAGGER_DELAY_MS);
        });
        const totalDelay = (notes.length - 1) * STAGGER_DELAY_MS + 30;
        this.queueSave(totalDelay);
    }

    appendNote (note, delay = 0) {
        window.setTimeout(() => {
            const element = this.dom.createNoteElement(note);
            this.dom.addNoteElement(element, note.category);
            this.dom.revealNote(element);
            this.notes.push(note);
        }, delay);
    }

    getCategory (categoryKey) {
        return CATEGORY_BY_KEY[categoryKey] || null;
    }

    parseAiNotes (response, categoryKey) {
        const content = this.extractResponseContent(response);
        let parsed = [];
        if (!content) {
            return { notes: [], error: 'AI response was empty.' };
        }
        if (content) {
            try {
                parsed = JSON.parse(content);
            } catch (error) {
                console.error('[BrainstormBoard] Failed to parse AI notes:', error);
                return { notes: [], error: 'AI response format was invalid.' };
            }
        }
        if (!Array.isArray(parsed)) {
            return { notes: [], error: 'AI response format was invalid.' };
        }
        return {
            notes: parsed
            .filter(item => typeof item === 'string' && item.trim())
            .map(item => ({
                id: buildId(categoryKey),
                category: categoryKey,
                text: item.trim()
            })),
            error: null
        };
    }

    extractResponseContent (response) {
        if (!response || typeof response !== 'object') {
            return '';
        }
        // Case 1: response.response is the content string (e.g. from brainstorm controller)
        if (typeof response.response === 'string') {
            return response.response;
        }
        // Case 2: nested content/message object
        if (response.response && typeof response.response.message === 'string') {
            return response.response.message;
        }
        if (response.response && typeof response.response.content === 'string') {
            return response.response.content;
        }
        // Case 3: result object with content
        if (response.result && typeof response.result.content === 'string') {
            return response.result.content;
        }
        // Case 4: direct content property
        if (typeof response.content === 'string') {
            return response.content;
        }
        return '';
    }

    parseAiTitle (response) {
        const content = this.extractResponseContent(response);
        if (!content) {
            return '';
        }
        try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed.title === 'string') {
                return parsed.title.trim();
            }
        } catch (error) {
            console.error('[BrainstormBoard] Failed to parse AI title:', error);
        }
        return '';
    }

    parseSeeds (value) {
        if (!value) {
            return [];
        }
        return value
            .split(',')
            .map(seed => seed.trim())
            .filter(Boolean);
    }

    normalizeSeedInput (value) {
        return this.formatSeeds(this.parseSeeds(value));
    }

    formatSeeds (seeds) {
        if (!Array.isArray(seeds) || !seeds.length) {
            return '';
        }
        return seeds.join(', ');
    }

    async generateTitleIfNeeded () {
        if (this.userEditedTitle || this.titleRequestInFlight || !this.boardId || this.titleAutoSuggestionUsed) {
            return;
        }
        this.titleRequestInFlight = true;
        try {
            const response = await this.api.brainstorm.requestTitle(this.boardId);
            const title = this.parseAiTitle(response);
            if (title) {
                this.title = title;
                this.dom.setBoardTitle(title);
                await this.saveBoard();
            }
        } catch (error) {
            console.error('[BrainstormBoard] Failed to generate title:', error);
        } finally {
            this.titleRequestInFlight = false;
            this.titleAutoSuggestionUsed = true;
        }
    }

    async loadBoards () {
        const response = await this.api.brainstorm.listBoards();
        if (!response || !Array.isArray(response.boards)) {
            this.resetBoardState();
            return;
        }
        this.boards = response.boards;
        if (!this.boards.length) {
            this.dom.setBoardOptions([], '');
            this.resetBoardState();
            return;
        }
        const latest = this.boards[0];
        this.dom.setBoardOptions(this.boards, latest.id);
        await this.loadBoardById(latest.id);
    }

    async loadBoardById (boardId) {
        const board = await this.api.brainstorm.getBoard(boardId);
        if (!board) {
            return false;
        }
        this.applyBoard(board);
        return true;
    }

    resetBoardState () {
        this.seedText = '';
        this.seeds = [];
        this.title = '';
        this.notes = [];
        this.boardId = null;
        this.userEditedTitle = false;
        this.dom.setSeedInputValue('');
        this.dom.setBoardTitle('');
        this.dom.setActionsEnabled(false);
        this.dom.clearNotes();
        this.dom.clearStatusMessage();
        this.seedSavedText = '';
        this.dom.setSeedButtonEnabled(false);
        this.titleAutoSuggestionUsed = false;
        this.updateBoardActionButtons();
    }

    applyBoard (board) {
        this.isHydrating = true;
        this.seedText = board.seed || '';
        this.seeds = this.parseSeeds(this.seedText);
        this.title = board.title || '';
        this.boardId = board.id;
        this.userEditedTitle = true;
        this.dom.setSeedInputValue(this.seedText);
        this.seedSavedText = this.seedText;
        this.dom.setBoardTitle(this.title);
        this.titleAutoSuggestionUsed = !!this.title;
        this.dom.setActionsEnabled(this.seeds.length > 0);
        this.clearNotes();
        this.dom.clearStatusMessage();
        this.dom.setSeedButtonEnabled(false);
        this.updateBoardActionButtons();

        if (!Array.isArray(board.notes)) {
            return;
        }
        const notes = board.notes.map((note) => ({
            id: note.id,
            category: note.category,
            text: note.content
        }));
        this.renderNotesStaggered(notes);
        const totalDelay = (notes.length - 1) * STAGGER_DELAY_MS + 30;
        window.setTimeout(() => {
            this.isHydrating = false;
        }, Math.max(totalDelay, 30));
    }

    async saveBoard () {
        if (this.isHydrating) {
            return false;
        }
        
        // Defensive check: ensure notes is always an array
        if (!Array.isArray(this.notes)) {
            console.error('[BrainstormBoard] saveBoard: this.notes is not an array!', typeof this.notes, this.notes);
            this.notes = [];
        }
        
        // Create a fresh array to avoid any reference/proxy issues
        const notesArray = [];
        for (const note of this.notes) {
            notesArray.push({
                category: note.category,
                content: note.text
            });
        }
        
        const payload = {
            title: this.title || '',
            seed: this.seedText || '',
            notes: notesArray
        };
        
        if (this.boardId) {
            try {
                const updated = await this.api.brainstorm.updateBoard(this.boardId, payload);
                if (updated) {
                    this.boardId = updated.id;
                    this.syncBoardList(updated);
                    return true;
                }
            } catch (error) {
                console.error('[BrainstormBoard] Failed to update board:', error);
                this.dom.showStatusMessage('Unable to save board.');
            }
            return false;
        }
        try {
            const created = await this.api.brainstorm.createBoard(payload);
            if (created) {
                this.boardId = created.id;
                this.syncBoardList(created);
                return true;
            }
        } catch (error) {
            console.error('[BrainstormBoard] Failed to create board:', error);
            this.dom.showStatusMessage('Unable to save board.');
        }
        return false;
    }

    syncBoardList (board) {
        if (!board) {
            return;
        }
        const filtered = this.boards.filter((entry) => entry.id !== board.id);
        this.boards = [board, ...filtered];
        this.dom.setBoardOptions(this.boards, board.id);
        this.updateBoardActionButtons();
    }

    queueSave (delay = 0) {
        if (this.saveTimer) {
            window.clearTimeout(this.saveTimer);
        }
        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            this.saveBoard();
        }, delay);
    }
}
