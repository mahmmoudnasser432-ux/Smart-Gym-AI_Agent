const crypto = require('crypto');
const { callAgent } = require('../utils/aiAgentClient');
const { sql, poolPromise } = require('../config/db');
const userService = require('./userService');
const workoutService = require('./workoutService');
const mealService = require('./mealService');
const chatService = require('./chatService');
const goalPredictor = require('../ai-agent/goalPredictor');
const ApiError = require('../utils/apiError');
const { safeParse } = require('../utils/json');
const { withAllocatedIntId } = require('../utils/idAllocator');

const INPUT_MAX = 4000;

const isAgentUnavailable = (error) => error?.statusCode === 503 || error?.statusCode === 504 || error?.statusCode === 500;

const ACTIVITY_MAP = {
    very_active: 'athlete'
};

const normalizeActivityLevel = (value, fallback = 'moderate') => {
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    return ACTIVITY_MAP[normalized] || normalized;
};

const normalizePlanId = (value) => {
    if (!value) return null;
    return String(value).trim();
};

const calculateBiologicalAgeFallback = ({ age, gender, weight, height, body_fat_pct, smm, visceral_fat }) => {
    const bmi = userService.calculateBmi(weight, height) || 0;
    let biologicalAge = Number(age);

    if (body_fat_pct != null) {
        const bodyFat = Number(body_fat_pct);
        if (String(gender).toLowerCase() === 'male') {
            if (bodyFat > 25) biologicalAge += 3;
            if (bodyFat < 15) biologicalAge -= 2;
        } else {
            if (bodyFat > 33) biologicalAge += 3;
            if (bodyFat < 22) biologicalAge -= 2;
        }
    }

    if (visceral_fat != null) {
        const visceralFat = Number(visceral_fat);
        if (visceralFat > 10) biologicalAge += 2;
        if (visceralFat < 5) biologicalAge -= 1;
    }

    if (smm != null && Number(smm) > 30) {
        biologicalAge -= 1;
    }

    if (bmi >= 30) {
        biologicalAge += 1;
    }

    return Math.max(18, Math.round(biologicalAge));
};

const calculateCaloriesFallback = ({ weight, height, age, gender, activity_level, goal }) => {
    const safeGender = String(gender || 'male').toLowerCase();
    const safeWeight = Number(weight);
    const safeHeight = Number(height);
    const safeAge = Number(age);

    const bmr = safeGender === 'male'
        ? 88.362 + (13.397 * safeWeight) + (4.799 * safeHeight) - (5.677 * safeAge)
        : 447.593 + (9.247 * safeWeight) + (3.098 * safeHeight) - (4.33 * safeAge);

    const factors = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        active: 1.725,
        athlete: 1.9
    };

    const normalizedGoal = String(goal || 'balanced').toLowerCase();
    const tdee = bmr * (factors[normalizeActivityLevel(activity_level)] || 1.55);

    if (normalizedGoal === 'fat loss' || normalizedGoal === 'fat_loss') return Math.round(tdee - 500);
    if (normalizedGoal === 'muscle gain' || normalizedGoal === 'muscle_gain') return Math.round(tdee + 300);
    return Math.round(tdee);
};

const calculateMacrosFallback = ({ calories, weight }) => {
    const protein = Math.round(Number(weight) * 2.2);
    const fats = Math.round((calories * 0.25) / 9);
    const carbs = Math.round((calories - protein * 4 - fats * 9) / 4);

    return { protein, carbs, fats };
};

const buildPdfBuffer = (title, lines) => {
    const escapePdf = (value) => String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const textLines = [title, ...lines].map((line, index) => `BT /F1 12 Tf 50 ${760 - (index * 18)} Td (${escapePdf(line)}) Tj ET`);
    const content = textLines.join('\n');
    const contentLength = Buffer.byteLength(content, 'utf8');

    const objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
        `5 0 obj << /Length ${contentLength} >> stream\n${content}\nendstream endobj`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (const object of objects) {
        offsets.push(Buffer.byteLength(pdf, 'utf8'));
        pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';

    for (let i = 1; i < offsets.length; i++) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'utf8');
};

const persistAudit = async (userId, type, input, output) => {
    const pool = await poolPromise;
    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar(50), type)
        .input('input', sql.VarChar(sql.MAX), JSON.stringify(input).slice(0, INPUT_MAX))
        .input('output', sql.VarChar(sql.MAX), JSON.stringify(output).slice(0, INPUT_MAX))
        .query(`
            INSERT INTO dbo.ai_agent_interaction
                (ai_id, user_id, interaction_type, input_summary, output_summary)
            VALUES (@interactionId, @userId, @type, @input, @output)
        `);
};

