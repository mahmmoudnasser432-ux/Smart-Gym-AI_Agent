const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { safeParse } = require('../utils/json');
const { withAllocatedIntId } = require('../utils/idAllocator');

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'athlete'];
const GENDERS = ['male', 'female'];
const BUDGETS = ['low', 'moderate', 'high'];

const normalizeNullableString = (value) => {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
};

const toBoolean = (value, fallback = false) => {
    if (value == null) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const s = String(value).toLowerCase().trim();
    return s === 'true' || s === '1';
};

const normalizeActivityLevel = (value, fallback = null) => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'very_active') return 'athlete';
    return ACTIVITY_LEVELS.includes(normalized) ? normalized : fallback;
};

const normalizeGender = (value, fallback = null) => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    return GENDERS.includes(normalized) ? normalized : fallback;
};

const normalizeBudget = (value, fallback = null) => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    return BUDGETS.includes(normalized) ? normalized : fallback;
};

const calculateBmi = (weight, heightCm) => {
    const meters = Number(heightCm) / 100;
    if (!meters) {
        return null;
    }

    return Number((Number(weight) / (meters * meters)).toFixed(2));
};

const mapScanRecord = (row) => {
    if (!row) {
        return null;
    }

    const bmi = row.bmi ?? calculateBmi(row.weight_kg, row.height_cm);

    return {
        scan_id: row.scan_id,
        record_id: row.scan_id,
        user_id: row.user_id,
        scan_timestamp: row.scan_timestamp,
        activity_level: row.activity_level,
        age: row.age,
        gender: row.gender,
        weight_kg: row.weight_kg,
        height_cm: row.height_cm,
        body_fat_pct: row.body_fat_pct,
        body_fat_mass: row.body_fat_mass,
        muscle_mass: row.muscle_mass,
        smm: row.smm,
        protein_mass: row.protein_mass,
        total_body_water: row.total_body_water,
        visceral_fat: row.visceral_fat,
        bmr: row.bmr,
        waist_cm: row.waist_cm,
        inbody_score: row.inbody_score,
        training_frequency: row.training_frequency,
        allergies: row.allergies,
        disease: row.disease,
        budget: row.budget,
        biological_age: row.biological_age,
        predicted_goal: row.predicted_goal,
        ai_notes: row.ai_notes,
        weight: row.weight_kg,
        height: row.height_cm,
        body_fat_percentage: row.body_fat_pct,
        recorded_at: row.scan_timestamp,
        bmi
    };
};

const scanSelect = `
    SELECT scan_id, user_id, scan_timestamp, activity_level, age, gender, weight_kg, height_cm,
           body_fat_pct, body_fat_mass, muscle_mass, smm, protein_mass, total_body_water,
           visceral_fat, bmr, waist_cm, inbody_score, training_frequency, allergies, disease,
           budget, biological_age, predicted_goal, ai_notes
    FROM dbo.InBodyScans
`;

const getLatestBodyMetadata = async (pool, userId) => {
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar, 'body_profile_update')
        .query(`
            SELECT TOP 1 input_summary, created_at
            FROM dbo.ai_agent_interaction
            WHERE user_id = @userId AND interaction_type = @type
            ORDER BY created_at DESC
        `);

    if (result.recordset.length === 0) {
        return null;
    }

    return safeParse(result.recordset[0].input_summary, null);
};

const getLatestScan = async (pool, userId) => {
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            ${scanSelect}
            WHERE user_id = @userId
            ORDER BY scan_timestamp DESC, scan_id DESC
        `);

    return mapScanRecord(result.recordset[0] || null);
};

const listScans = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            ${scanSelect}
            WHERE user_id = @userId
            ORDER BY scan_timestamp DESC, scan_id DESC
        `);

    return result.recordset.map(mapScanRecord);
};

