const { sql, poolPromise } = require('../config/db');
const ApiError = require('../utils/apiError');
const { withAllocatedIntId } = require('../utils/idAllocator');

// ─── Products ────────────────────────────────────────────────────────────────

const listProducts = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT id AS product_id, name, description, price, currency, 
               image_url, image_url AS imageUrl, image_url AS image, 
               stock_quantity, stock_quantity AS quantity, created_at,
               CASE
                   WHEN stock_quantity >= 100 THEN 'IN_STOCK'
                   WHEN stock_quantity > 0 THEN 'LOW_STOCK'
                   ELSE 'OUT_OF_STOCK'
               END AS stock_status
        FROM dbo.shop
        ORDER BY id ASC
    `);
    return result.recordset;
};

// ─── Admin Product Management ────────────────────────────────────────────────

const addProduct = async ({ name, description, price, currency = 'EGP', imageUrl, stockQuantity }) => {
    const pool = await poolPromise;
    const idAlloc = await withAllocatedIntId(pool, 'dbo.shop', 'id', 'productId');
    const result = await idAlloc.bind(pool.request())
        .input('name', sql.VarChar(100), name)
        .input('description', sql.NVarChar(sql.MAX), description)
        .input('price', sql.Decimal(10, 2), price)
        .input('currency', sql.VarChar(10), currency)
        .input('imageUrl', sql.VarChar(255), imageUrl || null)
        .input('stockQuantity', sql.Int, stockQuantity)
        .query(`
            INSERT INTO dbo.shop (id, name, description, price, currency, image_url, stock_quantity, created_at)
            OUTPUT 
                INSERTED.id AS product_id, INSERTED.name, INSERTED.description, 
                INSERTED.price, INSERTED.currency, 
                INSERTED.image_url, INSERTED.image_url AS imageUrl, INSERTED.image_url AS image, 
                INSERTED.stock_quantity, INSERTED.stock_quantity AS quantity, 
                INSERTED.created_at,
                CASE
                    WHEN INSERTED.stock_quantity >= 100 THEN 'IN_STOCK'
                    WHEN INSERTED.stock_quantity > 0 THEN 'LOW_STOCK'
                    ELSE 'OUT_OF_STOCK'
                END AS stock_status
            VALUES (@productId, @name, @description, @price, @currency, @imageUrl, @stockQuantity, GETDATE())
        `);
    return result.recordset[0];
};

const updateProduct = async (productId, { name, description, price, currency = 'EGP', imageUrl, stockQuantity }) => {
    const pool = await poolPromise;
    const check = await pool.request()
        .input('productId', sql.Int, productId)
        .query('SELECT id FROM dbo.shop WHERE id = @productId');

    if (check.recordset.length === 0) throw new ApiError(404, 'Product not found');

    let query = `
        UPDATE dbo.shop
        SET name = @name, description = @description, price = @price,
            currency = @currency, stock_quantity = @stockQuantity
    `;
    if (imageUrl) {
        query += `, image_url = @imageUrl`;
    }
    query += ` OUTPUT 
                INSERTED.id AS product_id, INSERTED.name, INSERTED.description, 
                INSERTED.price, INSERTED.currency, 
                INSERTED.image_url, INSERTED.image_url AS imageUrl, INSERTED.image_url AS image, 
                INSERTED.stock_quantity, INSERTED.stock_quantity AS quantity, 
                INSERTED.created_at,
                CASE
                    WHEN INSERTED.stock_quantity >= 100 THEN 'IN_STOCK'
                    WHEN INSERTED.stock_quantity > 0 THEN 'LOW_STOCK'
                    ELSE 'OUT_OF_STOCK'
                END AS stock_status
             WHERE id = @productId`;

    const request = pool.request()
        .input('productId', sql.Int, productId)
        .input('name', sql.VarChar(100), name)
        .input('description', sql.NVarChar(sql.MAX), description)
        .input('price', sql.Decimal(10, 2), price)
        .input('currency', sql.VarChar(10), currency)
        .input('stockQuantity', sql.Int, stockQuantity);

    if (imageUrl) {
        request.input('imageUrl', sql.VarChar(255), imageUrl);
    }

    const result = await request.query(query);
    return result.recordset[0];
};

const deleteProduct = async (productId) => {
    const pool = await poolPromise;
    const check = await pool.request()
        .input('productId', sql.Int, productId)
        .query('SELECT id FROM dbo.shop WHERE id = @productId');

    if (check.recordset.length === 0) throw new ApiError(404, 'Product not found');

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        // Delete related cart items
        await new sql.Request(transaction)
            .input('productId', sql.Int, productId)
            .query('DELETE FROM dbo.cart WHERE product_id = @productId');

        // Delete related shop history items
        await new sql.Request(transaction)
            .input('productId', sql.Int, productId)
            .query('DELETE FROM dbo.shop_history WHERE product_id = @productId');

        // Delete the product itself
        await new sql.Request(transaction)
            .input('productId', sql.Int, productId)
            .query('DELETE FROM dbo.shop WHERE id = @productId');

        await transaction.commit();
        return { deleted: true };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

const getLowStockAlerts = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT id AS product_id, name, description, price, currency, 
               image_url, image_url AS imageUrl, image_url AS image, 
               stock_quantity, stock_quantity AS quantity, created_at,
               CASE
                   WHEN stock_quantity > 0 THEN 'LOW_STOCK'
                   ELSE 'OUT_OF_STOCK'
               END AS stock_status
        FROM dbo.shop
        WHERE stock_quantity < 100
        ORDER BY stock_quantity ASC, id ASC
    `);
    return result.recordset;
};

