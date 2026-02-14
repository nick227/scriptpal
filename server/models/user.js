import crypto from 'crypto';
import { generateDefaultUsername } from '../lib/defaultUsername.js';
import { validateUsername } from '../lib/username.js';
import sessionRepository from '../repositories/sessionRepository.js';
import userRepository from '../repositories/userRepository.js';

const PASSWORD_CONFIG = {
  iterations: 100000,
  keyLength: 64,
  digest: 'sha512',
  saltBytes: 16
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(PASSWORD_CONFIG.saltBytes).toString('hex');
  const hash = crypto.pbkdf2Sync(
    password,
    salt,
    PASSWORD_CONFIG.iterations,
    PASSWORD_CONFIG.keyLength,
    PASSWORD_CONFIG.digest
  ).toString('hex');
  return { hash, salt };
};

const verifyPassword = (password, salt, hash) => {
  const candidate = crypto.pbkdf2Sync(
    password,
    salt,
    PASSWORD_CONFIG.iterations,
    PASSWORD_CONFIG.keyLength,
    PASSWORD_CONFIG.digest
  ).toString('hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  const hashBuffer = Buffer.from(hash, 'hex');
  if (candidateBuffer.length !== hashBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuffer, hashBuffer);
};

const userModel = {
  getUser: async(id) => {
    return await userRepository.getById(id);
  },

  createUser: async(user) => {
    const { hash, salt } = hashPassword(user.password);
    const username = await generateDefaultUsername({
      isTaken: async(candidate) => {
        const existing = await userRepository.getByNormalizedUsername(candidate);
        return Boolean(existing);
      }
    });
    try {
      return await userRepository.create({
        email: user.email,
        username,
        usernameNormalized: username,
        passwordHash: hash,
        passwordSalt: salt
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        error.code = 'ER_DUP_ENTRY';
      }
      throw error;
    }
  },

  updateUser: async(id, user) => {
    try {
      return await userRepository.updateEmail(id, user.email);
    } catch (error) {
      if (error?.code === 'P2002') {
        error.code = 'ER_DUP_ENTRY';
      }
      throw error;
    }
  },

  login: async(email, password) => {
    try {
      let user = await userRepository.getByEmail(email);
      if (!user || !user.passwordHash || !user.passwordSalt) {
        return null;
      }

      const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
      if (!isValid) {
        return null;
      }

      if (!user.username || !user.usernameNormalized) {
        user = await userModel.ensureUsername(user.id);
      }

      // Create a session token
      const sessionToken = crypto.randomBytes(32).toString('hex');

      // Store session in database
      const session = await sessionRepository.create(user.id, sessionToken);
      if (!session) {
        throw new Error('Failed to create session');
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        sessionToken
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  updateProfile: async(id, { username }) => {
    const validation = validateUsername(username);
    if (!validation.valid) {
      const error = new Error(validation.error);
      error.code = 'INVALID_USERNAME';
      throw error;
    }

    const existing = await userRepository.getByNormalizedUsername(validation.normalized);
    if (existing && existing.id !== Number(id)) {
      const error = new Error('Username already exists');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }

    try {
      return await userRepository.updateProfile(Number(id), {
        username: validation.normalized,
        usernameNormalized: validation.normalized
      });
    } catch (error) {
      if (error?.code === 'P2002') {
        error.code = 'ER_DUP_ENTRY';
      }
      throw error;
    }
  },

  changePassword: async(id, { currentPassword, newPassword }) => {
    if (!currentPassword || !newPassword) {
      const error = new Error('Current password and new password are required');
      error.code = 'INVALID_PASSWORD_CHANGE_PAYLOAD';
      throw error;
    }

    if (newPassword.length < 8) {
      const error = new Error('New password must be at least 8 characters');
      error.code = 'WEAK_PASSWORD';
      throw error;
    }

    const user = await userRepository.getById(Number(id));
    if (!user || user.deletedAt) {
      return null;
    }

    const isValid = verifyPassword(currentPassword, user.passwordSalt, user.passwordHash);
    if (!isValid) {
      const error = new Error('Current password is incorrect');
      error.code = 'INVALID_CURRENT_PASSWORD';
      throw error;
    }

    const { hash, salt } = hashPassword(newPassword);
    await userRepository.updatePassword(Number(id), {
      passwordHash: hash,
      passwordSalt: salt
    });

    // Invalidate all sessions so password changes immediately force re-authentication.
    await sessionRepository.deleteByUserId(Number(id));

    return true;
  },

  softDeleteUser: async(id, { password, deleteReason } = {}) => {
    if (!password) {
      const error = new Error('Password is required');
      error.code = 'PASSWORD_REQUIRED';
      throw error;
    }

    const user = await userRepository.getById(Number(id));
    if (!user || user.deletedAt) {
      return null;
    }

    const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!isValid) {
      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    await userRepository.softDelete(Number(id), { deleteReason });
    await sessionRepository.deleteByUserId(Number(id));
    return true;
  },

  ensureUsername: async(id) => {
    const user = await userRepository.getById(Number(id));
    if (!user || user.deletedAt) return null;
    if (user.username && user.usernameNormalized) {
      return user;
    }

    const username = await generateDefaultUsername({
      isTaken: async(candidate) => {
        const existing = await userRepository.getByNormalizedUsername(candidate);
        return Boolean(existing);
      }
    });

    return userRepository.updateProfile(Number(id), {
      username,
      usernameNormalized: username
    });
  },

  logout: async(sessionToken) => {
    if (!sessionToken) return false;

    // Remove session from database
    return await sessionRepository.deleteByToken(sessionToken);
  },

  validateSession: async(sessionToken) => {
    if (!sessionToken) return null;

    const session = await sessionRepository.getByToken(sessionToken);
    if (!session) return null;

    const user = await userRepository.getById(session.userId);
    if (!user || user.deletedAt) {
      return null;
    }
    return user;
  }
};

export default userModel;
