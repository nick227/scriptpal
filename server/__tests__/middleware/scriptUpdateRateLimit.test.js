import { describe, it, expect, jest } from '@jest/globals';
import scriptUpdateRateLimit from '../../middleware/scriptUpdateRateLimit.js';

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('scriptUpdateRateLimit middleware', () => {
  it('allows up to 10 updates per 10s per user+script and blocks the 11th', () => {
    const next = jest.fn();
    const req = {
      userId: 98765,
      ip: '127.0.0.1',
      params: { id: '5' }
    };

    for (let i = 0; i < 10; i += 1) {
      const res = createMockResponse();
      scriptUpdateRateLimit(req, res, next);
      expect(res.status).not.toHaveBeenCalled();
    }

    const blockedRes = createMockResponse();
    scriptUpdateRateLimit(req, blockedRes, next);

    expect(next).toHaveBeenCalledTimes(10);
    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('Too many script update requests'),
      retryAfter: expect.any(Number)
    }));
  });
});
