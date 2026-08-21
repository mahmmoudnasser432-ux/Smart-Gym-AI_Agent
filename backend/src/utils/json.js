const safeParse = (value, fallback = null) => {
    if (!value || typeof value !== 'string') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

module.exports = { safeParse };