const mapGeneratedPlan = (row) => {
    if (!row) {
        return null;
    }

    return {
        plan_id: row.plan_id,
        user_id: row.user_id,
        scan_id: row.scan_id,
        predicted_goal: row.predicted_goal,
        biological_age: row.biological_age,
        total_calories: row.total_calories,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fats_g: row.fats_g,
        activity_level: row.activity_level,
        training_frequency: row.training_frequency,
        budget: row.budget,
        allergies: row.allergies,
        disease: row.disease,
        meal_plan_text: row.meal_plan_text,
        workout_plan_text: row.workout_plan_text,
        coach_notes: row.coach_notes,
        created_at: row.created_at,
        scan: row.scan_payload ? safeParse(row.scan_payload, null) : null
    };
};

const getContext = async (userId) => {
    const profile = await userService.getProfile(userId);
    let currentWorkout = null;
    let currentMeal = null;
    let latestPlan = null;
    try { currentWorkout = await workoutService.getCurrent(userId); } catch (_) { }
    try { currentMeal = await mealService.getCurrent(userId); } catch (_) { }
    try { latestPlan = await getLatestGeneratedPlan(userId); } catch (_) { }

    return {
        profile,
        latestScan: profile.latestBodyRecord,
        currentWorkout,
        currentMeal,
        latestPlan
    };
};

const generatePlans = async (userId, payload) => {
    const [workoutPlan, mealPlan] = await Promise.all([
        workoutService.generate(userId, payload),
        mealService.generate(userId, payload)
    ]);
    return { workoutPlan, mealPlan };
};

const chat = async (userId, message, sessionId) => gymChat(userId, message, [], sessionId);

const toObject = (value, fallback = {}) => (value && typeof value === 'object' ? value : fallback);

const buildAdaptiveAdjustments = (feedback) => {
    const normalized = String(feedback || '').toLowerCase();
    const adjustments = [];

    if (normalized.includes('hungry') || normalized.includes('جوع') || normalized.includes('جعان')) {
        adjustments.push('Add a late-night high-protein snack and increase fiber in earlier meals.');
    }

    if (normalized.includes('4') || normalized.includes('four')) {
        adjustments.push('Restructure the workout split to 4 training days with balanced recovery.');
    }

    if (normalized.includes('3') || normalized.includes('three')) {
        adjustments.push('Keep the plan on 3 focused sessions with slightly higher per-session volume.');
    }

    if (normalized.includes('tired') || normalized.includes('تعب') || normalized.includes('fatigue')) {
        adjustments.push('Reduce overall intensity for 1 week and prioritize sleep and hydration.');
    }

    if (adjustments.length === 0) {
        adjustments.push('Tune calories, meal timing, and training volume based on the user feedback.');
    }

    return adjustments;
};

const getPlanTextsFromResponse = (body, result) => {
    const workoutText = result.workout_plan_text || result.workoutPlanText || body.workout_plan_text || body.workoutPlanText || result.plan_text || null;
    const mealText = result.meal_plan_text || result.mealPlanText || body.meal_plan_text || body.mealPlanText || result.plan_text || null;
    const coachNotes = result.coach_notes || result.coachNotes || result.plan_text || null;

    return { workoutText, mealText, coachNotes };
};

/**
 * Converts a stored plan field (JSON array or plain Markdown) to readable text.
 * Used before sending plan_text to the Python PDF generator.
 * @param {string|null} stored
 * @param {'meals'|'workout'} type
 * @returns {string}
 */
const planFieldToMarkdown = (stored, type) => {
    if (!stored) return '';
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return String(stored);

        if (type === 'meals') {
            return parsed.map(meal => {
                const header = `=== ${meal.meal_name || meal.name || 'MEAL'} ===`;
                const opts = (meal.options || []).map(o =>
                    `[${o.option || 'A'}] ${o.title || o.name || ''} | ` +
                    `${o.calories || o.kcal || 0} kcal | ${o.macros || ''}`
                ).join('\n');
                return `${header}\n${opts}`;
            }).join('\n\n');
        }

        if (type === 'workout') {
            return parsed.map(day => {
                if (typeof day === 'string') return day;
                const header = day.day_name || 'Day';
                const exs = (day.exercises || []).map(e => `- ${e}`).join('\n');
                return `${header}\n${exs}`;
            }).join('\n\n');
        }
    } catch (_) {
        // Not JSON — return as plain text
    }
    return String(stored);
};

