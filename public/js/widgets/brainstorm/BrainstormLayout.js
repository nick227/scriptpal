import { clamp } from './brainstormUtils.js';

export const getNotePosition = ({
    boardRect,
    index,
    total,
    ring,
    noteWidth,
    noteHeight
}) => {
    const centerX = boardRect.width / 2;
    const centerY = boardRect.height / 2;
    const ringBase = Math.min(boardRect.width, boardRect.height) * 0.22;
    const ringOffset = ring * 70;
    const step = (Math.PI * 2) / Math.max(total, 4);
    const angle = step * index + (ring * 0.55);
    const jitter = (Math.random() - 0.5) * 0.5;
    const radius = ringBase + ringOffset + (Math.random() * 18 - 9);
    const rawX = centerX + Math.cos(angle + jitter) * radius - noteWidth / 2;
    const rawY = centerY + Math.sin(angle + jitter) * radius - noteHeight / 2;
    const padding = 12;
    const x = clamp(rawX, padding, boardRect.width - noteWidth - padding);
    const y = clamp(rawY, padding, boardRect.height - noteHeight - padding);
    return { x, y };
};
