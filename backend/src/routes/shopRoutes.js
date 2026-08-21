const express = require('express');
const shopController = require('../controllers/shopController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { upload, handleUploadError } = require('../middleware/uploadMiddleware');

const router = express.Router();

// ── Products (public read) ────────────────────────────────────────────────────
router.get('/products', shopController.listProducts);

// ── All routes below require authentication ────────────────────────────────────
router.use(authenticate, authorize('user', 'admin', 'coach'));

// ── Cart ──────────────────────────────────────────────────────────────────────
router.get('/cart', shopController.getCart);
router.post('/cart', shopController.addToCart);
router.put('/cart/:cartId', shopController.updateCartItem);
router.delete('/cart/:cartId', shopController.removeFromCart);
router.delete('/cart', shopController.clearCart);

// ── Checkout ──────────────────────────────────────────────────────────────────
router.post('/checkout', shopController.checkout);

// ── Purchase History ──────────────────────────────────────────────────────────
router.get('/history', shopController.getPurchaseHistory);

// ── Payment Methods (demo) ────────────────────────────────────────────────────
router.get('/payment-methods', shopController.getPaymentMethods);
router.post('/payment-methods', shopController.addPaymentMethod);
router.delete('/payment-methods/:pmId', shopController.deletePaymentMethod);

// ── Admin Shop Tools ──────────────────────────────────────────────────────────
router.post('/admin/products', authorize('admin'), upload.any(), handleUploadError, shopController.addProduct);
router.put('/admin/products/:productId', authorize('admin'), upload.any(), handleUploadError, shopController.updateProduct);
router.delete('/admin/products/:productId', authorize('admin'), shopController.deleteProduct);
router.get('/admin/low-stock', authorize('admin'), shopController.getLowStockAlerts);
router.get('/admin/inventory-history', authorize('admin'), shopController.getAllInventoryHistory);

module.exports = router;
