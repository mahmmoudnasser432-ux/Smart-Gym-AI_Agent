const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function scanDB() {
  const pool = await sql.connect(config);
  
  const tablesResult = await pool.request().query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  console.log('=== TABLES ===');
  console.log(JSON.stringify(tablesResult.recordset, null, 2));

  const columnsResult = await pool.request().query(
    "SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );
  console.log('=== COLUMNS ===');
  console.log(JSON.stringify(columnsResult.recordset, null, 2));

  const fkResult = await pool.request().query(
    "SELECT fk.name AS FK_Name, tp.name AS Parent_Table, cp.name AS Parent_Column, tr.name AS Referenced_Table, cr.name AS Referenced_Column FROM sys.foreign_keys fk INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id ORDER BY tp.name"
  );
  console.log('=== FOREIGN KEYS ===');
  console.log(JSON.stringify(fkResult.recordset, null, 2));

  // Get primary keys
  const pkResult = await pool.request().query(
    "SELECT tc.TABLE_NAME, ccu.COLUMN_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' ORDER BY tc.TABLE_NAME"
  );
  console.log('=== PRIMARY KEYS ===');
  console.log(JSON.stringify(pkResult.recordset, null, 2));

  // Get stored procedures and views
  const viewsResult = await pool.request().query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME"
  );
  console.log('=== VIEWS ===');
  console.log(JSON.stringify(viewsResult.recordset, null, 2));

  await pool.close();
}

scanDB().catch(err => {
  console.error('DB Scan Error:', err.message);
  process.exit(1);
});
