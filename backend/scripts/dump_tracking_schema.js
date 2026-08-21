const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    const tables = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'");
    console.log('Tables:', tables.recordset.map(t => t.TABLE_NAME));

    for (const table of tables.recordset.map(t => t.TABLE_NAME)) {
        if (['booking', 'machine_booking', 'inbody', 'user_profile', 'notifications'].includes(table) || table.includes('booking') || table.includes('notification')) {
            const cols = await pool.request().query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${table}'`);
            console.log(`\n--- ${table} ---`);
            cols.recordset.forEach(c => console.log(`${c.COLUMN_NAME} (${c.DATA_TYPE})`));
        }
    }
}).catch(e => console.error(e)).finally(() => process.exit(0));
