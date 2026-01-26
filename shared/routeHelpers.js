

export const ROUTE_HELPERS = [
    {
        id: 'route-script-conversation',
        label: 'Script Chat',
        description: 'Ask the assistant to continue the script with new lines.',
        intent: 'SCRIPT_CONVERSATION',
        type: 'route',
        prompt: 'Continue the current script and add the next set of lines in-story without rewriting what exists.'
    },
    {
        id: 'route-script-reflection',
        label: 'Script Reflection',
        description: 'Discuss themes, characters, and choices without writing new lines.',
        intent: 'SCRIPT_REFLECTION',
        type: 'route',
        prompt: 'Reflect on the current script—its tone, characters, and pacing—without producing new formatted lines.'
    },
    {
        id: 'route-next-five-lines',
        label: 'Next Five Lines',
        description: 'Request the assistant to write the next five formatted lines and explain the fit.',
        intent: 'NEXT_FIVE_LINES',
        type: 'route',
        prompt: 'Write the next five formatted lines for the script:'
    },
    {
        id: 'route-general-chat',
        label: 'General Conversation',
        description: 'Talk about anything else without editing the script.',
        intent: 'GENERAL_CONVERSATION',
        type: 'route',
        prompt: 'Let us talk about the story ideas or craft without changing the script.'
    }
];