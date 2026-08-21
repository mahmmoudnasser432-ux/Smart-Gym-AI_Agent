const { callAgent } = require('../utils/aiAgentClient');
const userService = require('./userService');
const { sql, poolPromise } = require('../config/db');
const { withAllocatedIntId } = require('../utils/idAllocator');
const { safeParse } = require('../utils/json');

/**
 * Normalizes input keys and merges with scan to match AI server payload
 */
const preparePayloadForAgent = (scan, body) => {
    return {
        weight: scan.weight_kg || scan.weight || 0,
        height: scan.height_cm || scan.height || 0,
        age: body.age || scan.age || 0,
        gender: body.gender || scan.gender || 'male',
        body_fat_mass: scan.body_fat_mass || 0,
        body_fat_pct: scan.body_fat_pct || 0,
        total_body_water: scan.total_body_water || 0,
        protein_mass: scan.protein_mass || 0,
        smm: scan.smm || 0,
        visceral_fat: scan.visceral_fat || 0,
        muscle_mass: scan.muscle_mass || 0,
        bmr: scan.bmr || 0,
        waist_cm: scan.waist_cm || 0,
        activity_level: body.activity_level || body.activityLevel || 'moderate',
        training_frequency: body.training_days || body.trainingDays || body.training_frequency || 3,
        allergies: body.allergies || '',
        disease: body.disease || body.diseases || '',
        budget: body.budget || body.budgetLevel || 'moderate',
        // ✅ FIX: Pass previous_scan so AI can generate InBody Progress comparison
        previous_scan: body.previous_scan || body.previousScan || null,
    };
};

const buildFallbackPlan = (scan, body) => {
    return {
        status: "success",
        plan_text: "MEAL PLAN\nBreakfast: Oats and eggs\n...",
        // Root properties for UI directly
        predicted_goal: 'Fat Loss & Muscle Toning',
        biological_age: body.age || 25,
        total_calories: 2200,
        calories: 2200,
        protein_g: 150,
        protein: 150,
        carbs_g: 200,
        carbs: 200,
        fats_g: 70,
        fat: 70,
        goal: 'fat_loss',
        bmi: 24,
        plan_data: {
            predicted_goal: 'Fat Loss & Muscle Toning',
            biological_age: body.age || 25,
            total_calories: 2200,
            calories: 2200,
            protein_g: 150,
            protein: 150,
            carbs_g: 200,
            carbs: 200,
            fats_g: 70,
            fat: 70,
            goal: 'fat_loss'
        },
        agent_data: {
            predicted_goal: 'Fat Loss & Muscle Toning',
            biological_age: body.age || 25,
            total_calories: 2200,
            calories: 2200,
            protein_g: 150,
            protein: 150,
            carbs_g: 200,
            carbs: 200,
            fats_g: 70,
            fat: 70,
            goal: 'fat_loss'
        },
        parsed_plan: {
            meals: [
                {
                    meal_name: "BREAKFAST",
                    options: [
                        { option: "A", title: "Oats and eggs", ingredients: "50g oats, 3 eggs", calories: 400, macros: "P:30g C:45g F:15g" }
                    ]
                },
                {
                    meal_name: "LUNCH",
                    options: [
                        { option: "A", title: "Chicken and Rice", ingredients: "150g chicken, 100g rice", calories: 600, macros: "P:45g C:70g F:10g" }
                    ]
                }
            ],
            // ✅ FIX: workout_plan must be Array of Objects matching Python response shape
            // Flutter expects: [{ day_name: String, exercises: String[] }]
            workout_plan: [
                {
                    day_name: "Day 1 — Upper Body",
                    exercises: ["Pushups — 3 x 15", "Pullups — 3 x 8", "Dumbbell Rows — 3 x 12"]
                },
                {
                    day_name: "Day 2 — Lower Body",
                    exercises: ["Squats — 3 x 12", "Lunges — 3 x 10", "Calf Raises — 3 x 15"]
                },
                {
                    day_name: "Day 3 — Core & Cardio",
                    exercises: ["Plank — 3 x 45 seconds", "Crunches — 3 x 20", "30 min walking"]
                }
            ],
            coach_notes: [
                "Stay hydrated! Drink at least 2L of water daily.",
                "Consistency is key — stick to your schedule.",
                "Prioritize sleep (7-9 hours) for optimal recovery."
            ]
        },
        source: 'local-fallback'
    };
};