const getScanById = async (userId, scanId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('scanId', sql.UniqueIdentifier, scanId)
        .query(`
            ${scanSelect}
            WHERE user_id = @userId AND scan_id = @scanId
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'InBody scan not found');
    }

    return mapScanRecord(result.recordset[0]);
};

const upsertHealthProfile = async (poolOrRequest, userId, payload, currentProfile = null) => {
    const hasHealthFields = [
        'hasDiabetes', 'hasHypertension', 'isPregnant', 'heartIssues',
        'allergies', 'pastInjuries', 'otherConditions', 'bloodType', 'disease'
    ].some((key) => payload[key] != null);

    if (!hasHealthFields) {
        return currentProfile;
    }

    const profile = currentProfile || { healthProfile: {} };
    const currentHealth = profile.healthProfile || {};

    const values = {
        hasDiabetes: toBoolean(payload.hasDiabetes ?? currentHealth.has_diabetes ?? 0),
        hasHypertension: toBoolean(payload.hasHypertension ?? currentHealth.has_hypertension ?? 0),
        isPregnant: toBoolean(payload.isPregnant ?? currentHealth.is_pregnant ?? 0),
        heartIssues: payload.heartIssues ?? currentHealth.heart_issues ?? null,
        allergies: payload.allergies ?? currentHealth.allergies ?? null,
        pastInjuries: payload.pastInjuries ?? currentHealth.past_injuries ?? null,
        otherConditions: payload.otherConditions ?? payload.disease ?? currentHealth.other_conditions ?? null,
        bloodType: payload.bloodType ?? currentHealth.blood_type ?? null
    };

    const request = poolOrRequest.request()
        .input('userId', sql.Int, userId)
        .input('hasDiabetes', sql.Bit, values.hasDiabetes ? 1 : 0)
        .input('hasHypertension', sql.Bit, values.hasHypertension ? 1 : 0)
        .input('isPregnant', sql.Bit, values.isPregnant ? 1 : 0)
        .input('heartIssues', sql.VarChar(255), normalizeNullableString(values.heartIssues))
        .input('allergies', sql.VarChar(sql.MAX), normalizeNullableString(values.allergies))
        .input('pastInjuries', sql.VarChar(sql.MAX), normalizeNullableString(values.pastInjuries))
        .input('otherConditions', sql.VarChar(sql.MAX), normalizeNullableString(values.otherConditions))
        .input('bloodType', sql.VarChar(5), normalizeNullableString(values.bloodType));

    const existing = await poolOrRequest.request()
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 health_id FROM dbo.user_health_profile WHERE user_id = @userId');

    if (existing.recordset.length === 0) {
        const healthIdAllocation = await withAllocatedIntId(poolOrRequest, 'dbo.user_health_profile', 'health_id', 'healthId');
        await healthIdAllocation.bind(request).query(`
            INSERT INTO dbo.user_health_profile (
                health_id, user_id, has_diabetes, has_hypertension, is_pregnant, heart_issues,
                allergies, past_injuries, other_conditions, blood_type, updated_at
            )
            VALUES (
                @healthId, @userId, @hasDiabetes, @hasHypertension, @isPregnant, @heartIssues,
                @allergies, @pastInjuries, @otherConditions, @bloodType, GETDATE()
            )
        `);
    } else {
        await request.query(`
            UPDATE dbo.user_health_profile
            SET has_diabetes = @hasDiabetes,
                has_hypertension = @hasHypertension,
                is_pregnant = @isPregnant,
                heart_issues = @heartIssues,
                allergies = @allergies,
                past_injuries = @pastInjuries,
                other_conditions = @otherConditions,
                blood_type = @bloodType,
                updated_at = GETDATE()
            WHERE user_id = @userId
        `);
    }
};

const createBodyScan = async (userId, payload, options = {}) => {
    const pool = options.pool || await poolPromise;
    const currentProfile = options.currentProfile || await getProfile(userId);
    const latest = options.latestScan || currentProfile.latestBodyRecord;

    const weight = Number(payload.weight ?? payload.weight_kg ?? latest?.weight_kg);
    const height = Number(payload.height ?? payload.height_cm ?? latest?.height_cm);

    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(height) || height <= 0) {
        throw new ApiError(400, 'weight and height are required to save an InBody scan');
    }

    // --- InBody Retention Policy ---
    // If the user already has 12 or more scans, delete all of them so the new one starts a fresh cycle
    const countResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query('SELECT COUNT(*) AS count FROM dbo.InBodyScans WHERE user_id = @userId');
        
    if (countResult.recordset[0].count >= 12) {
        await pool.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM dbo.InBodyScans WHERE user_id = @userId');
    }
    // -------------------------------

    const request = pool.request()
        .input('userId', sql.Int, userId)
        .input('activityLevel', sql.NVarChar(20), normalizeActivityLevel(
            payload.activity_level ?? payload.activityLevel,
            latest?.activity_level ?? currentProfile.activity_level ?? 'moderate'
        ))
        .input('age', sql.Int, payload.age ?? latest?.age ?? null)
        .input('gender', sql.NVarChar(10), normalizeGender(payload.gender, latest?.gender))
        .input('weight', sql.Float, weight)
        .input('height', sql.Float, height)
        .input('bodyFatPct', sql.Float, payload.bodyFatPct ?? payload.bodyFat ?? payload.body_fat_pct ?? latest?.body_fat_pct ?? null)
        .input('bodyFatMass', sql.Float, payload.bodyFatMass ?? payload.body_fat_mass ?? latest?.body_fat_mass ?? null)
        .input('muscleMass', sql.Float, payload.muscleMass ?? payload.muscle_mass ?? latest?.muscle_mass ?? null)
        .input('smm', sql.Float, payload.smm ?? latest?.smm ?? null)
        .input('proteinMass', sql.Float, payload.proteinMass ?? payload.protein_mass ?? latest?.protein_mass ?? null)
        .input('totalBodyWater', sql.Float, payload.totalBodyWater ?? payload.total_body_water ?? latest?.total_body_water ?? null)
        .input('visceralFat', sql.Float, payload.visceralFat ?? payload.visceral_fat ?? latest?.visceral_fat ?? null)
        .input('bmr', sql.Float, payload.bmr ?? latest?.bmr ?? null)
        .input('waistCm', sql.Float, payload.waistCm ?? payload.waist_cm ?? latest?.waist_cm ?? null)
        .input('inbodyScore', sql.Float, payload.inbodyScore ?? payload.inbody_score ?? latest?.inbody_score ?? null)
        .input('trainingFrequency', sql.Int, payload.trainingFrequency ?? payload.training_frequency ?? latest?.training_frequency ?? 3)
        .input('allergies', sql.NVarChar(sql.MAX), normalizeNullableString(payload.allergies ?? latest?.allergies))
        .input('disease', sql.NVarChar(sql.MAX), normalizeNullableString(payload.disease ?? latest?.disease))
        .input('budget', sql.NVarChar(10), normalizeBudget(payload.budget, latest?.budget ?? currentProfile.budget))
        .input('biologicalAge', sql.Float, payload.biologicalAge ?? payload.biological_age ?? latest?.biological_age ?? null)
        .input('predictedGoal', sql.NVarChar(50), normalizeNullableString(payload.predictedGoal ?? payload.predicted_goal ?? latest?.predicted_goal))
        .input('aiNotes', sql.NVarChar(sql.MAX), normalizeNullableString(payload.aiNotes ?? payload.ai_notes ?? latest?.ai_notes));

    const result = await request.query(`
        INSERT INTO dbo.InBodyScans (
            user_id, scan_timestamp, activity_level, age, gender, weight_kg, height_cm, body_fat_pct,
            body_fat_mass, muscle_mass, smm, protein_mass, total_body_water, visceral_fat, bmr,
            waist_cm, inbody_score, training_frequency, allergies, disease, budget, biological_age,
            predicted_goal, ai_notes
        )
        OUTPUT INSERTED.scan_id, INSERTED.user_id, INSERTED.scan_timestamp, INSERTED.activity_level,
               INSERTED.age, INSERTED.gender, INSERTED.weight_kg, INSERTED.height_cm, INSERTED.body_fat_pct,
               INSERTED.body_fat_mass, INSERTED.muscle_mass, INSERTED.smm, INSERTED.protein_mass,
               INSERTED.total_body_water, INSERTED.visceral_fat, INSERTED.bmr, INSERTED.waist_cm,
               INSERTED.inbody_score, INSERTED.training_frequency, INSERTED.allergies, INSERTED.disease,
               INSERTED.budget, INSERTED.biological_age, INSERTED.predicted_goal, INSERTED.ai_notes
        VALUES (
            @userId, GETDATE(), @activityLevel, @age, @gender, @weight, @height, @bodyFatPct,
            @bodyFatMass, @muscleMass, @smm, @proteinMass, @totalBodyWater, @visceralFat, @bmr,
            @waistCm, @inbodyScore, @trainingFrequency, @allergies, @disease, @budget, @biologicalAge,
            @predictedGoal, @aiNotes
        )
    `);

    await upsertHealthProfile(pool, userId, payload, currentProfile);

    return mapScanRecord(result.recordset[0]);
};

const getProfile = async (userId) => {
    const pool = await poolPromise;
    const userResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 u.user_id, u.username, u.email, u.phone, u.status, u.created_at,
                   u.budget, u.activity_level, u.subscription_end_date, u.profile_picture_url,
                   w.balance,
                   h.health_id, h.has_diabetes, h.has_hypertension, h.is_pregnant, h.heart_issues,
                   h.allergies, h.past_injuries, h.other_conditions, h.blood_type, h.updated_at AS health_updated_at
            FROM dbo.users u
            LEFT JOIN dbo.tokenwallet w ON w.user_id = u.user_id
            LEFT JOIN dbo.user_health_profile h ON h.user_id = u.user_id
            WHERE u.user_id = @userId
        `);

    if (userResult.recordset.length === 0) {
        throw new ApiError(404, 'User not found');
    }

    const latestBodyRecord = await getLatestScan(pool, userId);
    const bodyMetadata = await getLatestBodyMetadata(pool, userId);
    const row = userResult.recordset[0];

    return {
        user_id: row.user_id,
        username: row.username,
        email: row.email,
        phone: row.phone,
        status: row.status,
        created_at: row.created_at,
        budget: row.budget,
        activity_level: row.activity_level,
        subscription_end_date: row.subscription_end_date,
        balance: row.balance,
        profile_picture_url: row.profile_picture_url || null,
        latestBodyRecord,
        bodyMetadata,
        healthProfile: {
            health_id: row.health_id,
            has_diabetes: row.has_diabetes,
            has_hypertension: row.has_hypertension,
            is_pregnant: row.is_pregnant,
            heart_issues: row.heart_issues,
            allergies: row.allergies,
            past_injuries: row.past_injuries,
            other_conditions: row.other_conditions,
            blood_type: row.blood_type,
            updated_at: row.health_updated_at
        }
    };
};

