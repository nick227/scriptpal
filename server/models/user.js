import crypto from 'crypto';
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
    try {
      return await userRepository.create({
        email: user.email,
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
      const user = await userRepository.getByEmail(email);
      if (!user || !user.passwordHash || !user.passwordSalt) {
        return null;
      }

      const isValid = verifyPassword(password, user.passwordSalt, user.passwordHash);
      if (!isValid) {
        return null;
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
    return await sessionRepository.deleteByToken(sessionToken);
  },

  validateSession: async(sessionToken) => {
    if (!sessionToken) return null;

    const session = await sessionRepository.getByToken(sessionToken);
    if (!session) return null;

    return await userRepository.getById(session.userId);
  }
};

export default userModel;
