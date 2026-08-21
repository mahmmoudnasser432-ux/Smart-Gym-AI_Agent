const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

const startServer = () => new Promise((resolve) => {
    const server = app.listen(0, () => {
        const address = server.address();
        resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function registerAndLogin(baseUrl, suffix = '') {
    const email = `auto_${Date.now()}${suffix}@smartgym.local`;
    const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'Auto Test User',
            email,
            password: 'Pass123!',
            phone: '01111111111'
        })
    });
    assert.equal(reg.status, 201, 'Registration should return 201');
    const regPayload = await reg.json();
    return { token: regPayload.data.token, email };
}

async function loginAdmin(baseUrl) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@smartgym.com', password: 'Admin123!', role: 'admin' })
    });
    if (res.status !== 200) return null;
    const payload = await res.json();
    return payload.data?.token || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Health & Docs
// ─────────────────────────────────────────────────────────────────────────────
test('health and docs endpoints are available', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const healthResponse = await fetch(`${baseUrl}/health`);
        const docsResponse = await fetch(`${baseUrl}/api/docs`);

        assert.equal(healthResponse.status, 200);
        assert.equal(docsResponse.status, 200);

        const healthPayload = await healthResponse.json();
        assert.equal(healthPayload.status, 'success');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Register + Login flow
// ─────────────────────────────────────────────────────────────────────────────
test('register and login flow works', async () => {
    const { server, baseUrl } = await startServer();
    const email = `test${Date.now()}@smartgym.local`;

    try {
        const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'Integration User',
                email,
                password: 'Pass123!',
                phone: '01000000000'
            })
        });
        assert.equal(registerResponse.status, 201);

        const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: 'Pass123!' })
        });
        assert.equal(loginResponse.status, 200);
        const payload = await loginResponse.json();
        assert.equal(payload.status, 'success');
        assert.ok(payload.data.token, 'Token should be returned on login');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Authenticated profile endpoint
