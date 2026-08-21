const { sql } = require('../config/db');

const quoteIdentifier = (value) => `[${String(value).replace(/]/g, ']]')}]`;

const getNextIntId = async (executor, tableName, idColumn) => {
    const table = `${tableName.split('.').map(quoteIdentifier).join('.')}`;
    const column = quoteIdentifier(idColumn);
    const result = await executor.request().query(`
        SELECT ISNULL(MAX(${column}), 0) + 1 AS nextId
        FROM ${table} WITH (UPDLOCK, HOLDLOCK)
    `);

    return Number(result.recordset[0].nextId);
};

const withAllocatedIntId = async (executor, tableName, idColumn, inputName = idColumn) => {
    const id = await getNextIntId(executor, tableName, idColumn);
    return {
        id,
        bind(request) {
            return request.input(inputName, sql.Int, id);
        }
    };
};

module.exports = {
    getNextIntId,
    withAllocatedIntId
};
