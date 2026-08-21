const { sql, poolPromise } = require('./src/config/db');
const aiService = require('./src/services/aiService');

async function test() {
    try {
        console.log("Waiting for DB connection...");
        await poolPromise;
        console.log("DB connected!");

        const userId = 6;
        const payload = {
            goal: "fat_loss",
            training_frequency: 3,
            dietary_preferences: "none",
            weight: 90,
            height: 180,
            age: 25,
            gender: 'male',
            body_fat_pct: 20
        };
        
        console.log(`Testing generatePlan for user_id=${userId} with payload=`, payload);
        const result = await aiService.generatePlan(userId, payload);
        console.log("Success! Generated Plan:");
        console.log(JSON.stringify(result, null, 2));

    } catch (err) {
        console.error("Integration Test Failed:");
        console.error(err);
    } finally {
        await sql.close();
        process.exit();
    }
}

test();
