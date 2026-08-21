const { sql, poolPromise } = require('../src/config/db');

async function patchDatabase() {
    try {
        const pool = await poolPromise;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const request = new sql.Request(transaction);

            console.log('Adding dbo.shop...');
            await request.query(`
                IF OBJECT_ID('dbo.shop', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.shop (
                        id INT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        description NVARCHAR(MAX) NULL,
                        price DECIMAL(10,2) NOT NULL,
                        currency VARCHAR(10) DEFAULT 'EGP',
                        image_url VARCHAR(255) NULL,
                        stock_quantity INT NOT NULL DEFAULT 0,
                        created_at DATETIME DEFAULT GETDATE()
                    );
                END
            `);

            console.log('Adding dbo.cart...');
            await request.query(`
                IF OBJECT_ID('dbo.cart', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.cart (
                        cart_id INT PRIMARY KEY,
                        user_id INT NOT NULL,
                        product_id INT NOT NULL,
                        quantity INT NOT NULL DEFAULT 1,
                        added_at DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_cart_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                        CONSTRAINT FK_cart_product FOREIGN KEY (product_id) REFERENCES dbo.shop(id)
                    );
                END
            `);

            console.log('Adding dbo.shop_history...');
            await request.query(`
                IF OBJECT_ID('dbo.shop_history', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.shop_history (
                        sh_id INT PRIMARY KEY,
                        user_id INT NULL,
                        coach_id INT NULL,
                        admin_id INT NULL,
                        product_id INT NOT NULL,
                        quantity INT NOT NULL,
                        total_price DECIMAL(12,2) NOT NULL,
                        purchased_at DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_shop_history_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                        CONSTRAINT FK_shop_history_product FOREIGN KEY (product_id) REFERENCES dbo.shop(id)
                    );
                END
            `);

            console.log('Adding dbo.payment_method...');
            await request.query(`
                IF OBJECT_ID('dbo.payment_method', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.payment_method (
                        pm_id INT PRIMARY KEY,
                        user_id INT NOT NULL,
                        card_type VARCHAR(20) DEFAULT 'Visa',
                        card_last4 CHAR(4) NOT NULL,
                        card_holder VARCHAR(100) NOT NULL,
                        is_default BIT DEFAULT 0,
                        created_at DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_payment_method_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                    );
                END
            `);

            console.log('Adding dbo.inbox_message...');
            await request.query(`
                IF OBJECT_ID('dbo.inbox_message', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.inbox_message (
                        message_id INT PRIMARY KEY,
                        sender_id INT NOT NULL,
                        sender_type VARCHAR(10) NOT NULL,
                        recipient_id INT NOT NULL,
                        content NVARCHAR(MAX) NULL,
                        sent_at DATETIME DEFAULT GETDATE(),
                        read_flag BIT DEFAULT 0
                    );
                END
            `);

            console.log('Adding dbo.coach_rating...');
            await request.query(`
                IF OBJECT_ID('dbo.coach_rating', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.coach_rating (
                        rating_id INT PRIMARY KEY,
                        user_id INT NOT NULL,
                        coach_id INT NOT NULL,
                        communication TINYINT NOT NULL,
                        knowledge TINYINT NOT NULL,
                        attitude TINYINT NOT NULL,
                        punctuality TINYINT NOT NULL,
                        overall_avg DECIMAL(3,2) NOT NULL,
                        comment NVARCHAR(500) NULL,
                        rated_at DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_coach_rating_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                        CONSTRAINT FK_coach_rating_coach FOREIGN KEY (coach_id) REFERENCES dbo.coach(coach_id)
                    );
                END
            `);

            console.log('Adding dbo.machine_history...');
            await request.query(`
                IF OBJECT_ID('dbo.machine_history', 'U') IS NULL
                BEGIN
                    CREATE TABLE dbo.machine_history (
                        mh_id INT PRIMARY KEY,
                        user_id INT NOT NULL,
                        machine_id INT NOT NULL,
                        session_id INT NOT NULL,
                        history_date DATETIME DEFAULT GETDATE(),
                        CONSTRAINT FK_machine_history_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                        CONSTRAINT FK_machine_history_machine FOREIGN KEY (machine_id) REFERENCES dbo.machine(machine_id),
                        CONSTRAINT FK_machine_history_session FOREIGN KEY (session_id) REFERENCES dbo.machine_sessions(session_id)
                    );
                END
            `);

            console.log('Adding missing columns to dbo.coach...');
            await request.query(`
                IF COL_LENGTH('dbo.coach', 'salary') IS NULL
                BEGIN
                    ALTER TABLE dbo.coach ADD salary DECIMAL(10,2) NULL;
                END

                IF COL_LENGTH('dbo.coach', 'profile_picture_url') IS NULL
                BEGIN
                    ALTER TABLE dbo.coach ADD profile_picture_url NVARCHAR(MAX) NULL;
                END
            `);

            console.log('Adding missing column to dbo.machine_sessions...');
            await request.query(`
                IF COL_LENGTH('dbo.machine_sessions', 'date') IS NULL
                BEGIN
                    ALTER TABLE dbo.machine_sessions ADD date DATETIME NULL;
                END
            `);

            console.log('Adding missing column to dbo.machine...');
            await request.query(`
                IF COL_LENGTH('dbo.machine', 'location') IS NULL
                BEGIN
                    ALTER TABLE dbo.machine ADD location VARCHAR(150) NULL;
                END
            `);

            await transaction.commit();
            console.log('Database patch completed successfully.');
        } catch (err) {
            await transaction.rollback();
            console.error('Transaction rolled back due to error:', err);
            throw err;
        }
    } catch (err) {
        console.error('Error patching database:', err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

patchDatabase();
