import { PublicScriptService } from '../../../services/api/PublicScriptService.js';
import { ValidationError } from '../../../services/api/APIError.js';

describe('PublicScriptService', () => {
    it('throws when clone is called without publicId', async() => {
        const service = new PublicScriptService({ request: jest.fn() });

        await expect(service.clonePublicScriptByPublicId()).rejects.toBeInstanceOf(ValidationError);
    });

    it('posts to clone endpoint with versionNumber', async() => {
        const request = jest.fn().mockResolvedValue({ id: 1, slug: 'copied' });
        const service = new PublicScriptService({ request });

        await service.clonePublicScriptByPublicId('pub123', { versionNumber: 4 });

        expect(request).toHaveBeenCalledWith('/public/scripts/public/pub123/clone', {
            method: 'POST',
            data: { versionNumber: 4 }
        });
    });
});
