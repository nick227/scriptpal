export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const shuffle = (values) => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const swapIndex = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[swapIndex]] = [copy[swapIndex], copy[i]];
    }
    return copy;
};

export const takeUnique = (values, count) => {
    const seen = new Set();
    const result = [];
    for (const value of values) {
        if (seen.has(value)) {
            continue;
        }
        seen.add(value);
        result.push(value);
        if (result.length >= count) {
            break;
        }
    }
    return result;
};

export const normalizeSeed = (value) => value.replace(/\s+/g, ' ').trim();

export const buildId = (prefix = 'note') =>
    `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