const updateProfile = async (userId, payload) => {
    const pool = await poolPromise;
    const current = await getProfile(userId);
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const newUsername = payload.username || payload.name || current.username;
        const newEmail = payload.email || current.email;

        await transaction.request()
            .input('userId', sql.Int, userId)
            .input('username', sql.VarChar(100), newUsername)
            .input('email', sql.VarChar(100), newEmail)
            .input('phone', sql.VarChar(30), payload.phone ?? current.phone)
            .input('budget', sql.NVarChar(10), normalizeBudget(payload.budget, current.budget))
            .input('activityLevel', sql.NVarChar(20), normalizeActivityLevel(payload.activityLevel, current.activity_level))
            .query(`
                UPDATE dbo.users
                SET username = @username,
                    email = @email,
                    phone = @phone,
                    budget = @budget,
                    activity_level = @activityLevel
                WHERE user_id = @userId
            `);

        await upsertHealthProfile(transaction, userId, payload, current);

        await transaction.commit();
        return getProfile(userId);
    } catch (error) {
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        throw error;
    }
};

const updateBodyData = async (userId, payload) => {
    const pool = await poolPromise;
    const current = await getProfile(userId);
    const savedScan = await createBodyScan(userId, payload, {
        pool,
        currentProfile: current,
        latestScan: current.latestBodyRecord
    });

    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar(50), 'body_profile_update')
        .input('input', sql.VarChar(sql.MAX), JSON.stringify(payload))
        .input('output', sql.VarChar(sql.MAX), JSON.stringify({ scan_id: savedScan.scan_id, bmi: savedScan.bmi }))
        .query(`
            INSERT INTO dbo.ai_agent_interaction (ai_id, user_id, interaction_type, input_summary, output_summary, created_at)
            VALUES (@interactionId, @userId, @type, @input, @output, GETDATE())
        `);

    return {
        saved: true,
        scan: savedScan,
        bmi: savedScan.bmi
    };
};