const parsePlanTextIfNeeded = (result) => {
    if (result && result.plan_text && result.total_calories == null) {
        const text = result.plan_text;

        // Extract macros
        const macrosMatch = text.match(/(\d+)\s*kcal\s*\|\s*P:\s*(\d+)g\s*\|\s*C:\s*(\d+)g\s*\|\s*F:\s*(\d+)g/i);
        if (macrosMatch) {
            result.total_calories = parseInt(macrosMatch[1]);
            result.protein_g = parseInt(macrosMatch[2]);
            result.carbs_g = parseInt(macrosMatch[3]);
            result.fats_g = parseInt(macrosMatch[4]);
        }

        // Extract Meal Plan
        const mealMatch = text.match(/MEAL PLAN\s*={0,3}\s*([\s\S]*?)(?:WORKOUT PLAN|$)/i);
        if (mealMatch) {
            result.meal_plan_text = mealMatch[1].trim();
        }

        // Extract Workout Plan
        const workoutMatch = text.match(/WORKOUT PLAN\s*={0,3}\s*([\s\S]*?)(?:COACH NOTES|$)/i);
        if (workoutMatch) {
            result.workout_plan_text = workoutMatch[1].trim();
        }
    }
    return result;
};

const buildGeneratePlanFallbackResult = async (userId, body) => {
    const profile = await userService.getProfile(userId);
    const latest = profile.latestBodyRecord || {};
    const bodyFatPct = body.body_fat_pct ?? body.bodyFatPct ?? body.bodyFat ?? latest.body_fat_pct ?? null;
    const bmi = userService.calculateBmi(body.weight, body.height);
    const goal = goalPredictor({
        bodyFat: bodyFatPct != null ? Number(bodyFatPct) : undefined,
        bmi: bmi ?? undefined
    });
    const biologicalAge = calculateBiologicalAgeFallback({
        age: body.age,
        gender: body.gender,
        weight: body.weight,
        height: body.height,
        body_fat_pct: bodyFatPct,
        smm: body.smm ?? latest.smm,
        visceral_fat: body.visceral_fat ?? body.visceralFat ?? latest.visceral_fat
    });
    const calories = calculateCaloriesFallback({
        weight: body.weight,
        height: body.height,
        age: body.age,
        gender: body.gender,
        activity_level: body.activity_level || profile.activity_level || 'moderate',
        goal
    });
    const macros = calculateMacrosFallback({ calories, weight: body.weight });

    const planText = [
        `DAILY TARGET`,
        `${calories} kcal | P: ${macros.protein}g | C: ${macros.carbs}g | F: ${macros.fats}g`,
        ``,
        `MEAL PLAN`,
        ``,
        `=== BREAKFAST ===`,
        `[A] Oats & Eggs | 50g oats, 3 eggs | 400 kcal | P:20g C:40g F:15g`,
        `[B] Greek Yogurt | 200g yogurt, berries | 300 kcal | P:20g C:30g F:5g`,
        ``,
        `=== LUNCH ===`,
        `[A] Chicken & Rice | 150g chicken, 100g rice | 500 kcal | P:40g C:50g F:10g`,
        ``,
        `=== DINNER ===`,
        `[A] Salmon & Veggies | 150g salmon, broccoli | 450 kcal | P:35g C:10g F:20g`,
        ``,
        `WORKOUT PLAN`,
        `Day 1 - Full Body`,
        `- Squats - 3 x 10`,
        `- Bench Press - 3 x 10`,
        `- Deadlift - 3 x 8`,
        `- Pull Ups - 3 x 8`,
        `- Planks - 3 x 60s`,
        ``,
        `Day 2 - Recovery`,
        `- Light Jogging - 1 x 20m`,
        `- Stretching - 1 x 15m`,
        `- Core work - 3 x 15`,
        `- Yoga - 1 x 30m`,
        `- Rest - 1 x 1`,
        ``,
        `Day 3 - Upper Body`,
        `- Overhead Press - 3 x 10`,
        `- Barbell Rows - 3 x 10`,
        `- Pushups - 3 x 15`,
        `- Bicep Curls - 3 x 12`,
        `- Tricep Dips - 3 x 12`,
        ``,
        `COACH NOTES`,
        `- Stay hydrated and aim for 8 hours of sleep.`,
        `- Try to hit your daily protein goal to maximize muscle recovery.`
    ].join('\n');

    return {
        goal,
        predicted_goal: goal,
        biological_age: biologicalAge,
        calories,
        total_calories: calories,
        protein: macros.protein,
        protein_g: macros.protein,
        carbs: macros.carbs,
        carbs_g: macros.carbs,
        fat: macros.fats,
        fats_g: macros.fats,
        plan_text: planText,
        workout_plan_text: planText,
        meal_plan_text: planText,
        source: 'local-fallback'
    };
};

