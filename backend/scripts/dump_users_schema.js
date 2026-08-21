const { poolPromise, sql } = require('../src/config/db');
poolPromise.then(async pool => {
    const cols = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='users'");
    console.log(`--- users ---`);
    cols.recordset.forEach(c => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));
}).catch(e => console.error(e)).finally(() => process.exit(0));
