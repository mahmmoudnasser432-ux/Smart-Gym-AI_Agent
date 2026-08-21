const sql = require('mssql');
require('dotenv').config();

function toBool(value, fallback) {
    if (typeof value !== 'string') return fallback;
    return value.toLowerCase() === 'true';
}

function quoteSqlIdentifier(value) {
    return `[${String(value).replace(/]/g, ']]')}]`;
}

function getBaseConfig() {
    const { DB_USER, DB_PASSWORD, DB_SERVER, DB_PORT, DB_INSTANCE } = process.env;

    if (!DB_USER || !DB_PASSWORD || !DB_SERVER) {
        throw new Error('Missing DB_USER, DB_PASSWORD, or DB_SERVER in .env');
    }

    const config = {
        user: DB_USER,
        password: DB_PASSWORD,
        server: DB_SERVER,
        options: {
            instanceName: DB_INSTANCE || undefined,
            encrypt: toBool(process.env.DB_ENCRYPT, false),
            trustServerCertificate: toBool(process.env.DB_TRUST_CERT, true)
        }
    };

    if (DB_PORT) {
        config.port = Number(DB_PORT);
    }

    return config;
}

async function ensureDatabase(pool, dbName) {
    const safeDbName = quoteSqlIdentifier(dbName);
    await pool.request().query(`
        IF DB_ID(N'${dbName.replace(/'/g, "''")}') IS NULL
        BEGIN
            EXEC('CREATE DATABASE ${safeDbName}');
        END
    `);
}

async function ensureTable(pool, statement) {
    await pool.request().query(statement);
}

async function ensureColumn(pool, tableName, columnName, definition) {
    await pool.request().query(`
        IF COL_LENGTH('${tableName}', '${columnName}') IS NULL
        BEGIN
            ALTER TABLE ${tableName} ADD ${columnName} ${definition};
        END
    `);
}

async function ensureColumnType(pool, tableName, columnName, definition) {
    await pool.request().query(`
        IF COL_LENGTH('${tableName}', '${columnName}') IS NOT NULL
        BEGIN
            ALTER TABLE ${tableName} ALTER COLUMN ${columnName} ${definition};
        END
    `);
}

async function ensureCheckConstraint(pool, tableName, constraintName, expression) {
    await pool.request().query(`
        IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE name = '${constraintName}'
        )
        BEGIN
            ALTER TABLE ${tableName}
            ADD CONSTRAINT ${constraintName} CHECK ${expression};
        END
    `);
}

async function migrateGeneratedPlansTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID('dbo.generated_plans', 'U') IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM sys.columns c
               JOIN sys.types t ON c.user_type_id = t.user_type_id
               WHERE c.object_id = OBJECT_ID('dbo.generated_plans')
                 AND c.name = 'plan_id'
                 AND t.name <> 'uniqueidentifier'
           )
        BEGIN
            EXEC sp_rename 'dbo.generated_plans', 'generated_plans_legacy';

            CREATE TABLE dbo.generated_plans (
                plan_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                user_id INT NOT NULL,
                scan_id UNIQUEIDENTIFIER NOT NULL,
                predicted_goal VARCHAR(100) NULL,
                biological_age FLOAT NULL,
                total_calories INT NULL,
                protein_g INT NULL,
                carbs_g INT NULL,
                fats_g INT NULL,
                activity_level NVARCHAR(20) NULL,
                training_frequency INT NULL,
                budget NVARCHAR(10) NULL,
                allergies NVARCHAR(MAX) NULL,
                disease NVARCHAR(MAX) NULL,
                meal_plan_text NVARCHAR(MAX) NULL,
                workout_plan_text NVARCHAR(MAX) NULL,
                coach_notes NVARCHAR(MAX) NULL,
                created_at DATETIME DEFAULT GETDATE(),
                CONSTRAINT FK_generated_plans_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                CONSTRAINT FK_generated_plans_scan FOREIGN KEY (scan_id) REFERENCES dbo.InBodyScans(scan_id)
            );

            INSERT INTO dbo.generated_plans (
                user_id, scan_id, predicted_goal, biological_age, total_calories, protein_g, carbs_g, fats_g,
                meal_plan_text, workout_plan_text, coach_notes, created_at
            )
            SELECT
                user_id, scan_id, predicted_goal, NULL, total_calories, protein_g, carbs_g, fats_g,
                meal_plan_text, workout_plan_text, coach_notes, created_at
            FROM dbo.generated_plans_legacy;
        END
    `);
}

async function migrateChatMessageTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID('dbo.chatmessage', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.chatmessage', 'from_coach_id') IS NULL
        BEGIN
            EXEC sp_rename 'dbo.chatmessage', 'chatmessage_legacy';

            CREATE TABLE dbo.chatmessage (
                message_id INT PRIMARY KEY,
                from_coach_id INT NOT NULL,
                to_user_id INT NOT NULL,
                content NVARCHAR(MAX) NULL,
                sent_at DATETIME DEFAULT GETDATE(),
                read_flag BIT DEFAULT 0,
                sender_type VARCHAR(10) NOT NULL DEFAULT 'coach',
                CONSTRAINT FK_chatmessage_coach FOREIGN KEY (from_coach_id) REFERENCES dbo.coach(coach_id),
                CONSTRAINT FK_chatmessage_user FOREIGN KEY (to_user_id) REFERENCES dbo.users(user_id)
            );
        END
    `);
}

