const sql = require('mssql');
require('dotenv').config();
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true }
};
async function check() {
  const pool = await sql.connect(config);
  const r = await pool.request().query(
    "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'coach' ORDER BY ORDINAL_POSITION"
  );
  console.log(JSON.stringify(r.recordset, null, 2));
  await pool.close();
}
check().catch(console.error);
