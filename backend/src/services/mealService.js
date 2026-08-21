const { sql, poolPromise } = require('../config/db');
const { buildMealPlan } = require('../ai-agent/planGenerator');
const goalPredictor = require('../ai-agent/goalPredictor');
const userService = require('./userService');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

const generate = async (userId, payload) => {
    const pool = await poolPromise;
    const profile = await userService.getProfile(userId);
    const latestBody = profile.latestBodyRecord || {};
    const bodyFatValue = payload.bodyFat ?? latestBody.body_fat_percentage;
    const goal = goalPredictor({
        bodyFat: bodyFatValue != null ? Number(bodyFatValue) : undefined,
        bmi: latestBody.bmi ? Number(latestBody.bmi) : undefined,
        goal: payload.goal || profile.bodyMetadata?.fitnessGoal
    });

    const plan = await buildMealPlan({ goal, profile, bodyData: payload });
    const details = JSON.stringify(plan);

    const dietIdAllocation = await withAllocatedIntId(pool, 'dbo.dietplan', 'diet_id', 'dietId');
    await dietIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('details', sql.VarChar, details)
        .input('startDate', sql.Date, plan.startDate)
        .input('endDate', sql.Date, plan.endDate)
        .query(`
            INSERT INTO dbo.dietplan (diet_id, user_id, details, start_date, end_date)
            VALUES (@dietId, @userId, @details, @startDate, @endDate)
        `);

    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar, 'meal_generation')
        .input('input', sql.VarChar, JSON.stringify(payload))
        .input('output', sql.VarChar, details)
        .query(`
            INSERT INTO dbo.ai_agent_interaction (ai_id, user_id, interaction_type, input_summary, output_summary, created_at)
            VALUES (@interactionId, @userId, @type, @input, @output, GETDATE())
        `);

    return plan;
};

const getCurrent = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT TOP 1 diet_id, details, start_date, end_date
            FROM dbo.dietplan
            WHERE user_id = @userId
            ORDER BY start_date DESC, diet_id DESC
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'No meal plan found');
    }

    const row = result.recordset[0];
    return { ...row, details: JSON.parse(row.details) };
};

const getHistory = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT diet_id, details, start_date, end_date
            FROM dbo.dietplan
            WHERE user_id = @userId
            ORDER BY start_date DESC, diet_id DESC
        `);

    return result.recordset.map((row) => ({ ...row, details: JSON.parse(row.details) }));
};

module.exports = { generate, getCurrent, getHistory };
