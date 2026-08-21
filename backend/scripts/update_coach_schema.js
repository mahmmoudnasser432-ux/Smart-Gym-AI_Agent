const { poolPromise, sql } = require('../src/config/db');

poolPromise.then(async pool => {
    try {
        console.log('Adding salary and profile_picture_url to dbo.coach...');
        await pool.request().query(`
            IF COL_LENGTH('dbo.coach', 'salary') IS NULL
            BEGIN
                ALTER TABLE dbo.coach ADD salary DECIMAL(10,2) NULL
            END

            IF COL_LENGTH('dbo.coach', 'profile_picture_url') IS NULL
            BEGIN
                ALTER TABLE dbo.coach ADD profile_picture_url NVARCHAR(MAX) NULL
            END
        `);
        console.log('Successfully updated dbo.coach schema.');
    } catch (error) {
        console.error('Migration Error:', error.message);
    } finally {
        process.exit(0);
    }
});
