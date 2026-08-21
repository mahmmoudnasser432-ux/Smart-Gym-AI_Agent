const { sql, poolPromise } = require('../config/db');
const { buildWorkoutPlan } = require('../ai-agent/planGenerator');
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

    const plan = await buildWorkoutPlan({ goal, profile, bodyData: payload });
    const description = JSON.stringify(plan);
    const scheduleIdAllocation = await withAllocatedIntId(pool, 'dbo.training_schedule', 'schedule_id', 'scheduleId');
    await scheduleIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('title', sql.VarChar, plan.summary)
        .input('description', sql.VarChar, description)
        .input('startDate', sql.Date, plan.startDate)
        .input('endDate', sql.Date, plan.endDate)
        .query(`
            INSERT INTO dbo.training_schedule (schedule_id, user_id, title, description, start_date, end_date)
            VALUES (@scheduleId, @userId, @title, @description, @startDate, @endDate)
        `);

    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar, 'workout_generation')
        .input('input', sql.VarChar, JSON.stringify(payload))
        .input('output', sql.VarChar, description)
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
            SELECT TOP 1 schedule_id, title, description, start_date, end_date
            FROM dbo.training_schedule
            WHERE user_id = @userId
            ORDER BY start_date DESC, schedule_id DESC
        `);

    if (result.recordset.length === 0) {
        throw new ApiError(404, 'No workout plan found');
    }

    const row = result.recordset[0];
    return { ...row, details: JSON.parse(row.description) };
};

const getHistory = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT schedule_id, title, description, start_date, end_date
            FROM dbo.training_schedule
            WHERE user_id = @userId
            ORDER BY start_date DESC, schedule_id DESC
        `);

    return result.recordset.map((row) => ({ ...row, details: JSON.parse(row.description) }));
};

const updateProgress = async (userId, payload) => {
    const pool = await poolPromise;
    const interactionIdAllocation = await withAllocatedIntId(pool, 'dbo.ai_agent_interaction', 'ai_id', 'interactionId');
    await interactionIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('type', sql.VarChar, 'workout_progress_update')
        .input('input', sql.VarChar, JSON.stringify(payload))
        .input('output', sql.VarChar, JSON.stringify({ saved: true }))
        .query(`
            INSERT INTO dbo.ai_agent_interaction (ai_id, user_id, interaction_type, input_summary, output_summary, created_at)
            VALUES (@interactionId, @userId, @type, @input, @output, GETDATE())
        `);

    return { saved: true };
};

module.exports = { generate, getCurrent, getHistory, updateProgress };
