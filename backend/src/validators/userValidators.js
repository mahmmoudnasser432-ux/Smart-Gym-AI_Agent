const { isPositiveNumber } = require('../utils/validators');

const updateProfileValidator = (req) => {
    const errors = [];
    const { username, name, phone, email, budget, activityLevel, hasDiabetes, hasHypertension, isPregnant } = req.body;

    const uname = username || name;
    if (uname != null && String(uname).trim().length < 2) errors.push('name must be at least 2 characters');
    if (phone != null && String(phone).trim().length < 6) errors.push('phone must be at least 6 characters');
    if (email != null && !String(email).includes('@')) errors.push('email must be valid');
    if (budget != null && !['low', 'moderate', 'high'].includes(String(budget))) errors.push('budget must be one of low, moderate, high');
    if (activityLevel != null && !['sedentary', 'light', 'moderate', 'active', 'athlete'].includes(String(activityLevel))) errors.push('activityLevel must be one of sedentary, light, moderate, active, athlete');
    if (hasDiabetes != null && ![true, false, 0, 1, '0', '1', 'true', 'false'].includes(hasDiabetes)) errors.push('hasDiabetes must be boolean');
    if (hasHypertension != null && ![true, false, 0, 1, '0', '1', 'true', 'false'].includes(hasHypertension)) errors.push('hasHypertension must be boolean');
    if (isPregnant != null && ![true, false, 0, 1, '0', '1', 'true', 'false'].includes(isPregnant)) errors.push('isPregnant must be boolean');

    return errors;
};

const bodyDataValidator = (req) => {
    const errors = [];
    const numericFields = ['weight', 'height'];

    for (const field of numericFields) {
        if (req.body[field] == null) {
            errors.push(`${field} is required`);
        } else if (!isPositiveNumber(req.body[field])) {
            errors.push(`${field} must be a positive number`);
        }
    }

    const optionalNumericFields = ['bodyFat', 'bodyFatPct', 'bodyFatMass', 'age', 'muscleMass', 'proteinMass', 'smm', 'bmr', 'totalBodyWater', 'visceralFat', 'waistCm', 'inbodyScore', 'trainingFrequency', 'biologicalAge'];
    for (const field of optionalNumericFields) {
        if (req.body[field] != null && !isPositiveNumber(req.body[field])) {
            errors.push(`${field} must be a positive number`);
        }
    }

    if (req.body.gender != null && !['male', 'female'].includes(String(req.body.gender))) {
        errors.push('gender must be male or female');
    }

    if (req.body.activityLevel != null && !['sedentary', 'light', 'moderate', 'active', 'athlete', 'very_active'].includes(String(req.body.activityLevel))) {
        errors.push('activityLevel must be one of sedentary, light, moderate, active, athlete, very_active');
    }

    if (req.body.budget != null && !['low', 'moderate', 'high'].includes(String(req.body.budget))) {
        errors.push('budget must be one of low, moderate, high');
    }

    return errors;
};

module.exports = {
    updateProfileValidator,
    bodyDataValidator
};
