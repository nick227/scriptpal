import prisma from '../db/prismaClient.js';
import scriptRepository from '../repositories/scriptRepository.js';

class OwnershipError extends Error {
  constructor (message, status = 403) {
    super(message);
    this.status = status;
  }
}

const parseNumericId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

const defaultScriptIdResolver = (req) => {
  const candidates = [
    req.params?.scriptId,
    req.params?.id,
    req.body?.scriptId,
    req.body?.id,
    req.query?.scriptId,
    req.query?.id
  ];
  for (const candidate of candidates) {
    const id = parseNumericId(candidate);
    if (id !== null) {
      return id;
    }
  }
  return null;
};

export const verifyScriptOwnership = async (userId, scriptId) => {
  if (!userId) {
    throw new OwnershipError('Authentication required', 401);
  }
  const parsedId = parseNumericId(scriptId);
  if (!parsedId) {
    throw new OwnershipError('Script ID is required', 400);
  }
  const script = await scriptRepository.getById(parsedId);
  if (!script) {
    throw new OwnershipError('Script not found', 404);
  }
  if (script.userId !== userId) {
    throw new OwnershipError('Access denied', 403);
  }
  return script;
};

export const requireScriptOwnership = (options = {}) => {
  const resolver = typeof options.getScriptId === 'function'
    ? options.getScriptId
    : defaultScriptIdResolver;

  return async (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const scriptId = resolver(req);
    if (!scriptId) {
      return res.status(400).json({ error: 'Script ID is required' });
    }

    try {
      const script = await verifyScriptOwnership(req.userId, scriptId);
      req.script = script;
      next();
    } catch (error) {
      if (error instanceof OwnershipError) {
        return res.status(error.status || 403).json({ error: error.message });
      }
      console.error('[requireScriptOwnership] Unexpected error', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const ensureElementOwnership = async (userId, elementId) => {
  const parsedId = parseNumericId(elementId);
  if (!parsedId) {
    throw new OwnershipError('Story element ID is required', 400);
  }
  const element = await prisma.scriptElement.findUnique({
    where: { id: parsedId },
    include: {
      script: {
        select: {
          id: true,
          userId: true
        }
      }
    }
  });
  if (!element) {
    throw new OwnershipError('Story element not found', 404);
  }
  if (!element.script || element.script.userId !== userId) {
    throw new OwnershipError('Access denied', 403);
  }
  return element;
};

export const ensurePersonaOwnership = async (userId, personaId) => {
  const parsedId = parseNumericId(personaId);
  if (!parsedId) {
    throw new OwnershipError('Persona ID is required', 400);
  }
  const persona = await prisma.persona.findUnique({
    where: { id: parsedId },
    include: {
      script: {
        select: {
          id: true,
          userId: true
        }
      }
    }
  });
  if (!persona) {
    throw new OwnershipError('Persona not found', 404);
  }
  if (!persona.script || persona.script.userId !== userId) {
    throw new OwnershipError('Access denied', 403);
  }
  return persona;
};

export const ensureSceneOwnership = async (userId, sceneId) => {
  const parsedId = parseNumericId(sceneId);
  if (!parsedId) {
    throw new OwnershipError('Scene ID is required', 400);
  }
  const scene = await prisma.scene.findUnique({
    where: { id: parsedId },
    include: {
      script: {
        select: {
          id: true,
          userId: true
        }
      }
    }
  });
  if (!scene) {
    throw new OwnershipError('Scene not found', 404);
  }
  if (!scene.script || scene.script.userId !== userId) {
    throw new OwnershipError('Access denied', 403);
  }
  return scene;
};

export const OwnershipErrors = {
  OwnershipError
};
