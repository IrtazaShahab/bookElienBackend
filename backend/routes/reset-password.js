const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const db = require("../db");

// Temporary in-memory store (in production, use Redis)
const resetCodes = new Map();

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Verify transporter on startup — shows immediately if credentials are wrong
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Nodemailer transporter FAILED:", error.message);
    console.error("   → Make sure EMAIL_USER and EMAIL_PASS are set in your .env");
    console.error("   → Gmail requires an App Password (NOT your regular password)");
    console.error("   → Steps: Google Account → Security → 2-Step Verification → App passwords");
    console.error("   → Generate one at: https://myaccount.google.com/apppasswords");
  } else {
    console.log("✅ Nodemailer ready. Sending from:", process.env.EMAIL_USER);
  }
});

// Helper: generate and send a reset code
async function sendResetCode(email) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes.set(email, { code, expiry: Date.now() + 10 * 60 * 1000 });

  console.log(`📧 Sending reset code [${code}] to: ${email}`);

  await transporter.sendMail({
    from: `"BookEilen Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "BookEilen - Password Reset Code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111;border-radius:12px;padding:32px;color:#fff;border:1px solid #222;">
        <h1 style="color:#E20C11;margin:0 0 8px;">Book<span style="color:#fff;">Eilen</span></h1>
        <h2 style="font-size:20px;margin:24px 0 8px;">Password Reset Request</h2>
        <p style="color:#aaa;margin:0 0 24px;">Your verification code is:</p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#E20C11;">${code}</span>
        </div>
        <p style="color:#aaa;font-size:14px;margin:0 0 8px;">This code expires in <strong style="color:#fff;">10 minutes</strong>.</p>
        <p style="color:#666;font-size:13px;margin:0;">If you did not request this, ignore this email.</p>
      </div>
    `,
  });

  console.log(`✅ Email sent successfully to: ${email}`);
  return code;
}

// ─── POST /users/reset-password ───────────────────────────────────────────────
// Flow 1: { email }                      → send OTP
// Flow 2: { email, code, newPassword }   → verify + reset
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Flow 1: Send Code
    if (!code && !newPassword) {
      console.log(`🔐 Password reset requested for: ${email}`);
      const result = await db.query("SELECT id FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: "No account found with this email" });
      }
      await sendResetCode(email);
      return res.json({ success: true, message: "Verification code sent successfully!" });
    }

    // Flow 2: Reset Password
    if (!code || !newPassword) {
      return res.status(400).json({ message: "Code and new password are required" });
    }

    const stored = resetCodes.get(email);
    if (!stored) {
      return res.status(400).json({ message: "No reset request found. Please request a new code." });
    }
    if (stored.code !== code) {
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }
    if (Date.now() > stored.expiry) {
      resetCodes.delete(email);
      return res.status(400).json({ message: "Code has expired. Please request a new one." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password = $1 WHERE email = $2", [hashedPassword, email]);
    resetCodes.delete(email);

    console.log(`✅ Password reset successful for: ${email}`);
    return res.json({ success: true, message: "Password reset successful!" });

  } catch (error) {
    // Return the actual error message so you can debug it in the browser/UI
    console.error("❌ /reset-password error:", error.message);
    console.error(error.stack);
    return res.status(500).json({ message: error.message || "Server error. Please try again." });
  }
});

// ─── POST /users/verify-reset-code ───────────────────────────────────────────
router.post("/verify-reset-code", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "Email and code are required" });
  }

  const stored = resetCodes.get(email);
  if (!stored) {
    return res.status(400).json({ message: "No reset request found. Please request a new code." });
  }
  if (stored.code !== code) {
    return res.status(400).json({ message: "Incorrect code. Please try again." });
  }
  if (Date.now() > stored.expiry) {
    resetCodes.delete(email);
    return res.status(400).json({ message: "Code has expired. Please request a new one." });
  }

  // Do NOT delete yet — still needed for final password reset
  return res.json({ success: true, message: "Code verified successfully!" });
});

// ─── POST /users/forgot-password (legacy) ────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Email not found" });
    }
    await sendResetCode(email);
    res.json({ success: true, message: "Verification code sent successfully!" });
  } catch (error) {
    console.error("❌ /forgot-password error:", error.message);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

module.exports = router;