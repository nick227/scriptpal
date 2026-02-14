import sessionRepository from '../repositories/sessionRepository.js';
import sessionCache from './sessionCache.js';
import dbCircuitBreaker from './dbCircuitBreaker.js';

export const validateSession = async(req, res, next) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    if (!sessionToken) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const cached = sessionCache.get(sessionToken);
    if (cached) {
      if (cached.user?.deletedAt) {
        sessionCache.delete(sessionToken);
        return res.status(401).json({ error: 'Invalid or expired session' });
      }
      req.userId = cached.userId;
      req.user = cached.user;
      return next();
    }

    if (dbCircuitBreaker.isOpen()) {
      res.set('Retry-After', '5');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const resolved = await sessionRepository.getUserByValidToken(sessionToken);
    if (!resolved) {
      sessionCache.delete(sessionToken);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.userId = resolved.session.userId;
    req.user = resolved.user;
    sessionCache.set(sessionToken, {
      userId: resolved.session.userId,
      user: resolved.user,
      sessionExpiresAt: resolved.session.expiresAt
    });
    next();
  } catch (error) {
    const isDbError = dbCircuitBreaker.isDbConnectivityError(error);
    dbCircuitBreaker.recordFailure(error);
    console.error('Session validation error:', error);
    if (isDbError) {
      res.set('Retry-After', '5');
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }
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
