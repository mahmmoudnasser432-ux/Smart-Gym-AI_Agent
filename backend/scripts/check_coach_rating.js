const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    const check = await pool.request().query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'coach_rating'"
    );
    console.log('coach_rating table exists:', check.recordset.length > 0);

    const coaches = await pool.request().query('SELECT coach_id, username FROM dbo.coach');
    console.log('Available coaches:', JSON.stringify(coaches.recordset));
}).catch(e => console.error(e.message)).finally(() => process.exit(0));