const persistGeneratedPlan = async (userId, body, rawResult, scan) => {
    const pool = await poolPromise;
    const result = parsePlanTextIfNeeded(rawResult);
    const agentData = result.agent_data || result.plan_data || {};

    const normalized = {
        predictedGoal: result.predicted_goal || result.goal || agentData.goal || agentData.ml_goal || body.predicted_goal || body.goal || scan.predicted_goal || null,
        biologicalAge: result.biological_age ?? agentData.biological_age ?? body.biological_age ?? scan.biological_age ?? null,
        calories: result.total_calories ?? result.calories ?? agentData.calories ?? body.total_calories ?? body.calories ?? null,
        protein: result.protein_g ?? result.protein ?? agentData.protein ?? body.protein_g ?? body.protein ?? null,
        carbs: result.carbs_g ?? result.carbs ?? agentData.carbs ?? body.carbs_g ?? body.carbs ?? null,
        fats: result.fats_g ?? result.fat ?? result.fats ?? agentData.fat ?? body.fats_g ?? body.fat ?? null,
        activityLevel: normalizeActivityLevel(body.activity_level ?? body.activityLevel ?? scan.activity_level ?? null, scan.activity_level ?? 'moderate'),
        trainingFrequency: body.training_frequency ?? body.trainingFrequency ?? scan.training_frequency ?? null,
        budget: body.budget ?? scan.budget ?? null,
        allergies: body.allergies ?? scan.allergies ?? null,
        disease: body.disease ?? scan.disease ?? null
    };

    const texts = getPlanTextsFromResponse(body, result);
    const request = pool.request()
        .input('userId', sql.Int, userId)
        .input('scanId', sql.UniqueIdentifier, scan.scan_id)
        .input('predictedGoal', sql.VarChar(100), normalized.predictedGoal)
        .input('biologicalAge', sql.Float, normalized.biologicalAge)
        .input('totalCalories', sql.Int, normalized.calories)
        .input('proteinG', sql.Int, normalized.protein)
        .input('carbsG', sql.Int, normalized.carbs)
        .input('fatsG', sql.Int, normalized.fats)
        .input('activityLevel', sql.NVarChar(20), normalized.activityLevel)
        .input('trainingFrequency', sql.Int, normalized.trainingFrequency)
        .input('budget', sql.NVarChar(10), normalized.budget)
        .input('allergies', sql.NVarChar(sql.MAX), normalized.allergies)
        .input('disease', sql.NVarChar(sql.MAX), normalized.disease)
        .input('mealPlanText', sql.NVarChar(sql.MAX), texts.mealText)
        .input('workoutPlanText', sql.NVarChar(sql.MAX), texts.workoutText)
        .input('coachNotes', sql.NVarChar(sql.MAX), texts.coachNotes);

    const dbResult = await request.query(`
        INSERT INTO dbo.generated_plans (
            user_id, scan_id, predicted_goal, biological_age, total_calories, protein_g, carbs_g, fats_g,
            activity_level, training_frequency, budget, allergies, disease, meal_plan_text, workout_plan_text,
            coach_notes, created_at
        )
        OUTPUT INSERTED.plan_id, INSERTED.user_id, INSERTED.scan_id, INSERTED.predicted_goal, INSERTED.biological_age,
               INSERTED.total_calories, INSERTED.protein_g, INSERTED.carbs_g, INSERTED.fats_g, INSERTED.activity_level,
               INSERTED.training_frequency, INSERTED.budget, INSERTED.allergies, INSERTED.disease,
               INSERTED.meal_plan_text, INSERTED.workout_plan_text, INSERTED.coach_notes, INSERTED.created_at
        VALUES (
            @userId, @scanId, @predictedGoal, @biologicalAge, @totalCalories, @proteinG, @carbsG, @fatsG,
            @activityLevel, @trainingFrequency, @budget, @allergies, @disease, @mealPlanText, @workoutPlanText,
            @coachNotes, GETDATE()
        )
    `);

    return {
        ...mapGeneratedPlan(dbResult.recordset[0]),
        scan
    };
};