// ─────────────────────────────────────────────────────────────────────────────
test('authenticated profile endpoint returns user data', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token, email } = await registerAndLogin(baseUrl, 'p');

        const profileRes = await fetch(`${baseUrl}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(profileRes.status, 200);
        const payload = await profileRes.json();
        assert.equal(payload.status, 'success');
        assert.equal(payload.data.email, email);
        assert.ok(payload.data.username, 'Username should be present');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Machines list (requires auth, all roles allowed)
// ─────────────────────────────────────────────────────────────────────────────
test('machines list requires authentication and returns array', async () => {
    const { server, baseUrl } = await startServer();
    try {
        // Without token → 401
        const unauthRes = await fetch(`${baseUrl}/api/machines`);
        assert.equal(unauthRes.status, 401, 'Machines list should require auth');

        // With valid user token → 200 + array
        const { token } = await registerAndLogin(baseUrl, 'm');
        const authRes = await fetch(`${baseUrl}/api/machines`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(authRes.status, 200);
        const payload = await authRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(Array.isArray(payload.data), 'Machines data should be an array');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Token wallet balance
// ─────────────────────────────────────────────────────────────────────────────
test('token balance endpoint returns wallet balance for authenticated user', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'b');

        const balanceRes = await fetch(`${baseUrl}/api/tokens/balance`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(balanceRes.status, 200);
        const payload = await balanceRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(
            payload.data.balance !== undefined,
            'Balance field should be present in response'
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Subscriptions
// ─────────────────────────────────────────────────────────────────────────────
test('subscription endpoints create and return the current subscription', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 's');

        const createRes = await fetch(`${baseUrl}/api/subscriptions/subscribe`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                planName: 'Premium',
                durationMonths: 1,
                amount: 499,
                renewalType: 'manual'
            })
        });

        assert.equal(createRes.status, 201);

        const currentRes = await fetch(`${baseUrl}/api/subscriptions/current`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(currentRes.status, 200);
        const payload = await currentRes.json();
        assert.equal(payload.status, 'success');
        assert.equal(payload.data.plan_name, 'Premium');
        assert.equal(payload.data.status, 'active');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Feedback
// ─────────────────────────────────────────────────────────────────────────────
test('feedback endpoints submit and list user feedback', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'f');

        const createRes = await fetch(`${baseUrl}/api/feedback`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subject: 'App',
                message: 'Everything is working well',
                rating: 5
            })
        });

        assert.equal(createRes.status, 201);

        const mineRes = await fetch(`${baseUrl}/api/feedback/mine`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(mineRes.status, 200);
        const payload = await mineRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(Array.isArray(payload.data));
        assert.ok(payload.data.length >= 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Shop products
// ─────────────────────────────────────────────────────────────────────────────
test('shop products endpoint requires authentication and returns array', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const unauthRes = await fetch(`${baseUrl}/api/shop/products`);
        assert.equal(unauthRes.status, 401);

        const { token } = await registerAndLogin(baseUrl, 'shop');
        const authRes = await fetch(`${baseUrl}/api/shop/products`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(authRes.status, 200);
        const payload = await authRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(Array.isArray(payload.data));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI Generate plan
// ─────────────────────────────────────────────────────────────────────────────
test('ai generate-plan persists a saved plan and exposes it in latest plan endpoint', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'ai1');

        const generateRes = await fetch(`${baseUrl}/api/ai/generate-plan`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                weight: 82,
                height: 178,
                age: 27,
                gender: 'male',
                activity_level: 'moderate',
                body_fat_pct: 19,
                training_frequency: 4,
                allergies: 'none',
                disease: 'none',
                budget: 'moderate'
            })
        });

        assert.equal(generateRes.status, 201);
        const generatedPayload = await generateRes.json();
        assert.equal(generatedPayload.status, 'success');
        assert.ok(generatedPayload.data.plan_id, 'plan_id should be returned');
        assert.ok(generatedPayload.data.scan_id, 'scan_id should be returned');

        const latestPlanRes = await fetch(`${baseUrl}/api/ai/plans/latest`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(latestPlanRes.status, 200);
        const latestPlanPayload = await latestPlanRes.json();
        assert.equal(latestPlanPayload.status, 'success');
        assert.equal(latestPlanPayload.data.plan_id, generatedPayload.data.plan_id);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. AI Chat sessions
// ─────────────────────────────────────────────────────────────────────────────
test('ai chat stores session history and exposes it by session id', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'ai2');

        const chatRes = await fetch(`${baseUrl}/api/ai/chat`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: 'How do I improve recovery after leg day?' })
        });

        assert.equal(chatRes.status, 200);
        const chatPayload = await chatRes.json();
        assert.equal(chatPayload.status, 'success');
        assert.ok(chatPayload.data.reply, 'reply should exist');
        assert.ok(chatPayload.data.session_id, 'session_id should exist');

        const historyRes = await fetch(`${baseUrl}/api/ai/chat/history?sessionId=${encodeURIComponent(chatPayload.data.session_id)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        assert.equal(historyRes.status, 200);
        const historyPayload = await historyRes.json();
        assert.equal(historyPayload.status, 'success');
        assert.ok(Array.isArray(historyPayload.data));
        assert.equal(historyPayload.data.length, 2);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. AI Scans after plan generation
// ─────────────────────────────────────────────────────────────────────────────
test('ai scan endpoints return latest scan and scan history after plan generation', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'ai3');

        await fetch(`${baseUrl}/api/ai/generate-plan`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weight: 76, height: 171, age: 24, gender: 'female',
                activity_level: 'light', body_fat_pct: 24, training_frequency: 3
            })
        });

        const latestScanRes = await fetch(`${baseUrl}/api/ai/scans/latest`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(latestScanRes.status, 200);
        const latestScanPayload = await latestScanRes.json();
        assert.equal(latestScanPayload.status, 'success');
        assert.ok(latestScanPayload.data.scan_id);

        const historyRes = await fetch(`${baseUrl}/api/ai/scans/history`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(historyRes.status, 200);
        const historyPayload = await historyRes.json();
        assert.equal(historyPayload.status, 'success');
        assert.ok(Array.isArray(historyPayload.data));
        assert.ok(historyPayload.data.length >= 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Public InBody endpoint (no auth)
// ─────────────────────────────────────────────────────────────────────────────
test('public inbody endpoint returns latest scan without authentication', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token, email } = await registerAndLogin(baseUrl, 'ai4');

        await fetch(`${baseUrl}/api/ai/generate-plan`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weight: 81, height: 176, age: 28, gender: 'male',
                activity_level: 'active', body_fat_pct: 17
            })
        });

        const publicRes = await fetch(`${baseUrl}/api/ai/public/inbody/latest?email=${encodeURIComponent(email)}`);
        assert.equal(publicRes.status, 200);
        const payload = await publicRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(payload.data.scan_id);
        assert.equal(payload.data.weight_kg, 81);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. Coaches – list (authenticated)
