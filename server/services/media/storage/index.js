import path from 'path';
import { fileURLToPath } from 'url';
import config from '../../../config/index.js';
import { LocalOriginStorageAdapter } from './LocalOriginStorageAdapter.js';
import { LocalDeliveryAdapter } from './LocalDeliveryAdapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveUploadRoot = () => {
  const configured = config.get('MEDIA_UPLOAD_DIR');
  if (path.isAbsolute(configured)) {
    return configured;
  }
  const serverRoot = path.join(__dirname, '..', '..', '..');
  return path.resolve(serverRoot, '..', configured);
};

export const createOriginStorageAdapter = () => {
  const origin = config.get('MEDIA_ORIGIN');
  if (origin !== 'local') {
    return new LocalOriginStorageAdapter({ rootDir: resolveUploadRoot() });
  }
  return new LocalOriginStorageAdapter({ rootDir: resolveUploadRoot() });
};

export const createDeliveryAdapter = () => {
  const delivery = config.get('MEDIA_DELIVERY');
  if (delivery !== 'local') {
    return new LocalDeliveryAdapter({ baseUrl: config.get('MEDIA_BASE_URL') });
  }
  return new LocalDeliveryAdapter({ baseUrl: config.get('MEDIA_BASE_URL') });
};