const generatePlan = async (userId, body) => {
    let result;

    // Fetch latest scan to auto-fill missing fields
    const context = await getContext(userId);
    const latest = context.latestScan || {};

    const inbody = body.inbody_data || {};

    // Map Frontend keys to match Python Pydantic Model GeneratePlanRequest EXACTLY
    const pythonPayload = {
        weight: parseFloat(inbody.weight_kg || body.weight || latest.weight_kg || latest.weight || 0),
        height: parseFloat(inbody.height_cm || body.height || latest.height_cm || latest.height || 0),
        body_fat_pct: parseFloat(inbody.body_fat_pct || body.body_fat_pct || 0),
        body_fat_mass: parseFloat(inbody.body_fat_mass || body.body_fat_mass || 0),
        muscle_mass: parseFloat(inbody.muscle_mass || body.muscle_mass || 0),
        smm: parseFloat(inbody.smm || body.smm || 0),
        protein_mass: parseFloat(inbody.protein_mass || body.protein_mass || 0),
        total_body_water: parseFloat(inbody.total_body_water || body.total_body_water || 0),
        visceral_fat: parseFloat(inbody.visceral_fat || body.visceral_fat || 0),
        bmr: parseFloat(inbody.bmr || body.bmr || calculateCaloriesFallback({
            weight: parseFloat(inbody.weight_kg || body.weight || latest.weight_kg || latest.weight || 70),
            height: parseFloat(inbody.height_cm || body.height || latest.height_cm || latest.height || 170),
            age: parseInt(body.age || latest.age || 25),
            gender: body.gender || latest.gender || "male",
            activity_level: "sedentary" // Calculate base BMR
        }) / 1.2), // calculateCaloriesFallback returns TDEE, divide by 1.2 to get BMR back.
        waist_cm: parseFloat(inbody.waist_cm || body.waist_cm || 90),

        age: parseInt(body.age || latest.age || 25),
        gender: body.gender || latest.gender || "male",
        activity_level: body.activity_level || "moderate",
        training_frequency: parseInt(body.training_frequency || 3),
        allergies: body.allergies || "none",
        disease: body.disease || "none",
        budget: body.budget || "moderate",
        previous_scan: body.previous_scan || null,
    };

    try {
        result = await callAgent('/generate-plan', pythonPayload);
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            throw error;
        }

        result = await buildGeneratePlanFallbackResult(userId, pythonPayload);
    }

    const scan = await userService.createBodyScan(userId, {
        ...body,
        activityLevel: body.activity_level ?? body.activityLevel,
        biologicalAge: result.biological_age ?? result.biologicalAge,
        predictedGoal: result.predicted_goal || result.goal,
        aiNotes: result.plan_text || result.coach_notes || result.coachNotes
    });
    const savedPlan = await persistGeneratedPlan(userId, body, result, scan);
    const response = {
        ...result,
        plan_id: savedPlan.plan_id,
        scan_id: scan.scan_id,
        saved_plan: savedPlan
    };

    await persistAudit(userId, 'generate-plan', body, response);
    return response;
};

const gymChat = async (userId, message, clientHistory = [], sessionId) => {
    const effectiveSessionId = sessionId || crypto.randomUUID();
    let result;

    // Fetch DB context
    const contextData = await getContext(userId);
    const scan = contextData.latestScan || {};
    const plan = contextData.latestPlan || {};

    // Fetch DB history
    const dbHistory = await chatService.getAiChatHistory(userId, effectiveSessionId);
    let history = dbHistory.map(msg => ({
        role: msg.sender_type === 'user' ? 'user' : 'coach',
        content: msg.message_text
    }));

    // Fallback to client history if DB is empty
    if (history.length === 0 && clientHistory.length > 0) {
        history = clientHistory;
    }

    const payload = {
        question: message,
        history: history,
        context: {
            inbody: {
                weight: scan.weight_kg || scan.weight || null,
                body_fat_pct: scan.body_fat_pct || scan.bodyFatPct || null,
                bmr: scan.bmr || null,
                disease: scan.disease || 'none'
            },
            plan_text: plan.plan_text || plan.meal_plan_text ? `${plan.meal_plan_text || ''}\n${plan.workout_plan_text || ''}` : null,
            goal: plan.predicted_goal || plan.goal || null
        }
    };

    try {
        result = await callAgent('/chat', payload);
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            throw error;
        }

        const fallback = await chatService.getAiReply(userId, message);
        result = { ...fallback, source: 'local-fallback' };
    }

    await chatService.storeAiConversation(userId, effectiveSessionId, message, result.reply);

    return {
        ...result,
        session_id: effectiveSessionId
    };
};

const biologicalAge = async (body) => {
    try {
        return await callAgent('/biological-age', body);
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            throw error;
        }

        return {
            biological_age: calculateBiologicalAgeFallback(body),
            source: 'local-fallback'
        };
    }
};

const getDiff = (current, previous, keys) => {
    for (const key of keys) {
        if (current?.[key] != null || previous?.[key] != null) {
            return Number(current?.[key] || 0) - Number(previous?.[key] || 0);
        }
    }
    return 0;
};

const progressAnalysis = async (body) => {
    const currentScan = body.current_scan || body.currentScan || body.current_scan_data;
    const normalizedBody = {
        ...body,
        current_scan: currentScan,
        previous_scan: body.previous_scan || body.previousScan || body.previous_scan_data || currentScan
    };

    try {
        return await callAgent('/progress-analysis', normalizedBody);
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            throw error;
        }

        const current = normalizedBody.current_scan || {};
        const previous = normalizedBody.previous_scan || {};
        return {
            weight_change: Number(getDiff(current, previous, ['weight', 'weight_kg']).toFixed(2)),
            fat_change: Number(getDiff(current, previous, ['body_fat_pct', 'bodyFat', 'body_fat_percentage']).toFixed(2)),
            muscle_change: Number(getDiff(current, previous, ['muscle_mass', 'muscleMass']).toFixed(2)),
            bmi_change: Number(getDiff(current, previous, ['bmi']).toFixed(2)),
            summary: 'Progress tracked successfully',
            source: 'local-fallback'
        };
    }
};

