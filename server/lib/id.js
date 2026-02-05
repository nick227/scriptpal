import { randomBytes } from 'crypto';

export const generatePublicId = (length = 16) => {
  return randomBytes(length).toString('hex');
};
