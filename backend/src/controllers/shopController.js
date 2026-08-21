const shopService = require('../services/shopService');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../utils/response');

// ── Products ──────────────────────────────────────────────────────────────────
exports.listProducts = asyncHandler(async (req, res) => {
    success(res, await shopService.listProducts());
});

// ── Admin Products ────────────────────────────────────────────────────────────

exports.addProduct = asyncHandler(async (req, res) => {
    const data = {
        name: req.body.name || req.body.productName || '',
        description: req.body.description || '',
        price: Number(req.body.price) || 0,
        stockQuantity: Number(req.body.quantity || req.body.stockQuantity || req.body.inStock) || 0,
    };
    if (req.files && req.files.length > 0) {
        data.imageUrl = `/uploads/products/${req.files[0].filename}`;
    } else if (req.file) {
        data.imageUrl = `/uploads/products/${req.file.filename}`;
    }
    success(res, await shopService.addProduct(data), 201);
});

exports.updateProduct = asyncHandler(async (req, res) => {
    const data = {
        name: req.body.name || req.body.productName || '',
        description: req.body.description || '',
        price: Number(req.body.price) || 0,
        stockQuantity: Number(req.body.quantity || req.body.stockQuantity || req.body.inStock) || 0,
    };
    if (req.files && req.files.length > 0) {
        data.imageUrl = `/uploads/products/${req.files[0].filename}`;
    } else if (req.file) {
        data.imageUrl = `/uploads/products/${req.file.filename}`;
    }
    success(res, await shopService.updateProduct(Number(req.params.productId), data));
});

exports.deleteProduct = asyncHandler(async (req, res) => {
    success(res, await shopService.deleteProduct(Number(req.params.productId)));
});

exports.getLowStockAlerts = asyncHandler(async (req, res) => {
    success(res, await shopService.getLowStockAlerts());
});

// ── Cart ──────────────────────────────────────────────────────────────────────
exports.getCart = asyncHandler(async (req, res) => {
    success(res, await shopService.getCart(req.user.userId));
});

exports.addToCart = asyncHandler(async (req, res) => {
    success(res, await shopService.addToCart(req.user.userId, req.body), 201);
});

exports.updateCartItem = asyncHandler(async (req, res) => {
    success(res, await shopService.updateCartItem(req.user.userId, Number(req.params.cartId), req.body));
});

exports.removeFromCart = asyncHandler(async (req, res) => {
    success(res, await shopService.removeFromCart(req.user.userId, Number(req.params.cartId)));
});

exports.clearCart = asyncHandler(async (req, res) => {
    success(res, await shopService.clearCart(req.user.userId));
});

// ── Checkout ──────────────────────────────────────────────────────────────────
exports.checkout = asyncHandler(async (req, res) => {
    success(res, await shopService.checkout(req.user.userId, req.body), 201);
});

// ── Purchase History ──────────────────────────────────────────────────────────
exports.getPurchaseHistory = asyncHandler(async (req, res) => {
    success(res, await shopService.getPurchaseHistory(req.user.userId));
});

exports.getAllInventoryHistory = asyncHandler(async (req, res) => {
    success(res, await shopService.getAllInventoryHistory());
});

// ── Payment Methods ───────────────────────────────────────────────────────────
exports.getPaymentMethods = asyncHandler(async (req, res) => {
    success(res, await shopService.getPaymentMethods(req.user.userId));
});

exports.addPaymentMethod = asyncHandler(async (req, res) => {
    success(res, await shopService.addPaymentMethod(req.user.userId, req.body), 201);
});

exports.deletePaymentMethod = asyncHandler(async (req, res) => {
    success(res, await shopService.deletePaymentMethod(req.user.userId, Number(req.params.pmId)));
});