const adaptPlanFallback = async (userId, body) => {
    const currentPlan = toObject(body.current_plan || body.currentPlan);
    const feedback = body.feedback || body.request || body.message || '';
    const adjustments = buildAdaptiveAdjustments(feedback);
    const adaptedPlan = {
        ...currentPlan,
        feedback,
        adjustments,
        updated_at: new Date().toISOString()
    };

    if (typeof currentPlan.plan_text === 'string') {
        adaptedPlan.plan_text = `${currentPlan.plan_text}\n\nPlan adjustments:\n- ${adjustments.join('\n- ')}`;
    }

    return {
        summary: 'Adaptive plan generated successfully',
        adapted_plan: adaptedPlan,
        source: 'local-fallback'
    };
};

const getLatestGeneratedPlan = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 gp.plan_id, gp.user_id, gp.scan_id, gp.predicted_goal, gp.biological_age,
                   gp.total_calories, gp.protein_g, gp.carbs_g, gp.fats_g, gp.activity_level,
                   gp.training_frequency, gp.budget, gp.allergies, gp.disease, gp.meal_plan_text,
                   gp.workout_plan_text, gp.coach_notes, gp.created_at,
                   (
                       SELECT TOP 1 ib.scan_id, ib.user_id, ib.scan_timestamp, ib.activity_level, ib.age,
                              ib.gender, ib.weight_kg, ib.height_cm, ib.body_fat_pct, ib.body_fat_mass,
                              ib.muscle_mass, ib.smm, ib.protein_mass, ib.total_body_water, ib.visceral_fat,
                              ib.bmr, ib.waist_cm, ib.inbody_score, ib.training_frequency, ib.allergies,
                              ib.disease, ib.budget, ib.biological_age, ib.predicted_goal, ib.ai_notes
                       FROM dbo.InBodyScans ib
                       WHERE ib.scan_id = gp.scan_id
                       FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                   ) AS scan_payload
            FROM dbo.generated_plans gp
            WHERE gp.user_id = @userId
            ORDER BY gp.created_at DESC, gp.plan_id DESC
        `);

    return mapGeneratedPlan(result.recordset[0] || null);
};

const getGeneratedPlanHistory = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT gp.plan_id, gp.user_id, gp.scan_id, gp.predicted_goal, gp.biological_age,
                   gp.total_calories, gp.protein_g, gp.carbs_g, gp.fats_g, gp.activity_level,
                   gp.training_frequency, gp.budget, gp.allergies, gp.disease, gp.meal_plan_text,
                   gp.workout_plan_text, gp.coach_notes, gp.created_at
            FROM dbo.generated_plans gp
            WHERE gp.user_id = @userId
            ORDER BY gp.created_at DESC, gp.plan_id DESC
        `);

    return result.recordset.map(mapGeneratedPlan);
};