async function ensureModernColumns(pool) {
    await ensureColumn(pool, 'dbo.users', 'activity_level', 'NVARCHAR(20) NULL');
    await ensureColumn(pool, 'dbo.users', 'budget', "NVARCHAR(10) NULL DEFAULT 'moderate'");
    await ensureColumn(pool, 'dbo.users', 'subscription_end_date', 'DATETIME NULL');

    await ensureColumn(pool, 'dbo.user_health_profile', 'is_pregnant', 'BIT DEFAULT 0');
    await ensureColumn(pool, 'dbo.user_health_profile', 'allergies', 'VARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.user_health_profile', 'past_injuries', 'VARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.user_health_profile', 'other_conditions', 'VARCHAR(MAX) NULL');

    await ensureColumn(pool, 'dbo.InBodyScans', 'activity_level', 'NVARCHAR(20) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'age', 'INT NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'gender', 'NVARCHAR(10) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'inbody_score', 'FLOAT NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'training_frequency', 'INT DEFAULT 3');
    await ensureColumn(pool, 'dbo.InBodyScans', 'allergies', 'NVARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'disease', 'NVARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'budget', 'NVARCHAR(10) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'biological_age', 'FLOAT NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'predicted_goal', 'NVARCHAR(50) NULL');
    await ensureColumn(pool, 'dbo.InBodyScans', 'ai_notes', 'NVARCHAR(MAX) NULL');

    await ensureColumn(pool, 'dbo.generated_plans', 'biological_age', 'FLOAT NULL');
    await ensureColumn(pool, 'dbo.generated_plans', 'activity_level', 'NVARCHAR(20) NULL');
    await ensureColumn(pool, 'dbo.generated_plans', 'training_frequency', 'INT NULL');
    await ensureColumn(pool, 'dbo.generated_plans', 'budget', 'NVARCHAR(10) NULL');
    await ensureColumn(pool, 'dbo.generated_plans', 'allergies', 'NVARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.generated_plans', 'disease', 'NVARCHAR(MAX) NULL');

    await ensureColumn(pool, 'dbo.chatmessage', 'sender_type', "VARCHAR(10) NOT NULL DEFAULT 'coach'");
    await ensureColumnType(pool, 'dbo.chatmessage', 'content', 'NVARCHAR(MAX) NULL');

    await ensureColumn(pool, 'dbo.users', 'profile_picture_url', 'NVARCHAR(500) NULL');
    await ensureColumn(pool, 'dbo.users', 'reset_code', 'VARCHAR(6) NULL');
    await ensureColumn(pool, 'dbo.users', 'reset_code_expires_at', 'DATETIME NULL');
    await ensureColumn(pool, 'dbo.machine', 'machine_count', 'INT NOT NULL DEFAULT 1');
    await ensureColumn(pool, 'dbo.machine', 'location', 'VARCHAR(150) NULL');

    await ensureColumn(pool, 'dbo.shop', 'description', 'NVARCHAR(MAX) NULL');
    await ensureColumn(pool, 'dbo.shop', 'image_url', 'VARCHAR(255) NULL');
}

