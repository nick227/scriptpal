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
const getSearchParamNumber = (searchParams, keys, fallback) => {
  for (const key of keys) {
    const raw = searchParams.get(key);
    if (raw == null || raw === '') {
      continue;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
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
    queueLimit: getEnvNumber('DB_QUEUE_LIMIT', 0),
    connectTimeout: getEnvNumber('DB_CONNECT_TIMEOUT_MS', 10000),
    acquireTimeout: getEnvNumber('DB_ACQUIRE_TIMEOUT_MS', 15000),
    socketTimeout: getEnvNumber('DB_SOCKET_TIMEOUT_MS', 30000),
    enableKeepAlive: getEnvBoolean('DB_ENABLE_KEEP_ALIVE', true),
    keepAliveInitialDelay: getEnvNumber('DB_KEEP_ALIVE_INITIAL_DELAY_MS', 0),
    maxIdle: getEnvNumber('DB_MAX_IDLE', getEnvNumber('DB_CONNECTION_LIMIT', 10)),
    idleTimeout: getEnvNumber('DB_IDLE_TIMEOUT_MS', 60000)
  };

  const databaseUrl = getEnvValue('DATABASE_URL');
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    const host = url.hostname || getEnvValue('DB_HOST');
    const port = getEnvNumber('DB_PORT', Number(url.port) || 3306);
    const user = url.username || getEnvValue('DB_USER') || 'root';
    const password = process.env.DB_PASSWORD ?? url.password ?? '';
    const database =
      (url.pathname ? url.pathname.slice(1) : undefined) ||
      getEnvValue('DB_NAME') ||
      'scriptpal';
    const allowPublicKeyRetrieval = getEnvBoolean(
      'DB_ALLOW_PUBLIC_KEY_RETRIEVAL',
      url.searchParams.get('allowPublicKeyRetrieval') === 'true'
    );
    const connectTimeout = getEnvNumber(
      'DB_CONNECT_TIMEOUT_MS',
      getSearchParamNumber(url.searchParams, ['connectTimeout', 'connect_timeout'], baseConfig.connectTimeout)
    );
    const acquireTimeout = getEnvNumber(
      'DB_ACQUIRE_TIMEOUT_MS',
      getSearchParamNumber(url.searchParams, ['acquireTimeout', 'acquire_timeout'], baseConfig.acquireTimeout)
    );
    const socketTimeout = getEnvNumber(
      'DB_SOCKET_TIMEOUT_MS',
      getSearchParamNumber(url.searchParams, ['socketTimeout', 'socket_timeout'], baseConfig.socketTimeout)
    );

    return {
      ...baseConfig,
      host,
      port,
      user,
      password,
      database,
      connectTimeout,
      acquireTimeout,
      socketTimeout,
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

const dbRuntimeConfig = Object.freeze({
  usingDatabaseUrl: Boolean(getEnvValue('DATABASE_URL')),
  connectionLimit: poolConfig.connectionLimit,
  maxIdle: poolConfig.maxIdle,
  queueLimit: poolConfig.queueLimit,
  connectTimeout: poolConfig.connectTimeout,
  acquireTimeout: poolConfig.acquireTimeout,
  socketTimeout: poolConfig.socketTimeout,
  idleTimeout: poolConfig.idleTimeout,
  enableKeepAlive: poolConfig.enableKeepAlive
});

export default prisma;
export { dbRuntimeConfig };
