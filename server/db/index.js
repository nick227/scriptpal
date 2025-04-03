import mysql from 'mysql';

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'scriptpal'
});

db.connect((err) => {
    if (err) throw err;
});

// User methods
db.getUser = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result[0]);
    });
});

db.getUserByEmail = (email) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM users WHERE email = ?', [email], (err, result) => {
        if (err) reject(err);
        resolve(result[0]);
    });
});

db.createUser = (user) => new Promise((resolve, reject) => {
    // First check if user exists
    db.getUserByEmail(user.email)
        .then(existingUser => {
            if (existingUser) {
                // User exists, return the existing user
                resolve(existingUser);
                return;
            }

            // User doesn't exist, create new user
            db.query('INSERT INTO users (email) VALUES (?)', [user.email],
                (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ id: result.insertId, email: user.email });
                });
        })
        .catch(err => reject(err));
});

db.updateUser = (id, user) => new Promise((resolve, reject) => {
    db.query('UPDATE users SET email = ? WHERE id = ?', [user.email, id],
        (err, result) => {
            if (err) reject(err);
            resolve({ id, email: user.email });
        });
});

// Script methods
db.getScript = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM scripts WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result[0]);
    });
});

db.createScript = (script) => new Promise((resolve, reject) => {
    db.query('INSERT INTO scripts (user_id, title, status, version_number, content) VALUES (?, ?, ?, ?, ?)', [script.user_id, script.title, script.status || 'draft', script.version_number || 1, script.content || ''],
        (err, result) => {
            if (err) reject(err);
            resolve({ id: result.insertId, ...script });
        });
});

db.updateScript = (id, script) => new Promise((resolve, reject) => {
    // Validate required fields
    if (!id) {
        reject(new Error('Script ID is required'));
        return;
    }
    if (!script.title) {
        reject(new Error('Script title is required'));
        return;
    }

    // Ensure content is a string
    const content = typeof script.content === 'string' ?
        script.content :
        JSON.stringify(script.content);

    db.query(
        'UPDATE scripts SET title = ?, status = ?, version_number = ?, content = ? WHERE id = ?', [script.title, script.status, script.version_number, content, id],
        (err, result) => {
            if (err) {
                console.error('Database error updating script:', err);
                reject(err);
                return;
            }

            // Check if update was successful
            if (result.affectedRows === 0) {
                reject(new Error('Script not found or no changes made'));
                return;
            }

            // Return updated script data
            resolve({
                id,
                ...script,
                content: content // Return the stringified content
            });
        }
    );
});

db.getAllScriptsByUser = (user_id) => {
    return new Promise((resolve, reject) => {
        db.query('SELECT * FROM scripts WHERE user_id = ?', [user_id], (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
    });
};

// Story Elements methods
db.getScriptElements = (scriptId) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM story_elements WHERE script_id = ? ORDER BY type, subtype', [scriptId],
        (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
});

db.getElement = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM story_elements WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result[0]);
    });
});

db.createElement = (element) => new Promise((resolve, reject) => {
    db.query('INSERT INTO story_elements (script_id, type, subtype, content) VALUES (?, ?, ?, ?)', [element.script_id, element.type, element.subtype, element.content],
        (err, result) => {
            if (err) reject(err);
            resolve({ id: result.insertId, ...element });
        });
});

db.updateElement = (id, element) => new Promise((resolve, reject) => {
    db.query('UPDATE story_elements SET type = ?, subtype = ?, content = ? WHERE id = ?', [element.type, element.subtype, element.content, id],
        (err, result) => {
            if (err) reject(err);
            resolve({ id, ...element });
        });
});

db.deleteElement = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM story_elements WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result.affectedRows > 0);
    });
});

// Script Profile methods
db.getScriptProfile = (scriptId) => new Promise((resolve, reject) => {
    // Get script details
    db.query('SELECT * FROM scripts WHERE id = ?', [scriptId], (err, scriptResult) => {
        if (err) reject(err);
        if (!scriptResult[0]) {
            resolve(null);
            return;
        }

        // Get all story elements
        db.query('SELECT * FROM story_elements WHERE script_id = ? ORDER BY type, subtype', [scriptId],
            (err, elementsResult) => {
                if (err) reject(err);
                resolve({
                    ...scriptResult[0],
                    elements: elementsResult
                });
            });
    });
});

// Script stats
db.getScriptStats = (scriptId) => new Promise((resolve, reject) => {
    db.query('SELECT type, subtype, content, COUNT(*) as count FROM story_elements WHERE script_id = ? GROUP BY type, content', [scriptId], (err, result) => {
        if (err) reject(err);
        resolve(result);
    });
});


// Session methods
db.createSession = (userId, sessionToken) => new Promise((resolve, reject) => {
    db.query('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 14 DAY))', [userId, sessionToken],
        (err, result) => {
            if (err) {
                reject(err);
                return;
            }
            if (!result || !result.insertId) {
                reject(new Error('Failed to create session'));
                return;
            }
            resolve({ id: result.insertId, user_id: userId, token: sessionToken });
        });
});

db.getSession = (sessionToken) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()', [sessionToken],
        (err, result) => {
            if (err) {
                console.error('Database error getting session:', err);
                reject(err);
                return;
            }
            resolve(result[0]);
        });
});

db.deleteSession = (sessionToken) => new Promise((resolve, reject) => {
    db.query('DELETE FROM sessions WHERE token = ?', [sessionToken],
        (err, result) => {
            if (err) {
                console.error('Database error deleting session:', err);
                reject(err);
                return;
            }
            resolve(result.affectedRows > 0);
        });
});

// Persona methods
db.getScriptPersonas = (scriptId) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM personas WHERE script_id = ?', [scriptId],
        (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
});

db.getPersona = (id) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM personas WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result[0]);
    });
});

db.createPersona = (persona) => new Promise((resolve, reject) => {
    db.query('INSERT INTO personas (script_id, description) VALUES (?, ?)', [persona.script_id, persona.description],
        (err, result) => {
            if (err) reject(err);
            resolve({ id: result.insertId, ...persona });
        });
});

db.updatePersona = (id, persona) => new Promise((resolve, reject) => {
    db.query('UPDATE personas SET description = ? WHERE id = ?', [persona.description, id],
        (err, result) => {
            if (err) reject(err);
            resolve({ id, ...persona });
        });
});

db.deletePersona = (id) => new Promise((resolve, reject) => {
    db.query('DELETE FROM personas WHERE id = ?', [id], (err, result) => {
        if (err) reject(err);
        resolve(result.affectedRows > 0);
    });
});

// Conversation methods
db.getScriptConversations = (scriptId) => new Promise((resolve, reject) => {
    db.query('SELECT * FROM conversations WHERE script_id = ? ORDER BY created_at DESC', [scriptId],
        (err, result) => {
            if (err) reject(err);
            resolve(result);
        });
});

export default db;