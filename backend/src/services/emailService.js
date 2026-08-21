const nodemailer = require('nodemailer');
const { logInfo, logError } = require('../utils/logger');

const createTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        logInfo('SMTP credentials missing. Email service running in MOCK mode (codes will be logged to console).');
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: (Number(SMTP_PORT) || 587) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });
};

const sendResetCode = async (email, code) => {
    const transporter = createTransporter();
    const subject = 'Your Password Reset Code - Smart Gym';
    const text = `Your password reset code is: ${code}. It will expire in 10 minutes.`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>You requested a password reset for your Smart Gym account.</p>
            <p>Your verification code is:</p>
            <div style="font-size: 24px; font-weight: bold; padding: 10px; background: #f4f4f4; border-radius: 5px; text-align: center; letter-spacing: 5px;">
                ${code}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;

    if (!transporter) {
        logInfo(`[MOCK EMAIL] To: ${email}, Code: ${code}`);
        return true;
    }

    try {
        await transporter.sendMail({
            from: `"Smart Gym AI" <${process.env.SMTP_USER}>`,
            to: email,
            subject,
            text,
            html
        });
        logInfo(`Reset code sent to ${email}`);
        return true;
    } catch (error) {
        logError(`Failed to send email to ${email}:`, error.message);
        // Fallback: log code to console so dev/testing can still work
        logInfo(`[FALLBACK] Reset code for ${email}: ${code}`);
        return true;  // Don't crash the API — code is saved in DB
    }
};

module.exports = {
    sendResetCode
};
