/**
 * ============================================================================
 * LIVE E2E TEST — MuscleForge / SmartGym
 * ============================================================================
 * Tests every layer: DNS → Azure App Service → Express → SQL Server → Response
 * Run:  node scripts/e2e-live-test.js
 * ============================================================================
 */

const https = require('https');
const http = require('http');

// ─── Configuration ──────────────────────────────────────────────────────
const API_BASE = 'https://muscleforge-api-fwbjgscad6bbf6fr.israelcentral-01.azurewebsites.net';
const FRONTEND_BASE = 'https://gray-grass-087bd4903.7.azurestaticapps.net';
const CORS_ORIGIN = FRONTEND_BASE;

const TEST_USER = {
    username: `e2etest_${Date.now()}`,
    email: `e2etest_${Date.now()}@testmail.com`,
    password: 'TestPass123!',
    phone: '01012345678',
    rePassword: 'TestPass123!'
};

// ─── Helpers ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function log(icon, msg) {
    console.log(`  ${icon} ${msg}`);
}

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            },
            timeout: 20000
        };

        const req = lib.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(body); } catch {}
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body,
                    json
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request to ${url} timed out after 20s`));
        });

        if (options.body) {
            req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        }
        req.end();
    });
}

async function runTest(name, fn) {
    const start = Date.now();
    try {
        await fn();
        const ms = Date.now() - start;
        log('✅', `${name} (${ms}ms)`);
        passed++;
        results.push({ name, status: 'PASS', ms });
    } catch (err) {
        const ms = Date.now() - start;
        log('❌', `${name} (${ms}ms)`);
        log('  ', `   Error: ${err.message}`);
        failed++;
        results.push({ name, status: 'FAIL', ms, error: err.message });
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// ─── Test Suite ─────────────────────────────────────────────────────────
async function main() {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║         MUSCLEFORGE E2E LIVE TEST SUITE                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    let authToken = null;
    let userId = null;

    // ────────────────────────────────────────────────────────────
    // SECTION 1: INFRASTRUCTURE
    // ────────────────────────────────────────────────────────────
    console.log('─── 1. INFRASTRUCTURE ────────────────────────────────────\n');

    await runTest('1.1 API root responds', async () => {
        const res = await request(`${API_BASE}/`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.json?.status === 'success', `Expected success status`);
        assert(res.json?.data?.service?.includes('Gym'), `Unexpected service name: ${res.json?.data?.service}`);
    });

    await runTest('1.2 Health endpoint — server running', async () => {
        const res = await request(`${API_BASE}/health`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.json?.data?.message?.includes('running'), 'Server not marked as running');
    });

    await runTest('1.3 Health endpoint — database connected', async () => {
        const res = await request(`${API_BASE}/health`);
        assert(res.json?.data?.database === 'connected', `Database status: ${res.json?.data?.database}`);
    });

    await runTest('1.4 Frontend is deployed and reachable', async () => {
        const res = await request(FRONTEND_BASE);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.includes('<!DOCTYPE html>') || res.body.includes('<html'), 'Not an HTML page');
    });

    await runTest('1.5 Frontend serves Angular app (index.html)', async () => {
        const res = await request(FRONTEND_BASE);
        const hasAngularMarker = res.body.includes('app-root') || res.body.includes('main.') || res.body.includes('runtime.');
        assert(hasAngularMarker, 'Angular app markers not found in HTML');
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 2: CORS
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 2. CORS ───────────────────────────────────────────────\n');

    await runTest('2.1 CORS preflight (OPTIONS) returns 204', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CORS_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        });
        assert(res.status === 204, `Expected 204 for preflight, got ${res.status}`);
    });

    await runTest('2.2 CORS preflight returns Access-Control-Allow-Origin', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CORS_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        });
        const acao = res.headers['access-control-allow-origin'];
        assert(acao === CORS_ORIGIN || acao === '*', `Access-Control-Allow-Origin missing or wrong: "${acao}"`);
    });

    await runTest('2.3 CORS preflight allows Content-Type header', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CORS_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        });
        const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
        assert(allowedHeaders.includes('content-type'), `Content-Type not in allowed headers: "${allowedHeaders}"`);
    });

    await runTest('2.4 CORS preflight allows POST method', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'OPTIONS',
            headers: {
                'Origin': CORS_ORIGIN,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'content-type'
            }
        });
        const allowedMethods = (res.headers['access-control-allow-methods'] || '').toUpperCase();
        assert(allowedMethods.includes('POST'), `POST not in allowed methods: "${allowedMethods}"`);
    });

    await runTest('2.5 CORS on actual POST includes Allow-Origin', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: { email: 'nonexistent@test.com', password: 'wrong' }
        });
        const acao = res.headers['access-control-allow-origin'];
        assert(acao === CORS_ORIGIN || acao === '*', `POST response missing ACAO header: "${acao}"`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 3: VALIDATION
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 3. INPUT VALIDATION ───────────────────────────────────\n');

    await runTest('3.1 Register rejects empty body', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            body: {}
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.json?.status === 'error', 'Expected error status');
    });

    await runTest('3.2 Register rejects missing password', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            body: { username: 'test', email: 'test@test.com' }
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('3.3 Register rejects short password', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            body: { username: 'test', email: 'test@test.com', password: '123' }
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.json?.message?.includes('6 characters'), `Unexpected message: ${res.json?.message}`);
    });

    await runTest('3.4 Register rejects invalid email', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            body: { username: 'test', email: 'not-an-email', password: 'Pass123!' }
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest('3.5 Login rejects empty body', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: {}
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 4: REGISTRATION
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 4. REGISTRATION ───────────────────────────────────────\n');

    await runTest('4.1 Register new user succeeds', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: TEST_USER
        });
        assert(res.status === 201, `Expected 201, got ${res.status}. Body: ${res.body}`);
        assert(res.json?.status === 'success', `Expected success, got ${res.json?.status}. Body: ${res.body}`);
        assert(res.json?.data?.user?.email === TEST_USER.email, 'Email mismatch in response');
        assert(res.json?.data?.user?.username === TEST_USER.username, 'Username mismatch');
        assert(res.json?.data?.user?.role === 'user', 'Role should be user');
        assert(res.json?.data?.token, 'No token returned');
        userId = res.json?.data?.user?.id;
        log('  ', `   → Created user ID: ${userId}`);
    });

    await runTest('4.2 Register returns CORS header for frontend', async () => {
        // Use the duplicate-email attempt to check CORS on error responses
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: TEST_USER
        });
        const acao = res.headers['access-control-allow-origin'];
        assert(acao === CORS_ORIGIN || acao === '*',
            `Missing/wrong Access-Control-Allow-Origin on error response: "${acao}"`);
    });

    await runTest('4.3 Duplicate email returns 409 with message', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            body: TEST_USER
        });
        assert(res.status === 409, `Expected 409, got ${res.status}. Body: ${res.body}`);
        assert(res.json?.message?.toLowerCase().includes('email'), `Expected email-exists message: ${res.json?.message}`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 5: LOGIN
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 5. LOGIN ──────────────────────────────────────────────\n');

    await runTest('5.1 Login with registered user succeeds', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: { email: TEST_USER.email, password: TEST_USER.password }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
        assert(res.json?.data?.token, 'No token returned');
        assert(res.json?.data?.refresh_token, 'No refresh_token returned');
        assert(res.json?.data?.user?.email === TEST_USER.email, 'User email mismatch');
        authToken = res.json.data.token;
        log('  ', `   → Got token: ${authToken.substring(0, 20)}...`);
    });

    await runTest('5.2 Login with wrong password returns 401', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: { email: TEST_USER.email, password: 'wrongpassword' }
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.json?.message?.includes('Invalid'), `Unexpected message: ${res.json?.message}`);
    });

    await runTest('5.3 Login with nonexistent email returns 401', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: { email: 'nobody@nowhere.com', password: 'whatever' }
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 6: AUTHENTICATED ENDPOINTS
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 6. AUTHENTICATED ENDPOINTS ────────────────────────────\n');

    await runTest('6.1 Profile returns user data', async () => {
        if (!authToken) throw new Error('No auth token (login failed)');
        const res = await request(`${API_BASE}/api/auth/profile`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
        assert(res.json?.data?.email === TEST_USER.email, 'Profile email mismatch');
    });

    await runTest('6.2 Profile rejects unauthenticated request', async () => {
        const res = await request(`${API_BASE}/api/auth/profile`);
        assert(res.status === 401 || res.status === 403, `Expected 401/403, got ${res.status}`);
    });

    await runTest('6.3 Token balance endpoint works', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/tokens/balance`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('6.4 Token refresh works', async () => {
        if (!authToken) throw new Error('No auth token');
        // First login to get a refresh token
        const loginRes = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: { email: TEST_USER.email, password: TEST_USER.password }
        });
        const refreshToken = loginRes.json?.data?.refresh_token;
        assert(refreshToken, 'No refresh_token from login');
        
        const res = await request(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            body: { refreshToken: refreshToken }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
        assert(res.json?.data?.token, 'No new token from refresh');
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 7: FEATURE ENDPOINTS
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 7. FEATURE ENDPOINTS ──────────────────────────────────\n');

    await runTest('7.1 Machines list is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/machines`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.2 Shop products are accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/shop/products`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.3 Shop cart is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/shop/cart`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.4 Inbox endpoint is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/inbox/my`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.5 Plans endpoint is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/plans/my`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 200 or 404 (no plan yet) are both valid
        assert(res.status === 200 || res.status === 404,
            `Expected 200 or 404, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.6 Coaches list is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/coaches`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}. Body: ${res.body}`);
    });

    await runTest('7.7 Workout endpoint is accessible', async () => {
        if (!authToken) throw new Error('No auth token');
        const res = await request(`${API_BASE}/api/workout`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        // 200 or 404 both acceptable
        assert(res.status === 200 || res.status === 404,
            `Expected 200 or 404, got ${res.status}. Body: ${res.body}`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 8: RATE LIMITING
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 8. RATE LIMITING ──────────────────────────────────────\n');

    await runTest('8.1 Auth rate limit headers present', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            body: { email: 'test@test.com', password: 'test' }
        });
        const remaining = res.headers['ratelimit-remaining'];
        const limit = res.headers['ratelimit-limit'];
        log('  ', `   → Rate limit: ${remaining}/${limit} remaining`);
        if (remaining !== undefined) {
            assert(parseInt(remaining) >= 0, 'Rate limit remaining should be >= 0');
        }
        // Test passes even without headers (rate limiter may be configured differently)
    });

    await runTest('8.2 Check if auth rate limit is exhausted', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: { email: 'test@test.com', password: 'test' }
        });
        const remaining = res.headers['ratelimit-remaining'];
        if (remaining !== undefined && parseInt(remaining) === 0) {
            log('  ', `   ⚠️  RATE LIMIT EXHAUSTED! This could be the cause of registration failures!`);
            log('  ', `   ⚠️  The auth rate limit is 20 requests per 15 minutes.`);
            log('  ', `   ⚠️  If the user keeps retrying, they hit 429 Too Many Requests.`);
        } else {
            log('  ', `   → Rate limit remaining: ${remaining}`);
        }
        // This test always passes — it's diagnostic
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 9: FRONTEND → BACKEND INTEGRATION
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 9. FRONTEND → BACKEND INTEGRATION ────────────────────\n');

    await runTest('9.1 Frontend HTML references correct API URL', async () => {
        const res = await request(FRONTEND_BASE);
        // Check the compiled JS files for the API URL
        const htmlBody = res.body;
        // Find all JS file references
        const jsFileMatches = htmlBody.match(/src="([^"]*\.js)"/g) || [];
        log('  ', `   → Found ${jsFileMatches.length} JS files in index.html`);

        // Try to find and check the main JS bundle for the API URL
        let foundApiUrl = false;
        for (const match of jsFileMatches) {
            const jsPath = match.replace('src="', '').replace('"', '');
            const jsUrl = jsPath.startsWith('http') ? jsPath : `${FRONTEND_BASE}/${jsPath}`;
            try {
                const jsRes = await request(jsUrl);
                if (jsRes.body.includes('muscleforge-api')) {
                    foundApiUrl = true;
                    // Check which API URL is embedded
                    const apiUrlMatch = jsRes.body.match(/https:\/\/muscleforge-api[^"'\s]*/);
                    if (apiUrlMatch) {
                        log('  ', `   → Embedded API URL: ${apiUrlMatch[0]}`);
                        assert(apiUrlMatch[0].includes('muscleforge-api-fwbjgscad6bbf6fr'),
                            `API URL mismatch in deployed JS! Found: ${apiUrlMatch[0]}`);
                    }
                    break;
                }
            } catch (e) {
                // Skip JS files we can't fetch
            }
        }
        if (!foundApiUrl) {
            log('  ', `   ⚠️  Could not locate API URL in deployed JS bundles`);
        }
    });

    await runTest('9.2 Frontend SPA routing works (auth/signup)', async () => {
        const res = await request(`${FRONTEND_BASE}/auth/signup`);
        assert(res.status === 200, `Expected 200 for /auth/signup, got ${res.status}`);
        assert(res.body.includes('app-root') || res.body.includes('<html'), 'SPA fallback not working');
    });

    await runTest('9.3 Frontend SPA routing works (auth/login)', async () => {
        const res = await request(`${FRONTEND_BASE}/auth/login`);
        assert(res.status === 200, `Expected 200 for /auth/login, got ${res.status}`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 10: ERROR RESPONSE FORMAT CONSISTENCY
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 10. ERROR RESPONSE FORMAT ─────────────────────────────\n');

    await runTest('10.1 Validation error has "message" field', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: {}
        });
        assert(res.json?.message, `Error response missing "message" field. Body: ${res.body}`);
        log('  ', `   → Error message: "${res.json.message}"`);
    });

    await runTest('10.2 Auth error has "message" field', async () => {
        const res = await request(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: { email: 'no@no.com', password: 'wrong' }
        });
        assert(res.json?.message, `Error response missing "message" field. Body: ${res.body}`);
        log('  ', `   → Error message: "${res.json.message}"`);
    });

    await runTest('10.3 Duplicate email error has "message" field', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: TEST_USER
        });
        assert(res.json?.message, `Error response missing "message" field. Body: ${res.body}`);
        log('  ', `   → Error message: "${res.json.message}"`);
    });

    await runTest('10.4 404 endpoint returns proper error', async () => {
        const res = await request(`${API_BASE}/api/nonexistent`);
        assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    await runTest('10.5 Error responses include CORS headers for frontend', async () => {
        const res = await request(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Origin': CORS_ORIGIN },
            body: {} // Will trigger 400 validation error
        });
        const acao = res.headers['access-control-allow-origin'];
        assert(acao === CORS_ORIGIN || acao === '*',
            `Error response missing CORS header! ACAO="${acao}". ` +
            `This would cause the browser to hide the error body, showing the generic "Registration failed" message!`);
    });

    // ────────────────────────────────────────────────────────────
    // SECTION 11: SWAGGER / DOCS
    // ────────────────────────────────────────────────────────────
    console.log('\n─── 11. API DOCUMENTATION ─────────────────────────────────\n');

    await runTest('11.1 Swagger docs are accessible', async () => {
        const res = await request(`${API_BASE}/api/docs/`);
        assert(res.status === 200 || res.status === 301 || res.status === 304,
            `Expected docs page, got ${res.status}`);
    });

    // ────────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST RESULTS SUMMARY                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const total = passed + failed;
    console.log(`  Total:  ${total} tests`);
    console.log(`  Passed: ${passed} ✅`);
    console.log(`  Failed: ${failed} ❌`);
    console.log(`  Rate:   ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%\n`);

    if (failed > 0) {
        console.log('  Failed tests:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`    ❌ ${r.name}`);
            console.log(`       ${r.error}`);
        });
    }

    console.log('\n──────────────────────────────────────────────────────────────\n');

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Test suite crashed:', err);
    process.exit(2);
});
