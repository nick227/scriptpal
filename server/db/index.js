import mysql from 'mysql2/promise';

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'scriptpal',
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
    // Helper function to execute queries through the queue
    query: async(sql, params = []) => {
        return queryQueue.enqueue(async() => {
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute(sql, params);
                return rows;
            } finally {
                connection.release();
            }
        });
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
    getScript: async(id) => {
        const rows = await db.query('SELECT * FROM scripts WHERE id = ?', [id]);
        return rows[0];
    },

    createScript: async(script) => {
        const result = await db.query(
            'INSERT INTO scripts (user_id, title, status, version_number, content) VALUES (?, ?, ?, ?, ?)', [script.user_id, script.title, script.status || 'draft', script.version_number || 1, script.content || '']
        );
        return { id: result.insertId, ...script };
    },

    updateScript: async(id, script) => {
        if (!id) throw new Error('Script ID is required');
        if (!script.title) throw new Error('Script title is required');

        // Build update fields and values dynamically
        const updateFields = [];
        const values = [];

        if (script.title !== undefined) {
            updateFields.push('title = ?');
            values.push(script.title);
        }

        if (script.status !== undefined) {
            updateFields.push('status = ?');
            values.push(script.status);
        }

        if (script.version_number !== undefined) {
            updateFields.push('version_number = ?');
            values.push(script.version_number);
        }

        if (script.content !== undefined) {
            updateFields.push('content = ?');
            values.push(typeof script.content === 'string' ? script.content : JSON.stringify(script.content));
        }

        // Add id to values array for WHERE clause
        values.push(id);

        const result = await db.query(
            `UPDATE scripts SET ${updateFields.join(', ')} WHERE id = ?`,
            values
        );

        if (result.affectedRows === 0) {
            throw new Error('Script not found or no changes made');
        }

        // Return updated script data
        const updatedScript = await db.getScript(id);
        return updatedScript;
    },

    getAllScriptsByUser: async(user_id) => {
        return await db.query('SELECT * FROM scripts WHERE user_id = ?', [user_id]);
    },

    // Story Elements methods
    getScriptElements: async(scriptId) => {
        return await db.query(
            'SELECT * FROM script_elements WHERE script_id = ? ORDER BY type, subtype', [scriptId]
        );
    },

    getElement: async(id) => {
        const rows = await db.query('SELECT * FROM script_elements WHERE id = ?', [id]);
        return rows[0];
    },

    createElement: async(element) => {
        const result = await db.query(
            'INSERT INTO script_elements (script_id, type, subtype, content) VALUES (?, ?, ?, ?)', [element.script_id, element.type, element.subtype, element.content]
        );
        return { id: result.insertId, ...element };
    },

    updateElement: async(id, element) => {
        await db.query(
            'UPDATE script_elements SET type = ?, subtype = ?, content = ? WHERE id = ?', [element.type, element.subtype, element.content, id]
        );
        return { id, ...element };
    },

    deleteElement: async(id) => {
        const result = await db.query('DELETE FROM script_elements WHERE id = ?', [id]);
        return result.affectedRows > 0;
    },

    // Script Profile methods
    getScriptProfile: async(scriptId) => {
        const script = await db.getScript(scriptId);
        if (!script) return null;

        const elements = await db.getScriptElements(scriptId);
        return {...script, elements };
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
    }
};

export default db;