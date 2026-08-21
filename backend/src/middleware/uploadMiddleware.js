const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_PROFILES_DIR = path.join(__dirname, '../../uploads/profiles');
const UPLOAD_PRODUCTS_DIR = path.join(__dirname, '../../uploads/products');

if (!fs.existsSync(UPLOAD_PROFILES_DIR)) fs.mkdirSync(UPLOAD_PROFILES_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_PRODUCTS_DIR)) fs.mkdirSync(UPLOAD_PRODUCTS_DIR, { recursive: true });

// ─── Storage: one permanent file per user / unique for coaches / products ───
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        if (req.originalUrl && req.originalUrl.includes('/shop')) {
            cb(null, UPLOAD_PRODUCTS_DIR);
        } else {
            cb(null, UPLOAD_PROFILES_DIR);
        }
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
        if (req.originalUrl && req.originalUrl.includes('/coaches')) {
            cb(null, `coach_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
        } else if (req.originalUrl && req.originalUrl.includes('/shop')) {
            cb(null, `product_${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`);
        } else {
            // user_<userId>.<ext>  ← always overwrites the old photo
            cb(null, `user_${req.user.userId}${ext}`);
        }
    }
});

// ─── Filter: accept by MIME type OR by file extension ────────
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif', '']; // Allow empty extension for mobile generic uploads

const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isMimeOk = file.mimetype.startsWith('image/') || file.mimetype === 'application/octet-stream';
    const isExtOk  = ALLOWED_EXTENSIONS.includes(ext);

    if (isMimeOk && isExtOk) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Please upload an image file.`), false);
    }
};


const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB max
});

// ─── Error handler for multer (returns 400 not 500) ──────────
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ status: 'error', message: err.message });
    }
    if (err) {
        return res.status(400).json({ status: 'error', message: err.message });
    }
    next();
};

module.exports = { upload, handleUploadError };
