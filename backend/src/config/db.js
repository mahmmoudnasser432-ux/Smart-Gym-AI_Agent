const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const toBool = (value, fallback) => {
    if (typeof value !== 'string') return fallback;
    return value.toLowerCase() === 'true';
};

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        instanceName: process.env.DB_INSTANCE || undefined,
        encrypt: toBool(process.env.DB_ENCRYPT, false),
        trustServerCertificate: toBool(process.env.DB_TRUST_CERT, true)
    }
};

if (process.env.DB_PORT) {
    config.port = Number(process.env.DB_PORT);
}

const poolPromise = new sql.ConnectionPool(config).connect();

poolPromise
    .then(() => {
        console.log('Connected to SQL Server');
    })
    .catch(err => {
        console.log('Database Connection Failed: ', err);
    });

module.exports = { sql, poolPromise };