const getProgress = async (userId) => {
    const records = (await listScans(userId)).slice().reverse();
    const latest = records[records.length - 1] || null;
    const first = records[0] || null;
    // second-to-last scan is the "previous" scan for comparison
    const previous = records.length >= 2 ? records[records.length - 2] : null;

    let metrics = [];
    let summary = null;

    if (latest) {
        const weightChange = first ? Number((Number(latest.weight || 0) - Number(first.weight || 0)).toFixed(2)) : 0;
        const bodyFatChange = first ? Number((Number(latest.body_fat_percentage || 0) - Number(first.body_fat_percentage || 0)).toFixed(2)) : 0;
        const bmiChange = first ? Number((Number(latest.bmi || 0) - Number(first.bmi || 0)).toFixed(2)) : 0;
        const muscleMassChange = first ? Number((Number(latest.muscle_mass || 0) - Number(first.muscle_mass || 0)).toFixed(2)) : 0;
        
        // Some missing fields like biological_age need handling
        const biologicalAgeDiff = first ? (latest.biological_age || 0) - (first.biological_age || 0) : 0;

        metrics = [
            { label: 'Weight', current: Number(latest.weight || 0), unit: 'kg', diff: weightChange, status: weightChange <= 0 ? 'improved' : 'worsened' },
            { label: 'Body Fat', current: Number(latest.body_fat_percentage || 0), unit: '%', diff: bodyFatChange, status: bodyFatChange <= 0 ? 'improved' : 'worsened' },
            { label: 'Muscle Mass', current: Number(latest.muscle_mass || 0), unit: 'kg', diff: muscleMassChange, status: muscleMassChange >= 0 ? 'improved' : 'worsened' },
            { label: 'BMI', current: Number(latest.bmi || 0), unit: '', diff: bmiChange, status: bmiChange <= 0 ? 'improved' : 'worsened' }
        ];

        if (latest.biological_age) {
            metrics.push({ label: 'Biological Age', current: Number(latest.biological_age), unit: 'yrs', diff: biologicalAgeDiff, status: biologicalAgeDiff <= 0 ? 'improved' : 'worsened' });
        }

        summary = {
            weight: Number(latest.weight || latest.weight_kg || 0),
            weight_kg: Number(latest.weight_kg || latest.weight || 0),
            body_fat_percentage: Number(latest.body_fat_percentage || latest.body_fat_pct || 0),
            body_fat_pct: Number(latest.body_fat_pct || latest.body_fat_percentage || 0),
            bmi: Number(latest.bmi || 0),
            muscle_mass: Number(latest.muscle_mass || 0),
            biological_age: Number(latest.biological_age || 0),
            weightChange,
            bodyFatChange,
            bmiChange,
            muscleMassChange
        };
    }

    return {
        records,
        current_scan: latest,
        previous_scan: previous,
        previous_scan_date: previous ? previous.created_at : null,
        metrics,
        summary
    };
};


module.exports = {
    getProfile,
    updateProfile,
    updateBodyData,
    getProgress,
    getLatestScan,
    listScans,
    getScanById,
    createBodyScan,
    mapScanRecord,
    calculateBmi
};

const uploadProfilePicture = async (userId, file, body, baseUrl) => {
    if (!file) {
        throw new ApiError(400, 'No image file provided');
    }

    // Save only the relative path to prevent broken URLs if the server IP/domain changes
    const relativePath = `/uploads/profiles/${file.filename}`;

    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.Int, userId)
        .input('url', sql.NVarChar(500), relativePath)
        .query(`
            UPDATE dbo.users
            SET profile_picture_url = @url
            WHERE user_id = @userId
        `);

    let updatedProfile = null;
    const nameToUpdate = body?.username || body?.name;
    if (nameToUpdate) {
        updatedProfile = await updateProfile(userId, { username: nameToUpdate });
    }

    return { 
        profile_picture_url: relativePath,
        ...(updatedProfile ? { profile: updatedProfile } : {})
    };
};

// re-export with the new function
Object.assign(module.exports, { uploadProfilePicture });
