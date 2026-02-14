import userModel from '../../models/user.js';
import scriptModel from '../../models/script.js';
import tokenUsageRepository from '../../repositories/tokenUsageRepository.js';
import sessionCache from '../../middleware/sessionCache.js';

const sanitizeUser = (user) => {
  if (!user) return user;
  const {
    passwordHash: _passwordHash,
    passwordSalt: _passwordSalt,
    password_hash: _passwordHashLegacy,
    password_salt: _passwordSaltLegacy,
    usernameNormalized: _usernameNormalized,
    deletedAt: _deletedAt,
    deleteReason: _deleteReason,
    ...safeUser
  } = user;
  return safeUser;
};

const userController = {
  getUser: async(req, res) => {
    try {
      const user = await userModel.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  createUser: async(req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      const user = await userModel.createUser({ email, password });
      await scriptModel.createScript({
        userId: user.id,
        title: 'Untitled Script',
        status: 'draft',
        visibility: 'private',
        content: JSON.stringify({
          version: 2,
          lines: []
        })
      });
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      console.error('Error creating user:', {
        message: error?.message,
        code: error?.code,
        sqlMessage: error?.sqlMessage,
        stack: error?.stack
      });
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'P2002') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      const detailedError = error.sqlMessage || error.message || error.code;
      res.status(500).json({
        error: detailedError || 'Internal server error',
        details: {
          code: error?.code,
          errno: error?.errno
        }
      });
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
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Error updating user:', error);
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'P2002') {
        return res.status(409).json({ error: 'Email already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  updateCurrentProfile: async(req, res) => {
    try {
      const { username } = req.body || {};
      const user = await userModel.updateProfile(req.userId, { username });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error('Error updating current profile:', error);
      if (error.code === 'INVALID_USERNAME') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'ER_DUP_ENTRY' || error.code === 'P2002') {
        return res.status(409).json({ error: 'Username already exists' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  changePassword: async(req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      await userModel.changePassword(req.userId, { currentPassword, newPassword });

      const { sessionToken } = req.cookies || {};
      sessionCache.deleteByUserId(req.userId);
      if (sessionToken) {
        sessionCache.delete(sessionToken);
      }
      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      res.json({ message: 'Password updated. Please sign in again.' });
    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'INVALID_PASSWORD_CHANGE_PAYLOAD' || error.code === 'WEAK_PASSWORD') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'INVALID_CURRENT_PASSWORD') {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  softDeleteCurrentUser: async(req, res) => {
    try {
      const { password, confirm, deleteReason } = req.body || {};
      if (confirm !== 'DELETE') {
        return res.status(400).json({ error: 'Account deletion confirmation required' });
      }

      const result = await userModel.softDeleteUser(req.userId, { password, deleteReason });
      if (!result) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { sessionToken } = req.cookies || {};
      sessionCache.deleteByUserId(req.userId);
      if (sessionToken) {
        sessionCache.delete(sessionToken);
      }

      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });

      res.status(204).send();
    } catch (error) {
      console.error('Error soft deleting current user:', error);
      if (error.code === 'PASSWORD_REQUIRED') {
        return res.status(400).json({ error: error.message });
      }
      if (error.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  login: async(req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await userModel.login(email, password);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isProduction = process.env.NODE_ENV === 'production';
      const sameSite = isProduction ? 'none' : 'lax';

      // Set session token in HTTP-only cookie
      res.cookie('sessionToken', user.sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite,
        maxAge: 14 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      // Return user data without session token
      const { sessionToken: _sessionToken, ...userWithoutToken } = user;
      res.json({ user: userWithoutToken });
    } catch (error) {
      console.error('Error logging in:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  logout: async(req, res) => {
    try {
      const { sessionToken } = req.cookies;
      if (!sessionToken) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const success = await userModel.logout(sessionToken);
      if (!success) {
        return res.status(401).json({ error: 'Invalid session' });
      }
      sessionCache.delete(sessionToken);

      // Clear the session cookie
      res.clearCookie('sessionToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/'
      });
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error logging out:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getCurrentUser: async(req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Invalid session' });
      }
      let currentUser = req.user;
      if (!currentUser.username || !currentUser.usernameNormalized) {
        currentUser = await userModel.ensureUsername(currentUser.id);
      }
      res.json(sanitizeUser(currentUser));
    } catch (error) {
      console.error('Error getting current user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  getTokenWatch: async(req, res) => {
    try {
      const userId = req.userId;
      const totals = await tokenUsageRepository.getTotalsForUser(userId);
      res.json({
        userId,
        tokens: {
          prompt: totals.promptTokens,
          completion: totals.completionTokens,
          total: totals.totalTokens
        },
        costUsd: totals.costUsd,
        lastUpdated: totals.lastUpdated
      });
    } catch (error) {
      console.error('Error fetching token usage:', error);
      res.status(500).json({ error: 'Failed to fetch token usage' });
    }
  }
};

export default userController;
