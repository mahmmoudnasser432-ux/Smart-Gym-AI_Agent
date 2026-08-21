const { canUseLlm, completeJson } = require('./llmClient');

const fallback = ({ message, profile }) => {
    const username = profile?.username || 'athlete';
    const q = (message || '').toLowerCase();

    if (q.includes('diet') || q.includes('meal') || q.includes('eat') || q.includes('food') || q.includes('calorie') || q.includes('nutrition')) {
        return { reply: `Hi ${username}! For nutrition: focus on high-protein foods (chicken, eggs, tuna, lentils), complex carbs (rice, oats, sweet potato) and healthy fats (olive oil, almonds). Time your largest meal 1-2h before training and consume protein within 30 min after workout. Stay hydrated — aim for 2-3L of water daily.` };
    }
    if (q.includes('injury') || q.includes('pain') || q.includes('hurt') || q.includes('sore')) {
        return { reply: `Hi ${username}! For injuries: stop training the affected area immediately. Apply RICE protocol (Rest, Ice, Compression, Elevation) for acute injuries. For chronic soreness, light stretching and foam rolling can help. If pain persists more than 3 days or is severe, please consult a physiotherapist or doctor before returning to training.` };
    }
    if (q.includes('workout') || q.includes('exercise') || q.includes('train') || q.includes('gym') || q.includes('muscle')) {
        return { reply: `Hi ${username}! Key training principles: Progressive overload is king — add weight or reps each week. Prioritise compound movements (squat, deadlift, bench, rows). Ensure proper sleep (7-9h) for muscle recovery. Track your lifts to measure progress. Warm up 5-10 min before heavy sets to prevent injury.` };
    }
    if (q.includes('fat') || q.includes('weight') || q.includes('lose') || q.includes('slim') || q.includes('cut')) {
        return { reply: `Hi ${username}! For fat loss: create a modest calorie deficit (300-500 kcal/day) — don't crash diet. Maintain high protein (1.8-2.2g per kg body weight) to preserve muscle. Combine strength training with cardio. Track your food intake for at least 2 weeks to understand your eating patterns.` };
    }
    if (q.includes('supplement') || q.includes('protein powder') || q.includes('creatine') || q.includes('pre-workout')) {
        return { reply: `Hi ${username}! Most important supplements: Creatine Monohydrate (5g/day) — proven to increase strength and muscle. Whey Protein — convenient way to hit protein targets. Vitamin D + Magnesium — most athletes are deficient. Skip the fancy marketing claims; whole food nutrition always comes first.` };
    }
    // Generic fallback
    return { reply: `Hi ${username}! I'm your AI fitness coach. I can help with: training programs, meal planning, fat loss, muscle gain, injury advice and supplement guidance. What specific fitness question can I help you with today?` };
};

module.exports = async ({ message, profile }) => {
    if (!canUseLlm()) {
        return fallback({ message, profile });
    }

    const result = await completeJson({
        systemPrompt: 'You are a gym AI assistant. Return valid JSON only.',
        userPrompt: JSON.stringify({
            task: 'Answer a user fitness question safely and concisely',
            profile: {
                username: profile?.username,
                latestBodyRecord: profile?.latestBodyRecord,
                bodyMetadata: profile?.bodyMetadata
            },
            message,
            responseShape: {
                reply: 'string'
            }
        })
    });

    return result;
};