// ─── Cart ────────────────────────────────────────────────────────────────────

const getCart = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT c.cart_id, c.quantity, c.added_at,
                   s.id AS product_id, s.name, s.description, s.price, s.currency, s.image_url,
                   (s.price * c.quantity) AS item_total
            FROM dbo.cart c
            JOIN dbo.shop s ON s.id = c.product_id
            WHERE c.user_id = @userId
            ORDER BY c.added_at DESC
        `);

    const items = result.recordset;
    const total = items.reduce((sum, item) => sum + Number(item.item_total), 0);
    return { items, total, count: items.length };
};

const addToCart = async (userId, { productId, quantity = 1 }) => {
    if (!productId) throw new ApiError(400, 'productId is required');
    if (Number(quantity) < 1) throw new ApiError(400, 'quantity must be at least 1');
    const pool = await poolPromise;

    // Check product exists and has stock
    const productResult = await pool.request()
        .input('productId', sql.Int, productId)
        .query('SELECT TOP 1 id, name, description, price, currency, image_url, stock_quantity FROM dbo.shop WHERE id = @productId');

    if (productResult.recordset.length === 0) throw new ApiError(404, 'Product not found');
    const product = productResult.recordset[0];
    if (product.stock_quantity < 1) throw new ApiError(400, 'Product is out of stock');

    // If already in cart → update quantity
    const existing = await pool.request()
        .input('userId', sql.Int, userId)
        .input('productId', sql.Int, productId)
        .query('SELECT TOP 1 cart_id, quantity FROM dbo.cart WHERE user_id = @userId AND product_id = @productId');

    if (existing.recordset.length > 0) {
        const newQty = existing.recordset[0].quantity + Number(quantity);
        await pool.request()
            .input('cartId', sql.Int, existing.recordset[0].cart_id)
            .input('quantity', sql.Int, newQty)
            .query('UPDATE dbo.cart SET quantity = @quantity WHERE cart_id = @cartId');
    } else {
        const cartIdAllocation = await withAllocatedIntId(pool, 'dbo.cart', 'cart_id', 'cartId');
        await cartIdAllocation.bind(pool.request())
            .input('userId', sql.Int, userId)
            .input('productId', sql.Int, productId)
            .input('quantity', sql.Int, Number(quantity))
            .query('INSERT INTO dbo.cart (cart_id, user_id, product_id, quantity) VALUES (@cartId, @userId, @productId, @quantity)');
    }

    return getCart(userId);
};

const updateCartItem = async (userId, cartId, { quantity }) => {
    const pool = await poolPromise;

    const existing = await pool.request()
        .input('cartId', sql.Int, cartId)
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 cart_id FROM dbo.cart WHERE cart_id = @cartId AND user_id = @userId');

    if (existing.recordset.length === 0) throw new ApiError(404, 'Cart item not found');

    if (Number(quantity) <= 0) {
        // Remove item if quantity = 0
        await pool.request()
            .input('cartId', sql.Int, cartId)
            .query('DELETE FROM dbo.cart WHERE cart_id = @cartId');
    } else {
        await pool.request()
            .input('cartId', sql.Int, cartId)
            .input('quantity', sql.Int, Number(quantity))
            .query('UPDATE dbo.cart SET quantity = @quantity WHERE cart_id = @cartId');
    }

    return getCart(userId);
};

const removeFromCart = async (userId, cartId) => {
    const pool = await poolPromise;
    const existing = await pool.request()
        .input('cartId', sql.Int, cartId)
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 cart_id FROM dbo.cart WHERE cart_id = @cartId AND user_id = @userId');

    if (existing.recordset.length === 0) throw new ApiError(404, 'Cart item not found');

    await pool.request()
        .input('cartId', sql.Int, cartId)
        .query('DELETE FROM dbo.cart WHERE cart_id = @cartId');

    return getCart(userId);
};

const clearCart = async (userId) => {
    const pool = await poolPromise;
    await pool.request()
        .input('userId', sql.Int, userId)
        .query('DELETE FROM dbo.cart WHERE user_id = @userId');
    return { cleared: true };
};

// ─── Checkout ────────────────────────────────────────────────────────────────

const checkout = async (userId, { paymentMethod = 'card' } = {}) => {
    const pool = await poolPromise;

    // Get cart items
    const cartResult = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT c.cart_id, c.quantity,
                   s.id AS product_id, s.name, s.price, s.currency, s.image_url, s.stock_quantity
            FROM dbo.cart c
            JOIN dbo.shop s ON s.id = c.product_id
            WHERE c.user_id = @userId
        `);

    if (cartResult.recordset.length === 0) throw new ApiError(400, 'Your cart is empty');

    const cartItems = cartResult.recordset;

    // Validate stock
    for (const item of cartItems) {
        if (item.stock_quantity < item.quantity) {
            throw new ApiError(400, `Insufficient stock for "${item.name}". Available: ${item.stock_quantity}`);
        }
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const purchasedItems = [];

        const purchasedAt = new Date(); // ensures all items in cart have exact same timestamp

        for (const item of cartItems) {
            const totalPrice = Number(item.price) * Number(item.quantity);

            // Allocate IDs
            const shIdAllocation = await withAllocatedIntId(transaction, 'dbo.shop_history', 'sh_id', 'shId');

            // Insert into shop_history
            const histResult = await shIdAllocation.bind(new sql.Request(transaction))
                .input('userId', sql.Int, userId)
                .input('productId', sql.Int, item.product_id)
                .input('quantity', sql.Int, item.quantity)
                .input('totalPrice', sql.Decimal(12, 2), totalPrice)
                .input('purchasedAt', sql.DateTime, purchasedAt)
                .query(`
                    INSERT INTO dbo.shop_history (sh_id, user_id, coach_id, admin_id, product_id, quantity, total_price, purchased_at)
                    OUTPUT INSERTED.sh_id, INSERTED.purchased_at
                    VALUES (@shId, @userId, NULL, NULL, @productId, @quantity, @totalPrice, @purchasedAt)
                `);

            // Deduct stock
            await new sql.Request(transaction)
                .input('productId', sql.Int, item.product_id)
                .input('quantity', sql.Int, item.quantity)
                .query('UPDATE dbo.shop SET stock_quantity = stock_quantity - @quantity WHERE id = @productId');

            purchasedItems.push({
                sh_id: histResult.recordset[0].sh_id,
                product_id: item.product_id,
                name: item.name,
                image_url: item.image_url,
                quantity: item.quantity,
                unit_price: Number(item.price),
                currency: item.currency || 'EGP',
                total_price: totalPrice,
                status: 'Completed',
                purchased_at: histResult.recordset[0].purchased_at
            });
        }

        // Clear the cart
        await new sql.Request(transaction)
            .input('userId', sql.Int, userId)
            .query('DELETE FROM dbo.cart WHERE user_id = @userId');

        await transaction.commit();

        const grandTotal = purchasedItems.reduce((sum, i) => sum + i.total_price, 0);
        return {
            success: true,
            payment_method: paymentMethod,
            payment_status: 'paid',
            items: purchasedItems,
            total: grandTotal,
            currency: 'EGP'
        };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

// ─── Purchase History ─────────────────────────────────────────────────────────

const getPurchaseHistory = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT
                sh.sh_id,
                sh.quantity,
                sh.total_price,
                sh.purchased_at,
                s.id    AS product_id,
                s.name,
                s.price AS unit_price,
                s.currency,
                s.image_url,
                'Completed' AS status
            FROM dbo.shop_history sh
            JOIN dbo.shop s ON s.id = sh.product_id
            WHERE sh.user_id = @userId
            ORDER BY sh.purchased_at DESC, sh.sh_id DESC
        `);

    const items = result.recordset;
    const totalSpent = items.reduce((sum, i) => sum + Number(i.total_price), 0);
    const totalOrders = items.length;

    return { totalOrders, totalSpent, items };
};

const getAllInventoryHistory = async () => {
    const pool = await poolPromise;
    const result = await pool.request().query(`
        SELECT
            sh.sh_id,
            sh.quantity,
            sh.total_price,
            sh.purchased_at,
            sh.user_id,
            u.username AS customer_name,
            s.id AS product_id,
            s.name,
            s.price AS unit_price,
            s.currency,
            s.image_url
        FROM dbo.shop_history sh
        JOIN dbo.shop s ON s.id = sh.product_id
        LEFT JOIN dbo.users u ON u.user_id = sh.user_id
        ORDER BY sh.purchased_at DESC, sh.user_id DESC, sh.sh_id DESC
    `);

    // Group items by exact purchased_at + user_id to form "Orders"
    const ordersMap = new Map();

    for (const row of result.recordset) {
        // use an ISO string or epoch ms as the group key.
        const key = `${row.user_id}_${row.purchased_at.getTime()}`;

        if (!ordersMap.has(key)) {
            ordersMap.set(key, {
                order_id: key,
                user_id: row.user_id,
                customer_name: row.customer_name || 'Unknown',
                purchased_at: row.purchased_at,
                total_order_price: 0,
                total_items_count: 0,
                items: []
            });
        }

        const order = ordersMap.get(key);
        order.items.push({
            sh_id: row.sh_id,
            product_id: row.product_id,
            name: row.name,
            quantity: row.quantity,
            total_price: Number(row.total_price),
            unit_price: Number(row.unit_price),
            currency: row.currency,
            image_url: row.image_url
        });
        order.total_order_price += Number(row.total_price);
        order.total_items_count += row.quantity;
    }

    return Array.from(ordersMap.values());
};

// ─── Payment Methods (Demo) ───────────────────────────────────────────────────

const getPaymentMethods = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
            SELECT pm_id, card_type, card_last4, card_holder, is_default, created_at
            FROM dbo.payment_method
            WHERE user_id = @userId
            ORDER BY is_default DESC, created_at DESC
        `);
    return result.recordset;
};

