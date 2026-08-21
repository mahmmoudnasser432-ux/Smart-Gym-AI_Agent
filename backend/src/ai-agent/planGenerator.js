const { addDays } = require('../utils/date');
const { completeJson, canUseLlm } = require('./llmClient');

const fallbackWorkoutPlan = (context) => ({
    summary: `AI-generated ${context.goal} workout plan`,
    goal: context.goal,
    weeklyPlan: [
        { day: 'Day 1', title: 'Strength Foundation', exercises: ['Squat 4x8', 'Bench Press 4x8', 'Rows 4x10'] },
        { day: 'Day 2', title: 'Conditioning', exercises: ['Bike 20 min', 'Burpees 3x12', 'Core Circuit 3 rounds'] },
        { day: 'Day 3', title: 'Recovery', exercises: ['Mobility 20 min', 'Walking 30 min'] },
        { day: 'Day 4', title: 'Upper Focus', exercises: ['Pull Down 4x10', 'Shoulder Press 4x10', 'Push Ups 3x15'] },
        { day: 'Day 5', title: 'Lower Focus', exercises: ['Leg Press 4x12', 'RDL 4x10', 'Lunges 3x12'] }
    ],
    startDate: new Date(),
    endDate: addDays(new Date(), 28)
});

const fallbackMealPlan = (context) => {
    const calories = context.goal === 'fat loss' ? 2100 : context.goal === 'muscle gain' ? 2900 : 2500;

    return {
        summary: `AI-generated ${context.goal} meal plan`,
        goal: context.goal,
        targetCalories: calories,
        meals: [
            { name: 'Breakfast', items: ['Oats', 'Greek yogurt', 'Banana'] },
            { name: 'Lunch', items: ['Chicken breast', 'Rice', 'Mixed vegetables'] },
            { name: 'Snack', items: ['Protein shake', 'Nuts'] },
            { name: 'Dinner', items: ['Salmon', 'Sweet potato', 'Salad'] }
        ],
        startDate: new Date(),
        endDate: addDays(new Date(), 14)
    };
};

const buildWorkoutPlan = async (context) => {
    if (!canUseLlm()) {
        return fallbackWorkoutPlan(context);
    }

    const result = await completeJson({
        systemPrompt: 'You are a fitness planning AI. Return valid JSON only.',
        userPrompt: JSON.stringify({
            task: 'Generate a personalized workout plan',
            goal: context.goal,
            bodyData: context.bodyData,
            responseShape: {
                summary: 'string',
                goal: 'string',
                weeklyPlan: [{ day: 'string', title: 'string', exercises: ['string'] }]
            }
        })
    });

    return {
        ...result,
        startDate: new Date(),
        endDate: addDays(new Date(), 28)
    };
};

const buildMealPlan = async (context) => {
    if (!canUseLlm()) {
        return fallbackMealPlan(context);
    }

    const result = await completeJson({
        systemPrompt: 'You are a sports nutrition AI. Return valid JSON only.',
        userPrompt: JSON.stringify({
            task: 'Generate a personalized meal plan',
            goal: context.goal,
            bodyData: context.bodyData,
            responseShape: {
                summary: 'string',
                goal: 'string',
                targetCalories: 'number',
                meals: [{ name: 'string', items: ['string'] }]
            }
        })
    });

    return {
        ...result,
        startDate: new Date(),
        endDate: addDays(new Date(), 14)
    };
};

module.exports = { buildWorkoutPlan, buildMealPlan };
