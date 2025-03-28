import conversationModel from '../models/conversation.js';

const conversationController = {
    getConversation: async(req, res) => {
        try {
            const conversation = await conversationModel.getConversation(req.params.id);
            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }
            res.json(conversation);
        } catch (error) {
            console.error('Error getting conversation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    createConversation: async(req, res) => {
        try {
            const { script_id, thread_id, questions, response, prompt } = req.body;

            if (!script_id || !thread_id || !questions || !response || !prompt) {
                return res.status(400).json({ error: 'All fields are required' });
            }

            const conversation = await conversationModel.createConversation({
                script_id,
                thread_id,
                questions,
                response,
                prompt
            });

            res.status(201).json(conversation);
        } catch (error) {
            console.error('Error creating conversation:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

export default conversationController;