const addPaymentMethod = async (userId, { cardType = 'Visa', cardLast4, cardHolder }) => {
    const pool = await poolPromise;

    if (!cardLast4 || String(cardLast4).length !== 4) throw new ApiError(400, 'cardLast4 must be exactly 4 digits');
    if (!cardHolder || String(cardHolder).trim().length < 2) throw new ApiError(400, 'cardHolder name is required');

    // Set all existing to non-default
    await pool.request()
        .input('userId', sql.Int, userId)
        .query('UPDATE dbo.payment_method SET is_default = 0 WHERE user_id = @userId');

    const pmIdAllocation = await withAllocatedIntId(pool, 'dbo.payment_method', 'pm_id', 'pmId');
    const result = await pmIdAllocation.bind(pool.request())
        .input('userId', sql.Int, userId)
        .input('cardType', sql.VarChar(20), cardType)
        .input('cardLast4', sql.Char(4), String(cardLast4))
        .input('cardHolder', sql.VarChar(100), String(cardHolder).trim())
        .query(`
            INSERT INTO dbo.payment_method (pm_id, user_id, card_type, card_last4, card_holder, is_default)
            OUTPUT INSERTED.pm_id, INSERTED.card_type, INSERTED.card_last4, INSERTED.card_holder, INSERTED.is_default, INSERTED.created_at
            VALUES (@pmId, @userId, @cardType, @cardLast4, @cardHolder, 1)
        `);

    return result.recordset[0];
};

const deletePaymentMethod = async (userId, pmId) => {
    const pool = await poolPromise;
    const existing = await pool.request()
        .input('pmId', sql.Int, pmId)
        .input('userId', sql.Int, userId)
        .query('SELECT TOP 1 pm_id FROM dbo.payment_method WHERE pm_id = @pmId AND user_id = @userId');

    if (existing.recordset.length === 0) throw new ApiError(404, 'Payment method not found');

    await pool.request()
        .input('pmId', sql.Int, pmId)
        .query('DELETE FROM dbo.payment_method WHERE pm_id = @pmId');

    return { deleted: true };
};

module.exports = {
    listProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getLowStockAlerts,
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    checkout,
    getPurchaseHistory,
    getAllInventoryHistory,
    getPaymentMethods,
    addPaymentMethod,
    deletePaymentMethod
};
