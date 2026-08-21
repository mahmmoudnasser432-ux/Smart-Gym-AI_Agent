const success = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
        status: 'success',
        data
    });
};

const created = (res, data) => success(res, data, 201);

module.exports = { success, created };
