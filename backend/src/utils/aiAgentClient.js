/**
 * aiAgentClient.js
 * HTTP client for communicating with the external AI Agent service.
 * All AI endpoints go through this utility.
 */

const ApiError = require('./apiError');

const AI_BASE_URL = process.env.AI_AGENT_URL || 'http://localhost:8000';
const TIMEOUT_MS  = 180_000; // 180 seconds – AI can be slow

/**
 * Call an AI agent endpoint.
 * @param {string} path   - e.g. '/generate-plan'
 * @param {object} body   - JSON payload to send
 * @param {'json'|'buffer'} responseType - expected response type
 * @returns {Promise<object|Buffer>}
 */
async function callAgent(path, body, responseType = 'json', retries = 2) {
    const url = `${AI_BASE_URL}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        let res;
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-internal-secret': process.env.INTERNAL_SECRET || 'smartgym-internal-2024'
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
        } catch (err) {
            clearTimeout(timer);
            if (attempt < retries && (err.name === 'AbortError' || err.message.includes('fetch'))) {
                console.warn(`[AI Agent] Attempt ${attempt + 1} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
                continue;
            }
            if (err.name === 'AbortError') {
                throw new ApiError(504, 'AI agent timed out – please try again');
            }
            throw new ApiError(503, `AI agent service unavailable: ${err.message}`);
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            let detail = '';
            try { 
                const errorBody = await res.json();
                detail = errorBody.detail;
                if (typeof detail === 'object') {
                    detail = JSON.stringify(detail); // To show FastAPI 422 validation errors clearly
                }
            } catch (_) {}
            
            if (attempt < retries && (res.status >= 500)) {
                console.warn(`[AI Agent] Attempt ${attempt + 1} returned ${res.status}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
                continue;
            }

            throw new ApiError(res.status, `AI agent error: ${detail || res.statusText}`);
        }

        if (responseType === 'buffer') {
            return Buffer.from(await res.arrayBuffer());
        }

        return res.json();
    }
}

module.exports = { callAgent };
