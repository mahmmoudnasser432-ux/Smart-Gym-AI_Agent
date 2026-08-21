const { isPositiveNumber, isNonEmptyString } = require('../utils/validators');

const isUuid = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

const generatePlanValidator = (req) => {
    const errors = [];
    const { weight, height, age, gender, activity_level } = req.body;

    if (weight !== undefined && !isPositiveNumber(weight)) errors.push('weight must be a positive number (kg)');
    if (height !== undefined && !isPositiveNumber(height)) errors.push('height must be a positive number (cm)');
    if (age !== undefined && !isPositiveNumber(age)) errors.push('age must be a positive number');
    if (gender !== undefined && !['male', 'female'].includes(String(gender).toLowerCase())) {
        errors.push('gender must be male or female');
    }

    const validActivity = ['sedentary', 'light', 'moderate', 'active', 'athlete', 'very_active'];
    if (activity_level && !validActivity.includes(String(activity_level).toLowerCase())) {
        errors.push(`activity_level must be one of: ${validActivity.join(', ')}`);
    }

    return errors;
};

const aiChatValidator = (req) => {
    const errors = [];
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        errors.push('message is required and must be a non-empty string');
    }

    if (req.body.sessionId != null && !isNonEmptyString(req.body.sessionId, 6)) {
        errors.push('sessionId must be a non-empty string');
    }

    if (req.body.session_id != null && !isNonEmptyString(req.body.session_id, 6)) {
        errors.push('session_id must be a non-empty string');
    }

    return errors;
};

const biologicalAgeValidator = (req) => {
    const errors = [];
    const { age, gender, weight, height } = req.body;

    if (!age || !isPositiveNumber(age)) errors.push('age is required');
    if (!gender || !['male', 'female'].includes(String(gender).toLowerCase())) errors.push('gender is required: male or female');
    if (!weight || !isPositiveNumber(weight)) errors.push('weight is required (kg)');
    if (!height || !isPositiveNumber(height)) errors.push('height is required (cm)');

    return errors;
};

const progressAnalysisValidator = (req) => {
    const errors = [];
    const currentScan = req.body.current_scan || req.body.current_scan_data || req.body.currentScan;
    const previousScan = req.body.previous_scan || req.body.previous_scan_data || req.body.previousScan;

    if (!currentScan || typeof currentScan !== 'object') errors.push('current_scan is required and must be an object');
    if (previousScan !== undefined && previousScan !== null && typeof previousScan !== 'object') errors.push('previous_scan must be an object if provided');

    return errors;
};

const adaptPlanValidator = (req) => {
    const errors = [];
    const currentPlan = req.body.current_plan || req.body.currentPlan;
    const feedback = req.body.feedback || req.body.request || req.body.message;

    if (!currentPlan || typeof currentPlan !== 'object') {
        errors.push('current_plan is required and must be an object');
    }

    if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
        errors.push('feedback is required and must be a non-empty string');
    }

    return errors;
};

const generateReportValidator = (req) => {
    const errors = [];
    const planId = req.body.plan_id || req.body.planId;
    
    if (planId !== undefined && planId !== null && !isUuid(String(planId))) {
        errors.push('plan_id must be a valid UUID if provided');
    }

    return errors;
};

const aiChatHistoryValidator = (req) => {
    const errors = [];
    const sessionId = req.query.sessionId || req.query.session_id;
    if (!sessionId || !isNonEmptyString(sessionId, 6)) {
        errors.push('sessionId query parameter is required');
    }
    return errors;
};

const generatedPlanIdValidator = (req) => {
    const errors = [];
    if (!isUuid(String(req.params.planId || ''))) {
        errors.push('planId must be a valid UUID');
    }
    return errors;
};

const publicInbodyLookupValidator = (req) => {
    const errors = [];
    const { userId, email } = req.query;

    if (!userId && !email) {
        errors.push('userId or email query parameter is required');
        return errors;
    }

    if (userId != null && !isPositiveNumber(userId)) {
        errors.push('userId must be a positive number');
    }

    if (email != null && !isNonEmptyString(email, 3)) {
        errors.push('email must be a non-empty string');
    }

    return errors;
};

module.exports = {
    generatePlanValidator,
    aiChatValidator,
    biologicalAgeValidator,
    progressAnalysisValidator,
    adaptPlanValidator,
    generateReportValidator,
    aiChatHistoryValidator,
    generatedPlanIdValidator,
    publicInbodyLookupValidator
};
