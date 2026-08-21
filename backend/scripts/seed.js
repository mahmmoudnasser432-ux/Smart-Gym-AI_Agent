const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('./DB.js');

async function seedDatabase() {
    try {
        const pool = await poolPromise;
        console.log('Loading seed data...');

        const passwordHash = await bcrypt.hash('123456', 10);

        for (let i = 1; i <= 10; i++) {
            const email = `user${i}@gym.com`;
            const existingUser = await pool.request()
                .input(`email${i}`, sql.VarChar, email)
                .query(`SELECT TOP 1 user_id FROM dbo.users WHERE email = @email${i}`);

            let userId;
            if (existingUser.recordset.length > 0) {
                userId = existingUser.recordset[0].user_id;
            } else {
                const userResult = await pool.request()
                    .input(`username${i}`, sql.VarChar, `User_${i}`)
                    .input(`newEmail${i}`, sql.VarChar, email)
                    .input(`password${i}`, sql.VarChar, passwordHash)
                    .input(`phone${i}`, sql.VarChar, `0100000000${i % 10}`)
                    .input(`budget${i}`, sql.NVarChar(10), ['low', 'moderate', 'high'][i % 3])
                    .input(`activity${i}`, sql.NVarChar(20), ['sedentary', 'light', 'moderate', 'active', 'athlete'][i % 5])
                    .input(`gender${i}`, sql.NVarChar(10), i % 2 === 0 ? 'female' : 'male')
                    .query(`
                        INSERT INTO dbo.users (
                            username, email, password_hash, phone, status, budget, activity_level, gender
                        )
                        OUTPUT INSERTED.user_id
                        VALUES (
                            @username${i}, @newEmail${i}, @password${i}, @phone${i}, 'active',
                            @budget${i}, @activity${i}, @gender${i}
                        )
                    `);
                userId = userResult.recordset[0].user_id;
            }

            const balance = Math.floor(Math.random() * 450) + 50;
            await pool.request()
                .input(`walletUser${i}`, sql.Int, userId)
                .input(`balance${i}`, sql.Decimal(12, 2), balance)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM dbo.tokenwallet WHERE user_id = @walletUser${i})
                    BEGIN
                        INSERT INTO dbo.tokenwallet (user_id, balance) VALUES (@walletUser${i}, @balance${i});
                    END
                `);

            await pool.request()
                .input(`healthUser${i}`, sql.Int, userId)
                .input(`diabetes${i}`, sql.Bit, i % 3 === 0 ? 1 : 0)
                .input(`hypertension${i}`, sql.Bit, i % 4 === 0 ? 1 : 0)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM dbo.user_health_profile WHERE user_id = @healthUser${i})
                    BEGIN
                        INSERT INTO dbo.user_health_profile (
                            user_id, has_diabetes, has_hypertension, blood_type
                        )
                        VALUES (@healthUser${i}, @diabetes${i}, @hypertension${i}, 'O+');
                    END
                `);

            await pool.request()
                .input(`scanUser${i}`, sql.Int, userId)
                .input(`weight${i}`, sql.Float, 70 + i)
                .input(`height${i}`, sql.Float, 170 + (i % 8))
                .input(`bodyFatPct${i}`, sql.Float, 18 + (i % 6))
                .input(`muscleMass${i}`, sql.Float, 28 + i)
                .query(`
                    INSERT INTO dbo.InBodyScans (
                        user_id, weight_kg, height_cm, body_fat_pct, muscle_mass, scan_timestamp
                    )
                    VALUES (
                        @scanUser${i}, @weight${i}, @height${i}, @bodyFatPct${i}, @muscleMass${i}, GETDATE()
                    )
                `);
        }

        const machines = [
            { name: 'Treadmill', location: 'Cardio Zone', rate: 5, count: 5, aliases: ['Treadmill A1'] },
            { name: 'Bench Press', location: 'Free Weights', rate: 3, count: 5 },
            { name: 'Leg Press', location: 'Strength Zone', rate: 8, count: 5, aliases: ['Leg Press X'] },
            { name: 'Lat Pulldown Machine', location: 'Strength Zone', rate: 6, count: 5 },
            { name: 'Seated Row Machine', location: 'Strength Zone', rate: 6, count: 5 },
            { name: 'Elliptical Trainer', location: 'Cardio Zone', rate: 5, count: 5, aliases: ['Elliptical E2'] },
            { name: 'Smith Machine', location: 'Free Weights', rate: 7, count: 5 },
            { name: 'Functional Cable Crossover', location: 'Strength Zone', rate: 7, count: 5 }
        ];

        for (const machine of machines) {
            await pool.request()
                .input('name', sql.VarChar, machine.name)
                .input('alias1', sql.VarChar, machine.aliases?.[0] || machine.name)
                .input('location', sql.VarChar, machine.location)
                .input('rate', sql.Int, machine.rate)
                .input('count', sql.Int, machine.count)
                .query(`
                    DECLARE @machineId INT;
                    SELECT TOP 1 @machineId = machine_id
                    FROM dbo.machine
                    WHERE name IN (@name, @alias1);

                    IF @machineId IS NOT NULL
                    BEGIN
                        UPDATE dbo.machine
                        SET name = @name,
                            location = @location,
                            status = 'Available',
                            tokens_required_per_minute = @rate,
                            machine_count = @count
                        WHERE machine_id = @machineId;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO dbo.machine (name, location, status, tokens_required_per_minute, machine_count)
                        VALUES (@name, @location, 'Available', @rate, @count);
                    END
                `);
        }

        await pool.request().query(`
            INSERT INTO dbo.crowding_snapshot (gym_zone, current_count, capacity_estimate)
            VALUES ('Cardio Zone', 15, 20), ('Strength Zone', 5, 15)
        `);

        console.log('Seed complete.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seedDatabase();
