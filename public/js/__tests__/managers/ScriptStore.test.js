/**
 * Tests for ScriptStore
 */

import { EventManager } from '../../core/EventManager.js';
import { StateManager } from '../../core/StateManager.js';
import { ScriptStore } from '../../stores/ScriptStore.js';
import { ScriptFormatter } from '../../services/scriptFormatter.js';

const mockApi = {
    getAllScriptsByUser: jest.fn(),
    getScript: jest.fn(),
    updateScript: jest.fn(),
    deleteScript: jest.fn(),
    createScript: jest.fn()
};

describe('ScriptStore', () => {
    let scriptStore;
    let stateManager;
    let eventManager;

    beforeEach(() => {
        stateManager = new StateManager();
        eventManager = new EventManager();
        scriptStore = new ScriptStore(mockApi, stateManager, eventManager);
        jest.clearAllMocks();
    });

    afterEach(() => {
        scriptStore = null;
        stateManager = null;
        eventManager = null;
    });

    describe('constructor', () => {
        it('should initialize with required dependencies', () => {
            expect(scriptStore.api).toBe(mockApi);
            expect(scriptStore.stateManager).toBe(stateManager);
            expect(scriptStore.eventManager).toBe(eventManager);
            expect(scriptStore.currentScriptId).toBeNull();
            expect(scriptStore.scripts).toEqual([]);
            expect(scriptStore.isLoading).toBe(false);
            expect(scriptStore.formatter).toBeInstanceOf(ScriptFormatter);
        });

        it('should throw error if API is not provided', () => {
            expect(() => {
                new ScriptStore(null, stateManager, eventManager);
            }).toThrow('API is required for ScriptStore');
        });

        it('should throw error if EventManager is not provided', () => {
            expect(() => {
                new ScriptStore(mockApi, stateManager, null);
            }).toThrow('EventManager is required for ScriptStore');
        });
    });

    describe('loadScripts', () => {
        it('should load scripts successfully', async () => {
            const userId = 1;
            const mockScripts = [
                { id: 1, title: 'Script 1', content: 'Content 1' },
                { id: 2, title: 'Script 2', content: 'Content 2' }
            ];
            mockApi.getAllScriptsByUser.mockResolvedValue(mockScripts);

            const result = await scriptStore.loadScripts(userId);

            expect(mockApi.getAllScriptsByUser).toHaveBeenCalledWith(userId);
            expect(result).toHaveLength(mockScripts.length);
            expect(result[0]).toMatchObject({
                id: mockScripts[0].id,
                title: mockScripts[0].title,
                content: mockScripts[0].content
            });
            expect(scriptStore.scripts).toHaveLength(mockScripts.length);
            expect(scriptStore.isLoading).toBe(false);
        });

        it('should handle loading errors', async () => {
            const userId = 1;
            const error = new Error('Failed to load scripts');
            mockApi.getAllScriptsByUser.mockRejectedValue(error);

            const result = await scriptStore.loadScripts(userId);
            expect(result).toEqual([]);
            expect(scriptStore.isLoading).toBe(false);
        });

        it('should return cached scripts if already loaded', async () => {
            const userId = 1;
            const cachedScripts = [{ id: 1, title: 'Cached Script' }];
            scriptStore.scripts = cachedScripts;

            const result = await scriptStore.loadScripts(userId);
            expect(result).toEqual(cachedScripts);
            expect(mockApi.getAllScriptsByUser).not.toHaveBeenCalled();
        });

        it('should return empty array for invalid user ID', async () => {
            const result = await scriptStore.loadScripts(null);
            expect(result).toEqual([]);
            expect(mockApi.getAllScriptsByUser).not.toHaveBeenCalled();
        });
    });

    describe('loadScript', () => {
        it('should load a specific script', async () => {
            const scriptId = 1;
            const mockScript = { id: scriptId, title: 'Test Script', content: 'Test Content', version_number: 1 };
            mockApi.getScript.mockResolvedValue(mockScript);

            const result = await scriptStore.loadScript(scriptId);

            expect(mockApi.getScript).toHaveBeenCalledWith(String(scriptId));
            expect(result).toBeTruthy();
            expect(result).toMatchObject({
                id: mockScript.id,
                title: mockScript.title,
                content: mockScript.content
            });
            expect(scriptStore.currentScriptId).toBe(scriptId);
        });

        it('should handle loading errors', async () => {
            const scriptId = 1;
            const error = new Error('Script not found');
            mockApi.getScript.mockRejectedValue(error);

            const result = await scriptStore.loadScript(scriptId);
            expect(result).toBeNull();
        });

        it('should return null for invalid script ID', async () => {
            const result = await scriptStore.loadScript(null);
            expect(result).toBeNull();
        });
    });

    describe('updateScript', () => {
        it('should update an existing script', async () => {
            const scriptId = 1;
            const updateData = {
                title: 'Updated Script',
                content: 'Updated Content',
                version_number: 2
            };
            const updatedScript = { id: scriptId, ...updateData };
            mockApi.updateScript.mockResolvedValue(updatedScript);

            const result = await scriptStore.updateScript(scriptId, updateData);

            expect(mockApi.updateScript).toHaveBeenCalledWith(scriptId, expect.any(Object));
            expect(result).toBeTruthy();
        });

        it('should handle update errors', async () => {
            const scriptId = 1;
            const updateData = { title: 'Updated Script', content: 'Content', version_number: 2 };
            const error = new Error('Failed to update script');
            mockApi.updateScript.mockRejectedValue(error);

            const result = await scriptStore.updateScript(scriptId, updateData);
            expect(result).toBeNull();
        });

        it('should throw error for invalid version number', async () => {
            const scriptId = 1;
            const updateData = { title: 'Updated Script', content: 'Content' };

            await expect(scriptStore.updateScript(scriptId, updateData)).rejects.toThrow('Invalid version number provided');
        });

        it('should return null for invalid data', async () => {
            const scriptId = 1;
            const result = await scriptStore.updateScript(scriptId, null);
            expect(result).toBeNull();
        });
    });

    describe('deleteScript', () => {
        it('should delete a script', async () => {
            const scriptId = 1;
            mockApi.deleteScript.mockResolvedValue(true);

            await scriptStore.deleteScript(scriptId);

            expect(mockApi.deleteScript).toHaveBeenCalledWith(scriptId);
        });

        it('should handle deletion errors', async () => {
            const scriptId = 1;
            const error = new Error('Failed to delete script');
            mockApi.deleteScript.mockRejectedValue(error);

            await expect(scriptStore.deleteScript(scriptId)).resolves.not.toThrow();
        });

        it('should not delete if already loading', async () => {
            scriptStore.isLoading = true;
            await scriptStore.deleteScript(1);
            expect(mockApi.deleteScript).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentScript', () => {
        it('should return current script from state', () => {
            const script = { id: 1, title: 'Test Script', content: 'Test Content' };
            stateManager.setState('currentScript', script);

            const result = scriptStore.getCurrentScript();
            expect(result).toBeTruthy();
        });

        it('should return null if no current script', () => {
            const result = scriptStore.getCurrentScript();
            expect(result).toBeNull();
        });
    });

    describe('getScripts', () => {
        it('should return all scripts', () => {
            const scripts = [
                { id: 1, title: 'Script 1' },
                { id: 2, title: 'Script 2' }
            ];
            scriptStore.scripts = scripts;

            const result = scriptStore.getScripts();
            expect(result).toEqual(scripts);
        });
    });

    describe('getValidTags', () => {
        it('should return valid tags from formatter', () => {
            const tags = scriptStore.getValidTags();
            expect(Array.isArray(tags)).toBe(true);
            expect(tags.length).toBeGreaterThan(0);
        });
    });

    describe('standardizeScript', () => {
        it('should standardize script data', () => {
            const script = { id: 1, title: 'Test Script', content: 'Test Content' };
            const result = scriptStore.standardizeScript(script);

            expect(result).toBeTruthy();
            expect(result.id).toBe(1);
            expect(result.title).toBe('Test Script');
            expect(result.content).toBe('Test Content');
        });

        it('should handle invalid script data', () => {
            const result = scriptStore.standardizeScript(null);

            expect(result).toBeTruthy();
            expect(result.id).toBe(0);
            expect(result.title).toBe('Invalid Script');
        });
    });
});