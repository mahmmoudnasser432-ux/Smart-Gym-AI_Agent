const assert = require('node:assert/strict');
const app = require('../src/app');

const startServer = () => new Promise((resolve) => {
    const server = app.listen(0, () => {
        const address = server.address();
        resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
});

const closeServer = (server) => new Promise((resolve) => server.close(resolve));

async function registerAndLogin(baseUrl, suffix) {
    const email = `smoke_${Date.now()}_${suffix}@smartgym.local`;
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Smoke User',
            email,
            password: 'Pass123!',
            phone: '01000000000'
        })
    });
    assert.equal(registerResponse.status, 201);
    const payload = await registerResponse.json();
    return { token: payload.data.token, email };
}

async function run() {
    const { server, baseUrl } = await startServer();

    try {
        const healthRes = await fetch(`${baseUrl}/health`);
        assert.equal(healthRes.status, 200);

        const { token } = await registerAndLogin(baseUrl, 'user');
        const authHeaders = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const profileRes = await fetch(`${baseUrl}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(profileRes.status, 200);

        const tokenBalanceRes = await fetch(`${baseUrl}/api/tokens/balance`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(tokenBalanceRes.status, 200);

        const subscriptionRes = await fetch(`${baseUrl}/api/subscriptions/subscribe`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                planName: 'Premium',
                durationMonths: 1,
                amount: 499,
                renewalType: 'manual'
            })
        });
        assert.equal(subscriptionRes.status, 201);

        const feedbackRes = await fetch(`${baseUrl}/api/feedback`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                subject: 'Smoke',
                message: 'Smoke runner feedback',
                rating: 5
            })
        });
        assert.equal(feedbackRes.status, 201);

        const aiPlanRes = await fetch(`${baseUrl}/api/ai/generate-plan`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                weight: 80,
                height: 175,
                age: 26,
                gender: 'male',
                activity_level: 'moderate',
                body_fat_pct: 18,
                training_frequency: 4,
                allergies: 'none',
                disease: 'none',
                budget: 'moderate'
            })
        });
        assert.equal(aiPlanRes.status, 201);
        const aiPlanPayload = await aiPlanRes.json();
        assert.ok(aiPlanPayload.data.plan_id);

        const latestPlanRes = await fetch(`${baseUrl}/api/ai/plans/latest`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(latestPlanRes.status, 200);

        const aiChatRes = await fetch(`${baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ message: 'Give me a recovery tip after training.' })
        });
        assert.equal(aiChatRes.status, 200);
        const aiChatPayload = await aiChatRes.json();
        assert.ok(aiChatPayload.data.session_id);

        const aiHistoryRes = await fetch(`${baseUrl}/api/ai/chat/history?sessionId=${encodeURIComponent(aiChatPayload.data.session_id)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(aiHistoryRes.status, 200);

        const aiReportRes = await fetch(`${baseUrl}/api/ai/generate-report`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ plan_id: aiPlanPayload.data.plan_id })
        });
        assert.equal(aiReportRes.status, 200);
        assert.equal(aiReportRes.headers.get('content-type'), 'application/pdf');

        console.log('SMOKE_TESTS_PASSED');
    } finally {
        await closeServer(server);
    }
}

run().catch((error) => {
    console.error('SMOKE_TESTS_FAILED');
    console.error(error);
    process.exit(1);
});
