const { isPositiveNumber } = require('../utils/validators');

const bookMachineValidator = (req) => {
    const errors = [];
    if (req.body.machineId === 'null' || req.body.machineId == null || !isPositiveNumber(req.body.machineId)) {
        errors.push(`Invalid machineId: expected a positive number, got '${req.body.machineId}'`);
    }

    if (!req.body.startTime) {
        errors.push('startTime is required');
    }

    if (req.body.endTime == null && req.body.durationMinutes == null) {
        errors.push('endTime or durationMinutes is required');
    }

    if (req.body.durationMinutes != null) {
        if (!isPositiveNumber(req.body.durationMinutes)) {
            errors.push('durationMinutes must be a positive number');
        } else if (Number(req.body.durationMinutes) < 5 || Number(req.body.durationMinutes) > 120) {
            errors.push('durationMinutes must be between 5 and 120 minutes');
        }
    }

    return errors;
};

const machineBookedTimesValidator = (req) => {
    const errors = [];
    if (req.params.id === 'null' || !isPositiveNumber(req.params.id)) {
        errors.push(`Invalid machine id in URL: expected a positive number, got '${req.params.id}'. Please check frontend state.`);
    }
    if (!req.query.date) errors.push('date query parameter is required');
    return errors;
};

const cancelBookingValidator = (req) => {
    const errors = [];
    if (!isPositiveNumber(req.body.bookingId)) errors.push('bookingId must be a positive number');
    return errors;
};

const machinePayloadValidator = (req) => {
    const errors = [];
    if (req.body.machineCount != null && !isPositiveNumber(req.body.machineCount)) {
        errors.push('machineCount must be a positive number');
    }
    return errors;
};

module.exports = {
    bookMachineValidator,
    machineBookedTimesValidator,
    cancelBookingValidator,
    machinePayloadValidator
};