const getGeneratedPlanById = async (userId, planId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('planId', sql.UniqueIdentifier, normalizePlanId(planId))
        .query(`
            SELECT TOP 1 gp.plan_id, gp.user_id, gp.scan_id, gp.predicted_goal, gp.biological_age,
                   gp.total_calories, gp.protein_g, gp.carbs_g, gp.fats_g, gp.activity_level,
                   gp.training_frequency, gp.budget, gp.allergies, gp.disease, gp.meal_plan_text,
                   gp.workout_plan_text, gp.coach_notes, gp.created_at,
                   (
                       SELECT TOP 1 ib.scan_id, ib.user_id, ib.scan_timestamp, ib.activity_level, ib.age,
                              ib.gender, ib.weight_kg, ib.height_cm, ib.body_fat_pct, ib.body_fat_mass,
                              ib.muscle_mass, ib.smm, ib.protein_mass, ib.total_body_water, ib.visceral_fat,
                              ib.bmr, ib.waist_cm, ib.inbody_score, ib.training_frequency, ib.allergies,
                              ib.disease, ib.budget, ib.biological_age, ib.predicted_goal, ib.ai_notes
                       FROM dbo.InBodyScans ib
                       WHERE ib.scan_id = gp.scan_id
                       FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
                   ) AS scan_payload
            FROM dbo.generated_plans gp
            WHERE gp.user_id = @userId AND gp.plan_id = @planId
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'Generated plan not found');
    }

    return mapGeneratedPlan(result.recordset[0]);
};

const adaptPlan = async (userId, body) => {
    let result;
    try {
        result = await callAgent('/adapt-plan', { ...body, user_id: userId });
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            throw error;
        }

        result = await adaptPlanFallback(userId, body);
    }

    const latestScan = await getLatestUserScan(userId);
    const savedPlan = latestScan ? await persistGeneratedPlan(userId, body, {
        predicted_goal: body.current_plan?.predicted_goal || body.currentPlan?.predicted_goal || latestScan.predicted_goal,
        biological_age: body.current_plan?.biological_age || body.currentPlan?.biological_age || latestScan.biological_age,
        total_calories: body.current_plan?.total_calories || body.currentPlan?.total_calories || null,
        protein_g: body.current_plan?.protein_g || body.currentPlan?.protein_g || null,
        carbs_g: body.current_plan?.carbs_g || body.currentPlan?.carbs_g || null,
        fats_g: body.current_plan?.fats_g || body.currentPlan?.fats_g || null,
        meal_plan_text: result.adapted_plan?.meal_plan_text || result.adapted_plan?.plan_text || null,
        workout_plan_text: result.adapted_plan?.workout_plan_text || result.adapted_plan?.plan_text || null,
        coach_notes: JSON.stringify(result)
    }, latestScan) : null;

    const response = {
        ...result,
        saved_plan: savedPlan
    };

    await persistAudit(userId, 'adapt-plan', body, response);
    return response;
};

const getLatestUserScan = async (userId) => {
    const pool = await poolPromise;
    return userService.getLatestScan(pool, userId);
};

const getLatestScan = async (userId) => {
    return getLatestUserScan(userId);
};

const getScanHistory = async (userId) => {
    return userService.listScans(userId);
};

const getPublicLatestScan = async ({ userId, email }) => {
    const pool = await poolPromise;
    let resolvedUserId = null;

    if (userId != null) {
        resolvedUserId = Number(userId);
    } else if (email) {
        const userResult = await pool.request()
            .input('email', sql.VarChar(150), String(email).trim())
            .query(`
                SELECT TOP 1 user_id
                FROM dbo.users
                WHERE email = @email
            `);

        if (userResult.recordset.length === 0) {
            throw new ApiError(404, 'User not found');
        }

        resolvedUserId = Number(userResult.recordset[0].user_id);
    }

    const latestScan = await userService.getLatestScan(pool, resolvedUserId);
    if (!latestScan) {
        throw new ApiError(404, 'No InBody scan found for this user');
    }

    return latestScan;
};

const getChatHistory = async (userId, sessionId) => chatService.getAiChatHistory(userId, sessionId);

const getChatSessions = async (userId) => chatService.listAiChatSessions(userId);

const buildReportLinesFromPlan = (profile, plan) => {
    const scan = plan?.scan || profile.latestBodyRecord || {};
    return [
        `User: ${profile.username}`,
        `Email: ${profile.email}`,
        `Generated: ${new Date().toISOString()}`,
        `Goal: ${plan?.predicted_goal || scan.predicted_goal || 'n/a'}`,
        `Latest weight: ${scan.weight || scan.weight_kg || 'n/a'} kg`,
        `Latest BMI: ${scan.bmi || userService.calculateBmi(scan.weight_kg, scan.height_cm) || 'n/a'}`,
        `Biological age: ${plan?.biological_age || scan.biological_age || 'n/a'}`,
        `Calories: ${plan?.total_calories || 'n/a'}`,
        `Protein: ${plan?.protein_g || 'n/a'} g`,
        `Carbs: ${plan?.carbs_g || 'n/a'} g`,
        `Fats: ${plan?.fats_g || 'n/a'} g`,
        `Meal plan: ${String(plan?.meal_plan_text || '').slice(0, 120) || 'n/a'}`,
        `Workout plan: ${String(plan?.workout_plan_text || '').slice(0, 120) || 'n/a'}`
    ];
};

const exportPdf = async (userId, body = {}) => {
    const planId = normalizePlanId(body.plan_id || body.planId);
    let plan = null;

    if (planId) {
        try {
            plan = await getGeneratedPlanById(userId, planId);
        } catch (_) { }
    } else {
        try {
            plan = await getLatestGeneratedPlan(userId);
        } catch (_) { }
    }

    try {
        let pdfPayload = { ...body, plan_id: planId, user_id: userId };
        if (plan) {
            const scan = plan.scan || {};
            // ✅ FIX: Convert stored JSON arrays back to readable Markdown text
            // meal_plan_text and workout_plan_text may be stored as JSON strings in DB
            const mealMarkdown = planFieldToMarkdown(plan.meal_plan_text, 'meals');
            const workoutMarkdown = planFieldToMarkdown(plan.workout_plan_text, 'workout');
            const planText = `${mealMarkdown}\n\n${workoutMarkdown}`.trim();

            pdfPayload = {
                ...pdfPayload,
                weight: scan.weight_kg || scan.weight || plan.weight || 0,
                height: scan.height_cm || scan.height || plan.height || 0,
                age: scan.age || plan.age || 25,
                biological_age: plan.biological_age || scan.biological_age || null, // Python accepts null
                gender: scan.gender || plan.gender || 'male',
                body_fat_pct: scan.body_fat_pct || plan.body_fat_pct || 0,
                body_fat_mass: scan.body_fat_mass || plan.body_fat_mass || 0,
                muscle_mass: scan.muscle_mass || plan.muscle_mass || 0,
                smm: scan.smm || plan.smm || 0,
                visceral_fat: scan.visceral_fat || plan.visceral_fat || 0,
                bmr: scan.bmr || plan.bmr || 0,
                total_body_water: scan.total_body_water || plan.total_body_water || 0,
                goal: plan.predicted_goal || plan.goal || 'balanced',
                calories: plan.total_calories || plan.calories || 0,
                protein: plan.protein_g || plan.protein || 0,
                carbs: plan.carbs_g || plan.carbs || 0,
                fat: plan.fats_g || plan.fat || 0,
                plan_text: planText || 'No plan data available.'
            };
        }
        return await callAgent('/generate-pdf', pdfPayload, 'buffer');
    } catch (error) {
        if (!isAgentUnavailable(error)) {
            if (planId) {
                try {
                    return await callAgent('/generate-report', { plan_id: planId, user_id: userId }, 'buffer');
                } catch (nestedError) {
                    if (!isAgentUnavailable(nestedError)) {
                        throw nestedError;
                    }
                }
            } else {
                throw error;
            }
        }

        const profile = await userService.getProfile(userId);
        const userData = toObject(body.user_data || body.userData);
        const reportData = toObject(body.report_data || body.reportData);
        const lines = plan
            ? buildReportLinesFromPlan(profile, plan)
            : [
                `User: ${userData.username || profile.username}`,
                `Email: ${userData.email || profile.email}`,
                `Generated: ${new Date().toISOString()}`,
                `Latest weight: ${userData.weight || profile.latestBodyRecord?.weight || 'n/a'} kg`,
                `Latest BMI: ${userData.bmi || profile.latestBodyRecord?.bmi || 'n/a'}`,
                `Biological age: ${body.biological_age || reportData.biological_age || 'n/a'}`
            ];

        if (!plan) {
            if (body.meal_plan || reportData.meal_plan) {
                lines.push(`Meal plan: ${String(body.meal_plan || reportData.meal_plan).slice(0, 120)}`);
            }

            if (body.workout_plan || reportData.workout_plan) {
                lines.push(`Workout plan: ${String(body.workout_plan || reportData.workout_plan).slice(0, 120)}`);
            }

            if (body.plan_text || reportData.plan_text) {
                lines.push(`Plan text: ${String(body.plan_text || reportData.plan_text).slice(0, 120)}`);
            }
        }

        lines.push('This report was generated using the local fallback engine.');
        return buildPdfBuffer(`SmartGym Report - Plan ${planId || 'custom'}`, lines);
    }
};

module.exports = {
    getContext,
    generatePlans,
    chat,
    generatePlan,
    gymChat,
    biologicalAge,
    progressAnalysis,
    adaptPlan,
    getLatestScan,
    getScanHistory,
    getPublicLatestScan,
    getLatestGeneratedPlan,
    getGeneratedPlanHistory,
    getGeneratedPlanById,
    getChatHistory,
    getChatSessions,
    generateReport: (userId, planId) => exportPdf(userId, { plan_id: planId }),
    exportPdf,
    saveGeneratedPlanFromAgent: async (userId, data) => {
        const { plan_data = {}, inbody_data = {} } = data;
        const scan = await userService.createBodyScan(userId, {
            ...inbody_data,
            activityLevel: inbody_data.activity_level ?? inbody_data.activityLevel,
            biologicalAge: plan_data.biological_age ?? plan_data.biologicalAge,
            predictedGoal: plan_data.predicted_goal || plan_data.goal,
            aiNotes: plan_data.plan_text || plan_data.coach_notes || plan_data.coachNotes
        });
        const savedPlan = await persistGeneratedPlan(userId, inbody_data, plan_data, scan);
        const response = {
            ...plan_data,
            plan_id: savedPlan.plan_id,
            scan_id: scan.scan_id,
            saved_plan: savedPlan
        };
        await persistAudit(userId, 'save-agent-plan', data, response);
        return response;
    }
};