const parsePlanTextIfNeeded = (result) => {
    if (result && (result.plan_text || result.meal_plan_text || result.workout_plan_text) && result.total_calories == null) {
        const text = result.plan_text || result.meal_plan_text || result.workout_plan_text || '';

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

const generatePlan = async (userId, scanId, body) => {
    const scan = await userService.getScanById(userId, scanId);
    const payload = preparePayloadForAgent(scan, body);

    let aiResponse;
    try {
        aiResponse = await callAgent('/generate-plan', payload);
        aiResponse = parsePlanTextIfNeeded(aiResponse);
    } catch (error) {
        console.error('AI Agent Error:', error.message);
        // Fallback so the app doesn't break if the AI server is offline or times out
        aiResponse = buildFallbackPlan(scan, body);
    }

    return {
        ...aiResponse,
        scan_id: scanId,
        user_id: userId,
        inputs: payload
    };
};

const saveGeneratedPlan = async (userId, scanId, aiResponse) => {
    const pool = await poolPromise;

    // Support nested structure from Flutter, flat structure from Angular, or new plan_data structure
    const dailyTarget = aiResponse.dailyTarget || {};
    const planData = aiResponse.plan_data || {};
    const parsedPlan = aiResponse.parsed_plan || {};

    // Fallbacks to handle any of the 3 formats (old, intermediate, new)
    const getField = (...keys) => {
        for (let key of keys) {
            if (planData[key] !== undefined) return planData[key];
            if (parsedPlan[key] !== undefined) return parsedPlan[key];
            if (aiResponse[key] !== undefined) return aiResponse[key];
            if (dailyTarget[key] !== undefined) return dailyTarget[key];
        }
        return null;
    };

    // Convert meals array back to string or JSON string to store in DB
    let mealText = null;
    const mealsArray = parsedPlan.meals || aiResponse.meals;
    if (Array.isArray(mealsArray)) {
        mealText = JSON.stringify(mealsArray);
    } else {
        mealText = aiResponse.meal_plan_text || aiResponse.mealPlanText || aiResponse.plan_text || null;
    }

    // Convert workoutDays array back to string or JSON string
    let workoutText = null;
    const workoutArray = parsedPlan.workout_plan || aiResponse.workoutDays || aiResponse.workout_plan;
    if (Array.isArray(workoutArray)) {
        workoutText = JSON.stringify(workoutArray);
    } else {
        workoutText = aiResponse.workout_plan_text || aiResponse.workoutPlanText || aiResponse.plan_text || null;
    }

    // Convert coach notes back to string if it's an array
    let coachNotesText = null;
    const notesArray = parsedPlan.coach_notes || aiResponse.coachNotes || aiResponse.coach_notes;
    if (Array.isArray(notesArray)) {
        coachNotesText = notesArray.join('\n');
    } else {
        coachNotesText = aiResponse.coachNotes || aiResponse.coach_notes || null;
    }

    const request = pool.request()
        .input('userId', sql.Int, userId)
        .input('scanId', sql.UniqueIdentifier, scanId)
        .input('predictedGoal', sql.VarChar(100), getField('predicted_goal', 'predictedGoal', 'goal', 'bodyType'))
        .input('biologicalAge', sql.Float, getField('biological_age', 'biologicalAge'))
        .input('totalCalories', sql.Int, getField('total_calories', 'totalCalories', 'calories'))
        .input('proteinG', sql.Int, getField('protein_g', 'proteinG', 'protein'))
        .input('carbsG', sql.Int, getField('carbs_g', 'carbsG', 'carbs'))
        .input('fatsG', sql.Int, getField('fats_g', 'fatsG', 'fats', 'fat'))
        .input('activityLevel', sql.NVarChar(20), getField('activity_level', 'activityLevel') || aiResponse.inputs?.activity_level || 'moderate')
        .input('trainingFrequency', sql.Int, getField('training_frequency', 'trainingFrequency') || aiResponse.inputs?.training_frequency || 3)
        .input('budget', sql.NVarChar(10), getField('budget') || aiResponse.inputs?.budget || 'moderate')
        .input('allergies', sql.NVarChar(sql.MAX), getField('allergies') || aiResponse.inputs?.allergies || null)
        .input('disease', sql.NVarChar(sql.MAX), getField('disease') || aiResponse.inputs?.disease || null)
        .input('mealPlanText', sql.NVarChar(sql.MAX), mealText)
        .input('workoutPlanText', sql.NVarChar(sql.MAX), workoutText)
        .input('coachNotes', sql.NVarChar(sql.MAX), coachNotesText);

    const dbResult = await request.query(`
        INSERT INTO dbo.generated_plans (
            user_id, scan_id, predicted_goal, biological_age, total_calories, protein_g, carbs_g, fats_g,
            activity_level, training_frequency, budget, allergies, disease, meal_plan_text, workout_plan_text,
            coach_notes, created_at
        )
        OUTPUT INSERTED.plan_id
        VALUES (
            @userId, @scanId, @predictedGoal, @biologicalAge, @totalCalories, @proteinG, @carbsG, @fatsG,
            @activityLevel, @trainingFrequency, @budget, @allergies, @disease, @mealPlanText, @workoutPlanText,
            @coachNotes, GETDATE()
        )
    `);

    return {
        saved: true,
        plan_id: dbResult.recordset[0].plan_id
    };
};

const getGeneratedPlanById = async (userId, planId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .input('planId', sql.UniqueIdentifier, planId)
        .query(`
            SELECT * FROM dbo.generated_plans
            WHERE user_id = @userId AND plan_id = @planId
        `);

    if (result.recordset.length === 0) {
        throw new Error('Plan not found');
    }
    return result.recordset[0];
};

/**
 * Converts a stored plan field (which may be a JSON array or plain text)
 * back into a human-readable Markdown string suitable for the Python PDF generator.
 * @param {string|null} stored - The value from DB (may be JSON array or plain text)
 * @param {'meals'|'workout'} type - How to format if it IS a JSON array
 * @returns {string}
 */
const planFieldToText = (stored, type) => {
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
            const days = parsed.map(day => {
                // Handle both Object format {day_name, exercises} and String format
                if (typeof day === 'string') return day;
                const header = day.day_name || 'Day';
                const exs = (day.exercises || []).map(e => `- ${e}`).join('\n');
                return `${header}\n${exs}`;
            }).join('\n\n');
            // The PDF exporter (_parse_plan) only renders the workout when the text
            // contains a literal "WORKOUT PLAN" section header — without it the days
            // are dropped and the PDF shows meals only. Prepend it.
            return days ? `WORKOUT PLAN\n${days}` : '';
        }
    } catch (_) {
        // Not JSON — return as-is (plain text from older records)
    }
    return String(stored);
};

