const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    const checkColumns = async (table) => {
        const result = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = '${table}' AND COLUMN_NAME IN ('reset_code', 'reset_code_expires_at')
        `);
        return result.recordset.map(r => r.COLUMN_NAME);
    };

    for (const table of ['users', 'coach', 'admin']) {
        const cols = await checkColumns(table);
        console.log(`Table ${table} has reset columns:`, cols);
        
        if (!cols.includes('reset_code') && table !== 'users') {
            await pool.request().query(`ALTER TABLE dbo.${table} ADD reset_code VARCHAR(10) NULL`);
            console.log(`Added reset_code to ${table}`);
        }
        if (!cols.includes('reset_code_expires_at') && table !== 'users') {
            await pool.request().query(`ALTER TABLE dbo.${table} ADD reset_code_expires_at DATETIME NULL`);
            console.log(`Added reset_code_expires_at to ${table}`);
        }
    }
}).catch(e => console.error(e)).finally(() => process.exit(0));
