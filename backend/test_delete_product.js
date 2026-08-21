require('dotenv').config();
const { sql, poolPromise } = require('./src/config/db');
const shopService = require('./src/services/shopService');

async function testDelete() {
    try {
        console.log("Connecting to DB...");
        await poolPromise;

        // Create a dummy product
        console.log("Adding a product...");
        const product = await shopService.addProduct({
            name: 'Test Delete Product',
            description: 'This is a test',
            price: 100,
            stockQuantity: 10
        });
        
        console.log("Product added:", product.product_id);

        // Add dummy history for the product to simulate FK constraint
        console.log("Adding product to shop_history...");
        const pool = await poolPromise;
        
        // Find a user ID to use, or use 2
        await pool.request().query(`
            INSERT INTO dbo.shop_history (sh_id, user_id, product_id, quantity, total_price, purchased_at)
            VALUES ((SELECT ISNULL(MAX(sh_id), 0) + 1 FROM dbo.shop_history), 2, ${product.product_id}, 1, 100, GETDATE())
        `);

        console.log("Deleting product...");
        await shopService.deleteProduct(product.product_id);

        console.log("Product deleted successfully. Test passed!");
        process.exit(0);
    } catch (e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}

testDelete();