const generatePdf = async (userId, planId) => {
    const plan = await getGeneratedPlanById(userId, planId);
    let scan = {};
    try {
        scan = await userService.getScanById(userId, plan.scan_id);
    } catch (err) {
        // Fallback if scan not found
    }

    // ✅ FIX: Convert stored JSON arrays back to readable Markdown text
    // The DB stores meals/workout as JSON strings (from saveGeneratedPlan)
    // but the Python PDF generator expects human-readable Markdown text.
    const mealText = planFieldToText(plan.meal_plan_text, 'meals');
    const workoutText = planFieldToText(plan.workout_plan_text, 'workout');
    const planText = `${mealText}\n\n${workoutText}`.trim();

    const payload = {
        weight: scan.weight_kg || scan.weight || 80,
        height: scan.height_cm || scan.height || 175,
        age: scan.age || 25,
        biological_age: plan.biological_age || null, // Python now accepts null → falls back to age
        gender: scan.gender || 'Male',
        body_fat_pct: scan.body_fat_pct || scan.bodyFatPct || 18,
        body_fat_mass: scan.body_fat_mass || scan.bodyFatMass || 14,
        muscle_mass: scan.muscle_mass || scan.muscleMass || 34,
        smm: scan.smm || 32,
        visceral_fat: scan.visceral_fat || scan.visceralFat || 8,
        bmr: scan.bmr || 1750,
        total_body_water: scan.total_body_water || scan.totalBodyWater || 45,
        goal: plan.predicted_goal || plan.goal || 'balanced',
        calories: plan.total_calories || plan.calories || 2500,
        protein: plan.protein_g || plan.protein || 150,
        carbs: plan.carbs_g || plan.carbs || 200,
        fat: plan.fats_g || plan.fats || plan.fat || 70,
        plan_text: planText || 'No plan data available.'
    };

    // Use the generate-pdf endpoint on the Python AI server
    const pdfBuffer = await callAgent('/generate-pdf', payload, 'buffer');

    return pdfBuffer;
};

module.exports = {
    generatePlan,
    saveGeneratedPlan,
    generatePdf
};