async function run() {
    const dbName = process.env.DB_NAME || 'SmartGym';
    const baseConfig = getBaseConfig();

    const masterPool = await new sql.ConnectionPool({ ...baseConfig, database: 'master' }).connect();
    try {
        await ensureDatabase(masterPool, dbName);
        console.log(`Database ready: ${dbName}`);
    } finally {
        await masterPool.close();
    }

    const appPool = await new sql.ConnectionPool({ ...baseConfig, database: dbName }).connect();
    try {
        const tableStatements = [
            `IF OBJECT_ID('dbo.users', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.users (
                     user_id INT PRIMARY KEY,
                     username VARCHAR(100) NOT NULL,
                     email VARCHAR(150) UNIQUE,
                     password_hash VARCHAR(255),
                     activity_level NVARCHAR(20) NULL,
                     budget NVARCHAR(10) DEFAULT 'moderate',
                     phone VARCHAR(30),
                     status VARCHAR(20) DEFAULT 'active',
                     created_at DATETIME DEFAULT GETDATE(),
                     subscription_end_date DATETIME,
                     profile_picture_url NVARCHAR(500) NULL,
                     reset_code VARCHAR(6) NULL,
                     reset_code_expires_at DATETIME NULL
                 );
             END`,
            `IF OBJECT_ID('dbo.subscription', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.subscription (
                     subscription_id BIGINT PRIMARY KEY,
                     user_id INT NOT NULL,
                     plan_name VARCHAR(50),
                     start_date DATE,
                     end_date DATE,
                     status VARCHAR(30),
                     renewal_type VARCHAR(50),
                     CONSTRAINT FK_subscription_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
                 );
             END`,
            `IF OBJECT_ID('dbo.payment', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.payment (
                     payment_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     subscription_id BIGINT NULL,
                     amount DECIMAL(10,2),
                     method VARCHAR(50),
                     status VARCHAR(30),
                     paid_at DATETIME,
                     CONSTRAINT FK_payment_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                     CONSTRAINT FK_payment_subscription FOREIGN KEY (subscription_id) REFERENCES dbo.subscription(subscription_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.tokenwallet', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.tokenwallet (
                     wallet_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     balance DECIMAL(12,2) DEFAULT 0,
                     updated_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_tokenwallet_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.TokenHistory', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.TokenHistory (
                     th_id INT PRIMARY KEY,
                     wallet_id INT NOT NULL,
                     type VARCHAR(20),
                     amount DECIMAL(12,2),
                     related_order_id BIGINT NULL,
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_tokenhistory_wallet FOREIGN KEY (wallet_id) REFERENCES dbo.tokenwallet(wallet_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.machine', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.machine (
                     machine_id INT PRIMARY KEY,
                     name VARCHAR(150),
                     location VARCHAR(150),
                     status VARCHAR(30),
                     tokens_required_per_minute INT,
                     machine_count INT NOT NULL DEFAULT 1
                 );
             END`,
            `IF OBJECT_ID('dbo.machine_sessions', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.machine_sessions (
                     session_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     machine_id INT NOT NULL,
                     start_time DATETIME DEFAULT GETDATE(),
                     end_time DATETIME,
                     tokens_deducted DECIMAL(10,2),
                     CONSTRAINT FK_machine_sessions_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                     CONSTRAINT FK_machine_sessions_machine FOREIGN KEY (machine_id) REFERENCES dbo.machine(machine_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.machinebooking', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.machinebooking (
                     booking_id INT PRIMARY KEY,
                     machine_id INT NOT NULL,
                     user_id INT NOT NULL,
                     start_time DATETIME,
                     end_time DATETIME,
                     tokens_spent DECIMAL(10,2),
                     status VARCHAR(30),
                     CONSTRAINT FK_machinebooking_machine FOREIGN KEY (machine_id) REFERENCES dbo.machine(machine_id),
                     CONSTRAINT FK_machinebooking_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.product', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.product (
                     product_id INT PRIMARY KEY,
                     name VARCHAR(200),
                     price DECIMAL(10,2),
                     stock_qty INT,
                     description VARCHAR(MAX)
                 );
             END`,
            `IF OBJECT_ID('dbo.[Order_Item]', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.[Order_Item] (
                     order_item_id INT PRIMARY KEY,
                     order_id INT NOT NULL,
                     user_id INT NOT NULL,
                     product_id INT NOT NULL,
                     qty INT,
                     unit_price DECIMAL(10,2),
                     total_amount DECIMAL(12,2),
                     status VARCHAR(30),
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_order_item_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                     CONSTRAINT FK_order_item_product FOREIGN KEY (product_id) REFERENCES dbo.product(product_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.feedback', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.feedback (
                     feedback_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     subject VARCHAR(200),
                     message VARCHAR(MAX),
                     rating INT,
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_feedback_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.shop', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.shop (
                     id INT PRIMARY KEY,
                     name VARCHAR(100),
                     description NVARCHAR(MAX),
                     price DECIMAL(10,2),
                     currency VARCHAR(10) DEFAULT 'EGP',
                     image_url VARCHAR(255),
                     stock_quantity INT DEFAULT 0,
                     created_at DATETIME DEFAULT GETDATE()
                 );
             END`,
            `IF OBJECT_ID('dbo.shop_history', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.shop_history (
                     sh_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     coach_id INT NULL,
                     admin_id INT NULL,
                     product_id INT NOT NULL,
                     quantity INT,
                     total_price DECIMAL(12,2),
                     purchased_at DATETIME DEFAULT GETDATE()
                 );
             END`,
            `IF OBJECT_ID('dbo.cart', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.cart (
                     cart_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     product_id INT NOT NULL,
                     quantity INT DEFAULT 1,
                     added_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_cart_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.payment_method', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.payment_method (
                     pm_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     card_type VARCHAR(20),
                     card_last4 CHAR(4),
                     card_holder VARCHAR(100),
                     is_default BIT DEFAULT 0,
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_payment_method_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.inbox_message', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.inbox_message (
                     message_id INT PRIMARY KEY,
                     sender_id INT NOT NULL,
                     sender_type VARCHAR(20) NOT NULL,
                     recipient_id INT NOT NULL,
                     content NVARCHAR(MAX),
                     sent_at DATETIME DEFAULT GETDATE(),
                     read_flag BIT DEFAULT 0
                 );
             END`,
            `IF OBJECT_ID('dbo.attendance', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.attendance (
                     att_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     machine_id INT NULL,
                     check_in_time DATETIME,
                     check_out_time DATETIME,
                     CONSTRAINT FK_attendance_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                     CONSTRAINT FK_attendance_machine FOREIGN KEY (machine_id) REFERENCES dbo.machine(machine_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.ai_agent_interaction', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.ai_agent_interaction (
                     ai_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     interaction_type VARCHAR(50),
                     input_summary VARCHAR(MAX),
                     output_summary VARCHAR(MAX),
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_ai_agent_interaction_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.chat_history', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.chat_history (
                     chat_id INT IDENTITY(1,1) PRIMARY KEY,
                     user_id INT NOT NULL,
                     session_id VARCHAR(255) NOT NULL,
                     sender_type VARCHAR(10) NOT NULL,
                     message_text NVARCHAR(MAX) NOT NULL,
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_chat_history_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
                 );
             END`,
            `IF OBJECT_ID('dbo.coach', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.coach (
                     coach_id INT PRIMARY KEY,
                     username VARCHAR(100),
                     email VARCHAR(150),
                     password_hash VARCHAR(255),
                     phone VARCHAR(30),
                     status VARCHAR(20) DEFAULT 'active',
                     created_at DATETIME DEFAULT GETDATE()
                 );
             END`,
            `IF OBJECT_ID('dbo.chatmessage', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.chatmessage (
                     message_id INT PRIMARY KEY,
                     from_coach_id INT NOT NULL,
                     to_user_id INT NOT NULL,
                     content NVARCHAR(MAX),
                     sent_at DATETIME DEFAULT GETDATE(),
                     read_flag BIT DEFAULT 0,
                     sender_type VARCHAR(10) NOT NULL DEFAULT 'coach',
                     CONSTRAINT FK_chatmessage_coach FOREIGN KEY (from_coach_id) REFERENCES dbo.coach(coach_id),
                     CONSTRAINT FK_chatmessage_user FOREIGN KEY (to_user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.crowding_snapshot', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.crowding_snapshot (
                     snapshot_id INT PRIMARY KEY,
                     taken_at DATETIME DEFAULT GETDATE(),
                     gym_zone VARCHAR(150),
                     machine_id INT NULL,
                     current_count INT,
                     capacity_estimate INT,
                     CONSTRAINT FK_crowding_snapshot_machine FOREIGN KEY (machine_id) REFERENCES dbo.machine(machine_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.training_schedule', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.training_schedule (
                     schedule_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     title VARCHAR(200),
                     description VARCHAR(MAX),
                     start_date DATE,
                     end_date DATE,
                     CONSTRAINT FK_training_schedule_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.dietplan', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.dietplan (
                     diet_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     details VARCHAR(MAX),
                     start_date DATE,
                     end_date DATE,
                     CONSTRAINT FK_dietplan_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.admin', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.admin (
                     admin_id INT PRIMARY KEY,
                     username VARCHAR(100),
                     email VARCHAR(150) UNIQUE,
                     password_hash VARCHAR(255),
                     phone VARCHAR(30),
                     status VARCHAR(20) DEFAULT 'active',
                     created_at DATETIME DEFAULT GETDATE()
                 );
             END`,
            `IF OBJECT_ID('dbo.coach', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.coach (
                     coach_id INT PRIMARY KEY,
                     username VARCHAR(100),
                     email VARCHAR(150),
                     password_hash VARCHAR(255),
                     phone VARCHAR(30),
                     status VARCHAR(20) DEFAULT 'active',
                     created_at DATETIME DEFAULT GETDATE()
                 );
             END`,
            `IF OBJECT_ID('dbo.user_health_profile', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.user_health_profile (
                     health_id INT PRIMARY KEY,
                     user_id INT NOT NULL,
                     has_diabetes BIT DEFAULT 0,
                     has_hypertension BIT DEFAULT 0,
                     is_pregnant BIT DEFAULT 0,
                     heart_issues VARCHAR(255) NULL,
                     allergies VARCHAR(MAX) NULL,
                     past_injuries VARCHAR(MAX) NULL,
                     other_conditions VARCHAR(MAX) NULL,
                     blood_type VARCHAR(5),
                     updated_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_user_health_profile_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.InBodyScans', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.InBodyScans (
                     scan_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                     user_id INT NOT NULL,
                     scan_timestamp DATETIME2 DEFAULT GETDATE(),
                     activity_level NVARCHAR(20) NULL,
                     age INT NULL,
                     gender NVARCHAR(10) NULL,
                     weight_kg FLOAT NOT NULL,
                     height_cm FLOAT,
                     body_fat_pct FLOAT,
                     body_fat_mass FLOAT,
                     muscle_mass FLOAT,
                     smm FLOAT,
                     protein_mass FLOAT,
                     total_body_water FLOAT,
                     visceral_fat FLOAT,
                     bmr FLOAT,
                     waist_cm FLOAT,
                     inbody_score FLOAT,
                     training_frequency INT DEFAULT 3,
                     allergies NVARCHAR(MAX) NULL,
                     disease NVARCHAR(MAX) NULL,
                     budget NVARCHAR(10) NULL,
                     biological_age FLOAT NULL,
                     predicted_goal NVARCHAR(50),
                     ai_notes NVARCHAR(MAX),
                     CONSTRAINT FK_inbodyscans_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
                 );
             END`,
            `IF OBJECT_ID('dbo.generated_plans', 'U') IS NULL
             BEGIN
                 CREATE TABLE dbo.generated_plans (
                     plan_id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
                     user_id INT NOT NULL,
                     scan_id UNIQUEIDENTIFIER NOT NULL,
                     predicted_goal VARCHAR(100),
                     biological_age FLOAT NULL,
                     total_calories INT,
                     protein_g INT,
                     carbs_g INT,
                     fats_g INT,
                     activity_level NVARCHAR(20) NULL,
                     training_frequency INT NULL,
                     budget NVARCHAR(10) NULL,
                     allergies NVARCHAR(MAX) NULL,
                     disease NVARCHAR(MAX) NULL,
                     meal_plan_text NVARCHAR(MAX),
                     workout_plan_text NVARCHAR(MAX),
                     coach_notes NVARCHAR(MAX),
                     created_at DATETIME DEFAULT GETDATE(),
                     CONSTRAINT FK_generated_plans_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
                     CONSTRAINT FK_generated_plans_scan FOREIGN KEY (scan_id) REFERENCES dbo.InBodyScans(scan_id)
                 );
             END`
        ];

        for (const statement of tableStatements) {
            await ensureTable(appPool, statement);
        }

        await migrateChatMessageTable(appPool);
        await migrateGeneratedPlansTable(appPool);
        await ensureModernColumns(appPool);

        await ensureCheckConstraint(appPool, 'dbo.users', 'CK_users_activity_level', "(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'athlete'))");
        await ensureCheckConstraint(appPool, 'dbo.users', 'CK_users_budget', "(budget IN ('low', 'moderate', 'high'))");
        await ensureCheckConstraint(appPool, 'dbo.chat_history', 'CK_chat_history_sender_type', "(sender_type IN ('user', 'ai'))");
        await ensureCheckConstraint(appPool, 'dbo.chatmessage', 'CK_chatmessage_sender_type', "(sender_type IN ('user', 'coach'))");
        await ensureCheckConstraint(appPool, 'dbo.InBodyScans', 'CK_InBodyScans_activity_level', "(activity_level IN ('sedentary', 'light', 'moderate', 'active', 'athlete'))");
        await ensureCheckConstraint(appPool, 'dbo.InBodyScans', 'CK_InBodyScans_gender', "(gender IN ('male', 'female'))");
        await ensureCheckConstraint(appPool, 'dbo.InBodyScans', 'CK_InBodyScans_budget', "(budget IN ('low', 'moderate', 'high'))");

        console.log('Schema ready.');
    } finally {
        await appPool.close();
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Database setup failed:', err.message);
        process.exit(1);
    });
