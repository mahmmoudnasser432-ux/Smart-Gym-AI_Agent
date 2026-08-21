const { poolPromise } = require('./src/config/db');
async function run() {
    const pool = await poolPromise;
    try {
        const result = await pool.request().query("SELECT table_name FROM INFORMATION_SCHEMA.TABLES");
        console.log(result.recordset);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
