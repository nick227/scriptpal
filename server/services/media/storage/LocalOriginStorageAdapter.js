import fs from 'fs';
import path from 'path';

export class LocalOriginStorageAdapter {
  constructor({ rootDir }) {
    this.rootDir = rootDir;
    this.provider = 'local';
  }

  async putObject({ key, buffer }) {
    const fullPath = path.join(this.rootDir, ...key.split('/'));
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
    return { key };
  }

  async deleteObject({ key }) {
    const fullPath = path.join(this.rootDir, ...key.split('/'));
    try {
      await fs.promises.unlink(fullPath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
