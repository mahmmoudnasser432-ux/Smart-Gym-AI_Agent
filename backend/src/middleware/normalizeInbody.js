const normalizeInbodyPayload = (req, res, next) => {
    const b = req.body;
    if (!b || typeof b !== 'object') return next();

    // Convert empty strings to null to prevent DB casting errors
    for (const key in b) {
        if (typeof b[key] === 'string' && b[key].trim() === '') {
            b[key] = null;
        }
    }

    if (b.weight_kg  != null && b.weight  == null) b.weight  = b.weight_kg;
    if (b.height_cm  != null && b.height  == null) b.height  = b.height_cm;
    if (b.body_fat_pct   != null && b.bodyFatPct   == null) b.bodyFatPct   = b.body_fat_pct;
    if (b.body_fat_mass  != null && b.bodyFatMass  == null) b.bodyFatMass  = b.body_fat_mass;
    if (b.muscle_mass    != null && b.muscleMass   == null) b.muscleMass   = b.muscle_mass;
    if (b.protein_mass   != null && b.proteinMass  == null) b.proteinMass  = b.protein_mass;
    if (b.total_body_water != null && b.totalBodyWater == null) b.totalBodyWater = b.total_body_water;
    if (b.visceral_fat   != null && b.visceralFat  == null) b.visceralFat  = b.visceral_fat;
    if (b.waist_cm       != null && b.waistCm      == null) b.waistCm      = b.waist_cm;
    if (b.inbody_score   != null && b.inbodyScore  == null) b.inbodyScore  = b.inbody_score;
    if (b.biological_age != null && b.biologicalAge== null) b.biologicalAge= b.biological_age;
    if (b.activity_level != null && b.activityLevel== null) b.activityLevel= b.activity_level;
    if (b.training_frequency != null && b.trainingFrequency == null) b.trainingFrequency = b.training_frequency;
    
    next();
};

module.exports = normalizeInbodyPayload;
