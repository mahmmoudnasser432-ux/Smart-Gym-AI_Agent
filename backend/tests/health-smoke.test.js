const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../src/app');

const startServer = () => new Promise((resolve) => {
    const server = app.listen(0, () => {
        const address = server.address();
        resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
});

const closeServer = (server) => new Promise((resolve) => server.close(resolve));

test('root, health, and docs endpoints are available', async () => {
    const { server, baseUrl } = await startServer();

    try {
        const rootRes = await fetch(baseUrl);
        assert.equal(rootRes.status, 200);

        const rootBody = await rootRes.json();
        assert.equal(rootBody.data.health, '/health');

        const healthRes = await fetch(`${baseUrl}/health`);
        assert.equal(healthRes.status, 200);

        const docsRes = await fetch(`${baseUrl}/api/docs`);
        assert.equal(docsRes.status, 200);
    } finally {
        await closeServer(server);
    }
});
