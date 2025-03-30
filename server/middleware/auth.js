import db from '../db/index.js';

export const validateSession = async(req, res, next) => {
    try {
        const sessionToken = req.cookies.sessionToken;
        if (!sessionToken) {
            return res.status(401).json({ error: 'No session token provided' });
        }

        const session = await db.getSession(sessionToken);
        if (!session) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        const user = await db.getUser(session.user_id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.userId = session.user_id;
        req.user = user;
        next();
    } catch (error) {
        console.error('Session validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const validateUserAccess = (req, res, next) => {
    try {
        const requestedUserId = parseInt(req.params.id);
        if (requestedUserId !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    } catch (error) {
        console.error('User access validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};