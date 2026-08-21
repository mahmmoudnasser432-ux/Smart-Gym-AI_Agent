const http = require('http');

const data = JSON.stringify({
    scanId: "C1A2F60A-1175-430C-821A-18F1240974DA", // we need a valid scanId... wait, I will just login or skip auth?
});

// Since we need auth, maybe I will just mock the planService logic to see if preparePayloadForAgent throws?
const planService = require('./src/services/planService');
const { poolPromise } = require('./src/config/db');

async function test() {
    try {
        const pool = await poolPromise;
        const scans = await pool.request().query('SELECT TOP 1 * FROM dbo.InBodyScans');
        const scan = scans.recordset[0];
        if (!scan) {
            console.log('No scans found in DB');
            process.exit(1);
        }
        
        console.log('Testing with scan:', scan.scan_id);
        
        const payload = {
            age: 25,
            gender: 'male',
            activityLevel: 'moderate',
            trainingDaysPerWeek: 4,
            allergies: 'none',
            disease: 'none',
            budget: 'moderate'
        };
        
        console.log('Calling generatePlan...');
        const result = await planService.generatePlan(scan.user_id, scan.scan_id, payload);
        console.log('Success:', result);
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}

test();
