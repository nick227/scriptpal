import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Create the connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'scriptpal',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Simple query queue implementation
class QueryQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
    }

    async enqueue(queryFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ queryFn, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        this.isProcessing = true;
        const { queryFn, resolve, reject } = this.queue.shift();

        try {
            const result = await queryFn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.isProcessing = false;
            this.processQueue();
        }
    }
}

const queryQueue = new QueryQueue();

// Database wrapper
const db = {
    /**
     * Get a script by ID (latest version_number by default)
     * @param {number} scriptId - The ID of the script to fetch
     * @param {number} [version_number] - Optional specific version_number to fetch
     * @returns {Promise<Object>} The script object
     */
    async getScript(scriptId, version_number = null) {
        try {
            console.log('Getting script:', { scriptId, version_number });

            if (version_number) {
                // Get specific version_number
                const [rows] = await pool.query(
                    'SELECT * FROM scripts WHERE id = ? AND version_number = ?', [scriptId, version_number]
                );
                console.log('Found script with version_number:', {
                    found: rows && rows[0] ? true : false,
                    id: scriptId,
                    version_number
                });
                return rows[0];
            }

            // Get latest version_number
            const [rows] = await pool.query(
                'SELECT * FROM scripts WHERE id = ? ORDER BY version_number DESC LIMIT 1', [scriptId]
            );
            console.log('Found latest script:', {
                found: rows && rows[0] ? true : false,
                id: scriptId,
                version_number: rows && rows[0] ? rows[0].version_number : null
            });
            return rows[0];
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Get all versions of a script
     * @param {number} scriptId - The ID of the script
     * @returns {Promise<Array>} Array of script versions
     */
    async getScriptVersions(scriptId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM scripts WHERE id = ? ORDER BY version_number DESC', [scriptId]
            );
            return rows;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Get script elements
     * @param {number} scriptId - The ID of the script
     * @returns {Promise<Array>} Array of script elements
     */
    async getScriptElements(scriptId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM script_elements WHERE script_id = ?', [scriptId]
            );
            return rows;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Create a new script element
     * @param {Object} data - Element data
     * @returns {Promise<Object>} Created element
     */
    async createElement(data) {
        try {
            const [result] = await pool.query(
                'INSERT INTO script_elements (script_id, type, subtype, content) VALUES (?, ?, ?, ?)', [data.script_id, data.type, data.subtype, data.content]
            );
            return {
                id: result.insertId,
                ...data
            };
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Update an existing script element
     * @param {number} elementId - Element ID to update
     * @param {Object} data - Updated element data
     * @returns {Promise<Object>} Updated element
     */
    async updateElement(elementId, data) {
        try {
            await pool.query(
                'UPDATE script_elements SET type = ?, subtype = ?, content = ? WHERE id = ?', [data.type, data.subtype, data.content, elementId]
            );
            return {
                id: elementId,
                ...data
            };
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Get script profile including basic info and elements (latest version_number)
     * @param {number} scriptId - The ID of the script
     * @returns {Promise<Object>} Script profile
     */
    async getScriptProfile(scriptId) {
        try {
            const script = await db.getScript(scriptId);
            if (!script) return null;

            const [elements] = await pool.query(
                'SELECT * FROM script_elements WHERE script_id = ?', [scriptId]
            );

            return {
                ...script,
                elements
            };
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Execute a raw query
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Promise<Array>} Query results
     */
    async query(query, params = []) {
        try {
            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    // User methods
    getUser: async(id) => {
        const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    },

    getUserByEmail: async(email) => {
        const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    },

    createUser: async(user) => {
        // First check if user exists
        const existingUser = await db.getUserByEmail(user.email);
        if (existingUser) {
            return existingUser;
        }

        // User doesn't exist, create new user
        const result = await db.query('INSERT INTO users (email) VALUES (?)', [user.email]);
        return { id: result.insertId, email: user.email };
    },

    updateUser: async(id, user) => {
        await db.query('UPDATE users SET email = ? WHERE id = ?', [user.email, id]);
        return { id, email: user.email };
    },

    // Script methods
    /**
     * Create a new script (version_number 1)
     * @param {Object} script - Script data
     * @returns {Promise<Object>} Created script
     */
    async createScript(script) {
        const result = await db.query(
            'INSERT INTO scripts (user_id, title, status, version_number, content) VALUES (?, ?, ?, 1, ?)', [script.user_id, script.title, script.status || 'draft', script.content || '']
        );
        return { id: result.insertId, version_number: 1, ...script };
    },

    /**
     * Update a script by creating a new version_number
     * @param {number} id - Script ID to update
     * @param {Object} script - Updated script data
     * @returns {Promise<Object>} Updated script
     */
    async updateScript(id, script) {
        try {
            // Get the current latest version_number
            const [currentVersions] = await pool.query(
                'SELECT * FROM scripts WHERE id = ? ORDER BY version_number DESC LIMIT 1', [id]
            );

            if (!currentVersions || currentVersions.length === 0) {
                throw new Error('Script not found');
            }

            const currentScript = currentVersions[0];
            const newVersion = currentScript.version_number + 1;

            // Insert new version_number with updated content using ON DUPLICATE KEY UPDATE
            const [result] = await pool.query(
                `INSERT INTO scripts (id, version_number, title, status, content, user_id) 
                 VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE
                 title = VALUES(title),
                 status = VALUES(status),
                 content = VALUES(content)`, [
                    id,
                    newVersion,
                    script.title || currentScript.title,
                    script.status || currentScript.status,
                    script.content || currentScript.content,
                    currentScript.user_id
                ]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to create new version_number');
            }

            // Return the new version_number
            const [newScript] = await pool.query(
                'SELECT * FROM scripts WHERE id = ? AND version_number = ?', [id, newVersion]
            );

            return newScript[0];
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        }
    },

    /**
     * Get all scripts by user (latest versions only)
     * @param {number} user_id - User ID
     * @returns {Promise<Array>} Array of latest script versions
     */
    async getAllScriptsByUser(user_id) {
        return await db.query(
            `SELECT DISTINCT s.* 
             FROM scripts s
             INNER JOIN (
                 SELECT id, MAX(version_number) as max_version 
                 FROM scripts 
                 WHERE user_id = ? 
                 GROUP BY id
             ) latest 
             ON s.id = latest.id AND s.version_number = latest.max_version`, [user_id]
        );
    },

    // Story Elements methods
    getElement: async(id) => {
        const rows = await db.query('SELECT * FROM script_elements WHERE id = ?', [id]);
        return rows[0];
    },

    deleteElement: async(id) => {
        const result = await db.query('DELETE FROM script_elements WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },

    // Script stats
    getScriptStats: async(scriptId) => {
        return await db.query(
            'SELECT type, subtype, content, COUNT(*) as count FROM script_elements WHERE script_id = ? GROUP BY type, content', [scriptId]
        );
    },

    // Session methods
    createSession: async(userId, sessionToken) => {
        const result = await db.query(
            'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))', [userId, sessionToken]
        );

        if (!result || !result.insertId) {
            throw new Error('Failed to create session');
        }

        return { id: result.insertId, user_id: userId, token: sessionToken };
    },

    getSession: async(sessionToken) => {
        const rows = await db.query(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()', [sessionToken]
        );
        return rows[0];
    },

    deleteSession: async(sessionToken) => {
        const result = await db.query('DELETE FROM sessions WHERE token = ?', [sessionToken]);
        return result.affectedRows > 0;
    },

    // Persona methods
    getScriptPersonas: async(scriptId) => {
        return await db.query('SELECT * FROM personas WHERE script_id = ?', [scriptId]);
    },

    getPersona: async(id) => {
        const rows = await db.query('SELECT * FROM personas WHERE id = ?', [id]);
        return rows[0];
    },

    createPersona: async(persona) => {
        const result = await db.query(
            'INSERT INTO personas (script_id, description) VALUES (?, ?)', [persona.script_id, persona.description]
        );
        return { id: result.insertId, ...persona };
    },

    updatePersona: async(id, persona) => {
        await db.query(
            'UPDATE personas SET description = ? WHERE id = ?', [persona.description, id]
        );
        return { id, ...persona };
    },

    deletePersona: async(id) => {
        const result = await db.query('DELETE FROM personas WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },

    // Conversation methods
    getScriptConversations: async(scriptId) => {
        return await db.query(
            'SELECT * FROM conversations WHERE script_id = ? ORDER BY created_at DESC', [scriptId]
        );
    },

    // Chat history methods
    getChatHistory: async(userId) => {
        return await db.query(
            'SELECT * FROM chat_history WHERE user_id = ? ORDER BY id DESC', [userId]
        );
    },

    createChatHistory: async(userId, content, type) => {
        // Ensure content is a string
        const safeContent = typeof content === 'string' ? content : JSON.stringify(content);

        return await db.query(
            'INSERT INTO chat_history (user_id, type, content) VALUES (?, ?, ?)', [userId, type, safeContent]
        );
    },

};

export default db;