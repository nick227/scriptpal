import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { URL } from 'url';

const envPath = path.resolve(process.cwd(), '.env');
const dotenvResult = dotenv.config({ path: envPath, override: true });

const trimEnvValue = (value) => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const getEnvValue = (key) => trimEnvValue(process.env[key]);
const getEnvNumber = (key, fallback) => {
  const raw = trimEnvValue(process.env[key]);
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const getEnvBoolean = (key, fallback) => {
  const raw = trimEnvValue(process.env[key]);
  if (raw === undefined) {
    return fallback;
  }
  const normalized = raw.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
};

const buildPoolConfig = () => {
  const baseConfig = {
    waitForConnections: true,
    connectionLimit: getEnvNumber('DB_CONNECTION_LIMIT', 10),
    queueLimit: getEnvNumber('DB_QUEUE_LIMIT', 0)
  };

  const databaseUrl = getEnvValue('DATABASE_URL');
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    const host = getEnvValue('DB_HOST') || url.hostname;
    const port = getEnvNumber('DB_PORT', Number(url.port) || 3306);
    const user = getEnvValue('DB_USER') || url.username || 'root';
    const password = process.env.DB_PASSWORD ?? url.password ?? '';
    const database =
      getEnvValue('DB_NAME') ||
      (url.pathname ? url.pathname.slice(1) : undefined) ||
      'scriptpal';
    const allowPublicKeyRetrieval = getEnvBoolean(
      'DB_ALLOW_PUBLIC_KEY_RETRIEVAL',
      url.searchParams.get('allowPublicKeyRetrieval') === 'true'
    );

    return {
      ...baseConfig,
      host,
      port,
      user,
      password,
      database,
      ...(allowPublicKeyRetrieval === undefined
        ? {}
        : { allowPublicKeyRetrieval })
    };
  }

  const allowPublicKeyRetrieval = getEnvBoolean(
    'DB_ALLOW_PUBLIC_KEY_RETRIEVAL',
    undefined
  );

  return {
    ...baseConfig,
    host: getEnvValue('DB_HOST') || 'localhost',
    port: getEnvNumber('DB_PORT', 3306),
    user: getEnvValue('DB_USER') || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: getEnvValue('DB_NAME') || 'scriptpal',
    ...(allowPublicKeyRetrieval === undefined
      ? {}
      : { allowPublicKeyRetrieval })
  };
};

const assertPoolConfig = (config) => {
  const missing = [];

  if (!config.host) {
    missing.push('DB_HOST / DATABASE_URL host');
  }
  if (!config.user) {
    missing.push('DB_USER / DATABASE_URL user');
  }
  if (!config.database) {
    missing.push('DB_NAME / DATABASE_URL database');
  }

  if (missing.length) {
    throw new Error(
      `Incomplete database configuration (${missing.join(', ')}). ` +
        `Set the values in server/.env or via environment variables before starting the server.`
    );
  }
};

if (dotenvResult.error) {
  console.warn(
    'Warning: Unable to load server/.env, falling back to environment variables. ' +
      dotenvResult.error.message
  );
}

const poolConfig = buildPoolConfig();
assertPoolConfig(poolConfig);
const adapter = new PrismaMariaDb(poolConfig);

const prisma = new PrismaClient({ adapter });

export default prisma;