// ─────────────────────────────────────────────────────────────────────────────
test('coaches list requires authentication and returns array', async () => {
    const { server, baseUrl } = await startServer();
    try {
        // No auth → 401
        const unauthRes = await fetch(`${baseUrl}/api/coaches`);
        assert.equal(unauthRes.status, 401, 'Coaches list should require auth');

        // With user token → 200
        const { token } = await registerAndLogin(baseUrl, 'coach_list');
        const authRes = await fetch(`${baseUrl}/api/coaches`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(authRes.status, 200);
        const payload = await authRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(Array.isArray(payload.data), 'Coaches should be an array');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. Coaches – user cannot create (403)
// ─────────────────────────────────────────────────────────────────────────────
test('regular user cannot create a coach (forbidden)', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'coach_create_block');
        const res = await fetch(`${baseUrl}/api/coaches`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'FakeCoach',
                email: `fakecoach_${Date.now()}@test.com`,
                password: 'Pass123!'
            })
        });
        assert.equal(res.status, 403, 'Regular user should get 403 when creating coach');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. Admin endpoints – user cannot access (403)
// ─────────────────────────────────────────────────────────────────────────────
test('user cannot access admin endpoints (403)', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'admin_block');
        const adminRoutes = [
            `${baseUrl}/api/admin/dashboard`,
            `${baseUrl}/api/admin/users`,
            `${baseUrl}/api/admin/feedback`,
            `${baseUrl}/api/admin/orders`,
            `${baseUrl}/api/admin/payments`,
            `${baseUrl}/api/admin/subscriptions`,
            `${baseUrl}/api/admin/scans`,
            `${baseUrl}/api/admin/plans`,
            `${baseUrl}/api/admin/ai/interactions`
        ];

        for (const url of adminRoutes) {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            assert.equal(res.status, 403, `Expected 403 from ${url} for regular user`);
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. Machine admin CRUD – user cannot create/update/delete (403)
// ─────────────────────────────────────────────────────────────────────────────
test('regular user cannot create or delete machines (403)', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'mach_auth');

        const createRes = await fetch(`${baseUrl}/api/machines`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test', tokensPerMinute: 2 })
        });
        assert.equal(createRes.status, 403, 'User should get 403 creating machine');

        const deleteRes = await fetch(`${baseUrl}/api/machines/1`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(deleteRes.status, 403, 'User should get 403 deleting machine');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. Auth guards – all protected routes reject missing tokens (401)
// ─────────────────────────────────────────────────────────────────────────────
test('protected routes reject requests without a token (returns 401)', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const protectedRoutes = [
            `${baseUrl}/api/auth/profile`,
            `${baseUrl}/api/machines`,
            `${baseUrl}/api/tokens/balance`,
            `${baseUrl}/api/tokens/history`,
            `${baseUrl}/api/subscriptions/current`,
            `${baseUrl}/api/feedback/mine`,
            `${baseUrl}/api/shop/products`,
            `${baseUrl}/api/ai/plans/latest`,
            `${baseUrl}/api/ai/chat/sessions`,
            `${baseUrl}/api/ai/scans/latest`,
            `${baseUrl}/api/coaches`,
            `${baseUrl}/api/admin/dashboard`,
            `${baseUrl}/api/admin/users`
        ];

        for (const url of protectedRoutes) {
            const res = await fetch(url);
            assert.equal(res.status, 401, `Expected 401 from ${url}`);
        }
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. User profile update
// ─────────────────────────────────────────────────────────────────────────────
test('user can update their profile', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'upd');

        const updateRes = await fetch(`${baseUrl}/api/user/update-profile`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'UpdatedName', phone: '01234567890', budget: 'high' })
        });
        assert.equal(updateRes.status, 200);
        const payload = await updateRes.json();
        assert.equal(payload.status, 'success');
        assert.equal(payload.data.username, 'UpdatedName');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. User progress tracking
// ─────────────────────────────────────────────────────────────────────────────
test('user progress endpoint returns scan history summary', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'prog');

        // first add body data
        await fetch(`${baseUrl}/api/user/body-data`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ weight: 80, height: 175, age: 25, gender: 'male' })
        });

        const progressRes = await fetch(`${baseUrl}/api/user/progress`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(progressRes.status, 200);
        const payload = await progressRes.json();
        assert.equal(payload.status, 'success');
        assert.ok(Array.isArray(payload.data.records));
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. QR Check-in / Check-out
// ─────────────────────────────────────────────────────────────────────────────
test('QR check-in and check-out flow works', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'qr');

        const checkInRes = await fetch(`${baseUrl}/api/qr/checkin`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(checkInRes.status, 201);
        const checkInPayload = await checkInRes.json();
        assert.equal(checkInPayload.status, 'success');
        assert.ok(checkInPayload.data.checkedIn);

        const checkOutRes = await fetch(`${baseUrl}/api/qr/checkout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(checkOutRes.status, 200);
        const checkOutPayload = await checkOutRes.json();
        assert.equal(checkOutPayload.status, 'success');
        assert.ok(checkOutPayload.data.att_id || checkOutPayload.data.check_in_time);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 21. Token wallet buy tokens
// ─────────────────────────────────────────────────────────────────────────────
test('user can buy tokens and history is recorded', async () => {
    const { server, baseUrl } = await startServer();
    try {
        const { token } = await registerAndLogin(baseUrl, 'tok');

        const buyRes = await fetch(`${baseUrl}/api/tokens/buy`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 100, method: 'card' })
        });
        assert.equal(buyRes.status, 201);
        const buyPayload = await buyRes.json();
        assert.equal(buyPayload.status, 'success');
        assert.ok(Number(buyPayload.data.balance) >= 100);

        const historyRes = await fetch(`${baseUrl}/api/tokens/history`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(historyRes.status, 200);
        const historyPayload = await historyRes.json();
        assert.equal(historyPayload.status, 'success');
        assert.ok(Array.isArray(historyPayload.data));
        assert.ok(historyPayload.data.length >= 1);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
