import { parseNumericId } from '../../utils/idUtils.js';
import mediaJobRepository from '../../repositories/mediaJobRepository.js';

const mediaJobController = async(req, res) => {
  try {
    const jobId = parseNumericId(req.params.id);
    if (!jobId) {
      return res.status(400).json({ error: 'Invalid job ID' });
    }

    const job = await mediaJobRepository.getByIdForUser(jobId, req.userId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching media job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default mediaJobController;
