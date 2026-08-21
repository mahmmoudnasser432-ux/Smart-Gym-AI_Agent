const API_URL = 'http://localhost:5000/api';
const fs = require('fs');

async function runTests() {
  console.log('🚀 Starting Integration Tests...\n');

  try {
    // 1. Register User
    console.log('--- 1. Registering User ---');
    const timestamp = Date.now();
    const user = {
      username: `qatest_${timestamp}`,
      email: `qatest_${timestamp}@example.com`,
      password: 'password123',
      role: 'customer'
    };
    
    await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
    });

    // 2. Login User
    console.log('--- 2. Logging In ---');
    const loginReq = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: user.email,
            password: user.password
        })
    });
    
    if (!loginReq.ok) {
        throw new Error(`Login failed: ${loginReq.status} - ${await loginReq.text()}`);
    }

    const loginRes = await loginReq.json();
    const token = loginRes.data.token || loginRes.token;
    console.log('✅ Login Successful. Token obtained.');
    
    const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    // 4. Test InBody Scan Submission
    console.log('\n--- 4. Testing InBody Scan Submission ---');
    const inBodyData = {
      age: 25,
      gender: 'male',
      height: 180,
      weight: 80,
      bodyFat: 15,
      goal: 'build muscle',
      activityLevel: 'active'
    };
    
    const scanReq = await fetch(`${API_URL}/ai/scans/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(inBodyData)
    });

    if (!scanReq.ok) {
         throw new Error(`Scan submission failed: ${scanReq.status} - ${await scanReq.text()}`);
    }
    const scanRes = await scanReq.json();
    
    const scanId = scanRes.data?.scan?.scan_id || scanRes.data?.scan_id || scanRes.data?.id;
    console.log('✅ Scan Submission Successful. Scan ID:', scanId);

    if (!scanId) throw new Error('Could not find scanId in response.');

    // 5. Test Plan Generation
    console.log('\n--- 5. Testing Plan Generation ---');
    const planReq = await fetch(`${API_URL}/plans/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
            scanId: scanId,
            age: 25,
            gender: 'male',
            goal: 'build muscle'
        })
    });

    if (!planReq.ok) {
         throw new Error(`Plan generation failed: ${planReq.status} - ${await planReq.text()}`);
    }
    
    const planRes = await planReq.json();
    console.log('✅ Plan Generation Response received.');

    // 6. Save the Generated Plan
    console.log('\n--- 6. Saving Generated Plan ---');
    const saveReq = await fetch(`${API_URL}/plans/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            scanId: scanId,
            aiResponse: planRes.data
        })
    });

    if (!saveReq.ok) {
        throw new Error(`Plan save failed: ${saveReq.status} - ${await saveReq.text()}`);
    }

    const saveRes = await saveReq.json();
    const planId = saveRes.data?.plan_id || saveRes.plan_id;
    console.log('✅ Plan Saved successfully. Plan ID:', planId);

    // 7. Test PDF Download
    console.log('\n--- 7. Testing PDF Download ---');
    if (!planId) {
        throw new Error('No planId returned after saving.');
    } else {
        const pdfReq = await fetch(`${API_URL}/plans/${planId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!pdfReq.ok) {
            throw new Error(`PDF generation failed: ${pdfReq.status} - ${await pdfReq.text()}`);
        }

        const arrayBuffer = await pdfReq.arrayBuffer();
        fs.writeFileSync('test_plan.pdf', Buffer.from(arrayBuffer));
        console.log('✅ PDF downloaded successfully to test_plan.pdf. Size:', arrayBuffer.byteLength, 'bytes');
    }

    console.log('\n🎉 ALL TESTS PASSED!');

  } catch (err) {
    console.error('❌ Test Failed!');
    console.error(err.message);
  }
}

runTests();
