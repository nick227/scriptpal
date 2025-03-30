import userModel from '../models/user.js';

const userController = {
    getUser: async(req, res) => {
        try {
            const user = await userModel.getUser(req.params.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createUser: async(req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            const user = await userModel.createUser({ email });
            res.status(201).json(user);
        } catch (error) {
            console.error('Error creating user:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Email already exists' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateUser: async(req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            const user = await userModel.updateUser(req.params.id, { email });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        } catch (error) {
            console.error('Error updating user:', error);
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Email already exists' });
            }
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    login: async(req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const user = await userModel.login(email);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Set session token in HTTP-only cookie
            res.cookie('sessionToken', user.sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 14 * 24 * 60 * 60 * 1000,
                path: '/'
            });

            // Remove session token from response
            const { sessionToken, ...userWithoutToken } = user;
            res.json(userWithoutToken);
        } catch (error) {
            console.error('Error logging in:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    logout: async(req, res) => {
        try {
            const sessionToken = req.cookies.sessionToken;
            if (!sessionToken) {
                return res.status(401).json({ error: 'Not authenticated' });
            }

            const success = await userModel.logout(sessionToken);
            if (!success) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            // Clear the session cookie
            res.clearCookie('sessionToken');
            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('Error logging out:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getCurrentUser: async(req, res) => {
        try {
            const sessionToken = req.cookies.sessionToken;
            if (!sessionToken) {
                console.log('No session token found');
                return res.status(401).json({ error: 'Not authenticated' });
            }
            const user = await userModel.validateSession(sessionToken);
            if (!user) {
                console.log('Invalid session');
                return res.status(401).json({ error: 'Invalid session' });
            }
            res.json(user);
        } catch (error) {
            console.error('Error getting current user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default userController;