import db from '../db/index.js'; // Adjust if your db file is not named index.js
import crypto from 'crypto';

const userModel = {
    getUser: async(id) => {
        return await db.getUser(id);
    },

    createUser: async(user) => {
        return await db.createUser(user);
    },

    updateUser: async(id, user) => {
        return await db.updateUser(id, user);
    },

    login: async(email) => {
        try {
            // First try to get existing user
            let user = await db.getUserByEmail(email);

            // If user doesn't exist, create them
            if (!user) {
                user = await db.createUser({ email });
                if (!user) {
                    throw new Error('Failed to create user');
                }
            }

            // Create a session token
            const sessionToken = crypto.randomBytes(32).toString('hex');

            // Store session in database
            const session = await db.createSession(user.id, sessionToken);
            if (!session) {
                throw new Error('Failed to create session');
            }

            return {
                ...user,
                sessionToken
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },

    logout: async(sessionToken) => {
        if (!sessionToken) return false;

        // Remove session from database
        return await db.deleteSession(sessionToken);
    },

    validateSession: async(sessionToken) => {
        if (!sessionToken) return null;

        const session = await db.getSession(sessionToken);
        if (!session) return null;

        return await db.getUser(session.user_id);
    }
};

export default userModel;