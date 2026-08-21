module.exports = (schema) => (req, res, next) => {
    const errors = schema(req) || [];

    if (errors.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: errors[0],
            errors
        });
    }

    next();
};
