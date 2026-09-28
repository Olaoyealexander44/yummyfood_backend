import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Admin } from "../models/admin.model.js";
import { sendMail } from "../config/mailer.js";

// ---- OTP helpers -----------------------------------------------------------

const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_CODE_TTL_MINUTES = 15;

/** Generate a 6-digit numeric OTP string (no leading zero removed — String). */
const generateOtp = (): string => {
  let code = "";
  // Use crypto-safe randomness via node:crypto would be nicer, but Math.random
  // is fine for email-only 6-digit OTP (1/1M guess + 15min TTL).
  for (let i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

const expirationDate = (minutes: number): Date =>
  new Date(Date.now() + minutes * 60 * 1000);

/** Email the big formatted 6-digit OTP code to the admin. */
const sendOtpEmail = async (
  toEmail: string,
  toName: string,
  otp: string,
  ttlMinutes: number
): Promise<void> => {
  const digits = otp.split("");
  const digitBoxesHtml = digits
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:64px;height:80px;margin:0 6px;text-align:center;line-height:80px;font-size:40px;font-weight:900;letter-spacing:0.05em;background:linear-gradient(180deg,#fff8ec,#ffe7bd);color:#1e293b;border:2px solid #ffbd59;border-radius:14px;box-shadow:0 6px 14px -6px rgba(255,159,28,.55);font-family:'Segoe UI',Verdana,sans-serif;">${d}</span>`
    )
    .join("");

  await sendMail({
    to: toEmail,
    toName,
    subject: `Your ${VERIFICATION_CODE_LENGTH}-digit FPI Admin Verification Code: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #0f172a;">
        <div style="background: linear-gradient(90deg,#ffbd59,#ff9f1c); color: #0f172a; padding: 18px 24px; border-radius: 14px 14px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; letter-spacing: .01em;">🔐 FPI Admin Portal Verification</h1>
        </div>
        <div style="background:#ffffff; padding: 32px 28px; border: 1px solid #f1f5f9; border-top: none; border-radius: 0 0 14px 14px;">
          <p style="margin:0 0 6px; font-size:16px;">Hi ${toName.split(" ")[0]}, 👋</p>
          <p style="margin:0 0 24px; line-height:1.6; color:#334155;">
            Use the <strong>6-digit verification code</strong> below to confirm your email address.
            This code is single-use and will expire in <strong>${ttlMinutes} minutes</strong>.
          </p>

          <div style="text-align:center; margin: 26px 0 18px;">
            ${digitBoxesHtml}
          </div>

          <p style="text-align:center; font-size:13.5px; color:#64748b; margin:0 0 22px;">
            (Tip: You can copy-paste the full 6 digits into any box on the verification page)
          </p>

          <div style="background: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ff9f1c; padding: 12px 14px; border-radius: 8px; font-size: 13.5px; color: #7c2d12;">
            🔒 Never share this code with anyone, including anyone claiming to be from FPI.
          </div>

          <p style="margin-top:24px; color:#475569; font-size:14px;">
            Didn't request this? You can safely ignore this email — your account remains unverified until the code is entered.
          </p>
        </div>
        <p style="color:#94a3b8; font-size:12px; text-align:center; margin-top: 18px;">
          © ${new Date().getFullYear()} FPI Admin Portal · All rights reserved.
        </p>
      </div>
    `,
  });
};

// ---- Master key helper (timing-safe compare) ------------------------------
// We never do a simple string === on secrets to avoid timing side-channel
// attacks. crypto.timingSafeEqual is the Node primitive for this.
import { timingSafeEqual, randomBytes } from "node:crypto";

const validateMasterKey = (provided: unknown): boolean => {
  const expected = process.env.ADMIN_MASTER_KEY;
  if (!expected) {
    // If the server admin forgot to set the env key, block everything
    // rather than accidentally leaving it open.
    console.error(
      "⛔ ADMIN_MASTER_KEY is not set in .env — admin auth is disabled."
    );
    return false;
  }
  if (typeof provided !== "string" || provided.length === 0) return false;

  try {
    const enc = new TextEncoder();
    const expectedBytes = enc.encode(expected);
    const providedBytes = enc.encode(provided);
    // Pad the shorter one to the longer length to not leak length either
    const maxLen = Math.max(expectedBytes.length, providedBytes.length);
    const a = new Uint8Array(maxLen);
    a.set(expectedBytes);
    const b = new Uint8Array(maxLen);
    b.set(providedBytes);
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
export const adminSignup = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { firstName, lastName, email, password, masterKey } = req.body;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({
        success: false,
        message: "All fields are required",
      });
      return;
    }

    // ---- MASTER-KEY GATE ----
    if (!validateMasterKey(masterKey)) {
      // Rate-limit-style delay (500–900ms) to slow brute-force attempts
      const delay = 500 + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, delay));
      res.status(403).json({
        success: false,
        message: "Invalid admin access key. Contact the platform owner.",
      });
      return;
    }

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      res.status(409).json({
        success: false,
        message: "Admin already exists",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // ---- GENERATE 6-DIGIT OTP + HASH ----
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = expirationDate(VERIFICATION_CODE_TTL_MINUTES);

    const admin = await Admin.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "admin",
      isVerified: false,
      verificationCodeHash: otpHash,
      verificationCodeExpiresAt: otpExpiresAt,
    });

    // ---- EMAIL THE 6-DIGIT CODE (NOT A LINK) ----
    try {
      await sendOtpEmail(
        admin.email,
        `${admin.firstName} ${admin.lastName}`,
        otp,
        VERIFICATION_CODE_TTL_MINUTES
      );
      console.log(`✅ OTP ${otp} sent to ${admin.email}`);
    } catch (mailError) {
      console.error(`❌ Failed to send OTP email to ${admin.email}:`, mailError);
      // Account still created; user uses resend endpoint.
    }

    res.status(201).json({
      success: true,
      message: `Admin account created. A 6-digit verification code has been sent to ${admin.email}. Enter it on the verification page within ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
          isVerified: admin.isVerified,
          verifyPage: `${req.protocol}://${req.get("host") ?? "localhost:5000"}/api/auth/admin/verify?email=${encodeURIComponent(admin.email)}`,
        },
        // ⚠️ NEVER include the OTP here in production. It is ONLY in the email.
        // Dev-only convenience — remove the next line before going live:
        _devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const resendVerificationEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      // Generic message to avoid email enumeration
      res.status(400).json({
        success: false,
        message: "If a matching admin account exists, a new verification email has been sent.",
      });
      return;
    }

    if (admin.isVerified) {
      res.status(400).json({
        success: false,
        message: "This email is already verified. Please sign in.",
      });
      return;
    }

    // ---- GENERATE FRESH 6-DIGIT OTP + HASH ----
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = expirationDate(VERIFICATION_CODE_TTL_MINUTES);

    admin.verificationCodeHash = otpHash;
    admin.verificationCodeExpiresAt = otpExpiresAt;
    await admin.save();

    try {
      await sendOtpEmail(
        admin.email,
        `${admin.firstName} ${admin.lastName}`,
        otp,
        VERIFICATION_CODE_TTL_MINUTES
      );
      console.log(`✅ OTP ${otp} (re-sent) to ${admin.email}`);
    } catch (mailError) {
      console.error(`❌ Failed to re-send OTP email to ${admin.email}:`, mailError);
      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again or contact support.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `A new 6-digit verification code has been sent to ${admin.email}. Please check your inbox (and spam folder).`,
      data: {
        verifyPage: `${req.protocol}://${req.get("host") ?? "localhost:5000"}/api/auth/admin/verify?email=${encodeURIComponent(admin.email)}`,
      },
      // ⚠️ DEV ONLY convenience: remove before production:
      _devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// ---------------------------------------------------------------------------
// OTP verification UI renderer
// ---------------------------------------------------------------------------
type PageStatus =
  | "form"
  | "success"
  | "already-verified"
  | "expired"
  | "invalid";

interface PageDetails {
  adminName?: string;
  adminEmail?: string;
  prefillEmail?: string;
  errorMessage?: string;
}

const pageHeaderStyles = (
  accent: string
): string => `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; min-height: 100%; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background:
      radial-gradient(1200px 600px at 10% -10%, rgba(255,189,89,0.35), transparent 60%),
      radial-gradient(900px 500px at 110% 10%, rgba(255,159,28,0.18), transparent 60%),
      linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0b1220 100%);
    color: #0f172a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px 20px 48px;
  }
  .card {
    width: 100%;
    max-width: 520px;
    background: #ffffff;
    border-radius: 20px;
    box-shadow:
      0 30px 60px -20px rgba(0,0,0,0.55),
      0 10px 20px -10px rgba(255,189,89,0.35);
    overflow: hidden;
    animation: pop 520ms cubic-bezier(.2,.9,.3,1.3) both;
  }
  .brand-bar {
    height: 8px;
    background: linear-gradient(90deg, #ffbd59 0%, #ff9f1c 50%, #ffbd59 100%);
    background-size: 200% 100%;
    animation: shimmer 4s linear infinite;
  }
  .card-body { padding: 32px 30px 28px; }
  .icon {
    width: 72px; height: 72px; border-radius: 50%;
    display: grid; place-items: center;
    font-size: 34px; margin: 0 auto 16px;
    background: ${accent}18;
    border: 2px solid ${accent}55;
    box-shadow: 0 10px 25px -10px ${accent}88;
    animation: icon-in 700ms ease-out both;
  }
  h1 {
    margin: 0 0 8px; font-size: 26px; text-align: center;
    color: #0f172a; letter-spacing: -0.01em;
  }
  p.body {
    margin: 0 0 22px; line-height: 1.6; color: #334155;
    text-align: center; font-size: 15px;
  }
  .divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, #e2e8f0 40%, #ffbd59 60%, #e2e8f0 70%, transparent);
    margin: 2px 0 22px; opacity: .85;
  }
  .btn {
    display: block; width: 100%; text-align: center;
    text-decoration: none; color: #0f172a; font-weight: 700;
    background: linear-gradient(180deg, #ffd37e 0%, #ffbd59 45%, #ffac33 100%);
    padding: 14px 18px; border-radius: 12px; border: 1px solid rgba(255,159,28,0.55);
    box-shadow: inset 0 -2px 0 rgba(0,0,0,0.08), 0 8px 20px -6px rgba(255,159,28,0.55);
    transition: transform .15s ease, box-shadow .2s ease, filter .2s ease;
    font-size: 15px; letter-spacing: 0.01em; cursor: pointer;
  }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.04); box-shadow: 0 12px 28px -8px rgba(255,159,28,0.65); }
  .btn:active { transform: translateY(0); filter: brightness(.98); }
  .btn.secondary {
    margin-top: 10px;
    background: transparent; color: #334155;
    border: 1px solid #cbd5e1; box-shadow: none; font-weight: 600;
  }
  .btn.secondary:hover { background: #f8fafc; }
  footer.card-foot {
    padding: 14px 32px 20px; text-align: center;
    color: #94a3b8; font-size: 12.5px;
    background: #f8fafc; border-top: 1px solid #f1f5f9;
  }
  .logo {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; margin-bottom: 6px;
  }
  .logo-mark {
    width: 28px; height: 28px; border-radius: 8px;
    background: linear-gradient(135deg, #ffbd59, #ff9f1c);
    display: grid; place-items: center;
    color: #1e293b; font-weight: 900; font-size: 14px;
    box-shadow: 0 4px 8px -2px rgba(255,159,28,.55);
  }
  .logo-name { font-weight: 800; color: #0f172a; letter-spacing: 0.02em; }
  .hint {
    text-align: center; color: #94a3b8;
    font-size: 12.5px; margin-top: 12px;
  }
  .alert {
    border-radius: 10px; padding: 10px 14px; margin: 0 0 18px;
    font-size: 13.5px; line-height: 1.5;
    display: flex; align-items: center; gap: 10px;
    background: #fff1f2; border: 1px solid #fecdd3; color: #9f1239;
  }
  .alert.warn { background: #fff7ed; border-color: #ffedd5; color: #9a3412; }
  .alert.ok { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  label.field {
    display: block; font-size: 13px; font-weight: 600; color: #334155; margin: 0 0 8px;
  }
  input[type="email"] {
    width: 100%; padding: 13px 14px; border-radius: 10px;
    border: 1.5px solid #cbd5e1; background: #f8fafc;
    font-size: 15px; color: #0f172a; transition: all .15s ease; outline: none;
  }
  input[type="email"]:focus {
    border-color: #ffbd59; background: #fff;
    box-shadow: 0 0 0 4px rgba(255,189,89,.18);
  }
  .otp-row {
    display: flex; justify-content: center; gap: 10px; margin: 10px 0 18px;
  }
  .otp {
    width: 48px; height: 60px; border-radius: 12px;
    border: 1.5px solid #cbd5e1; background: #f8fafc;
    font-size: 24px; font-weight: 900; text-align: center;
    color: #0f172a; letter-spacing: 0; outline: none;
    transition: all .15s ease;
    caret-color: #ffbd59;
    font-family: 'Segoe UI', Verdana, sans-serif;
  }
  .otp:focus {
    border-color: #ffbd59; background: #fff;
    box-shadow: 0 0 0 4px rgba(255,189,89,.18); transform: translateY(-1px);
  }
  .otp.filled { border-color: #fcd34d; background: #fffbeb; }
  .meta {
    margin: 2px 0 18px;
    display: flex; justify-content: space-between;
    align-items: center; font-size: 12.5px; color: #64748b;
  }
  .meta a {
    color: #c2410c; font-weight: 700; text-decoration: none;
  }
  .meta a:hover { text-decoration: underline; }
  @keyframes pop {
    0%   { opacity: 0; transform: translateY(14px) scale(.97); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes shimmer {
    0% { background-position: 0% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes icon-in {
    0% { opacity: 0; transform: scale(.4) rotate(-20deg); }
    60% { opacity: 1; transform: scale(1.08) rotate(2deg); }
    100% { transform: scale(1) rotate(0); }
  }
`;

const renderOtpPage = (status: PageStatus, details: PageDetails = {}): string => {
  const year = new Date().getFullYear();
  const {
    adminName,
    adminEmail,
    prefillEmail = "",
    errorMessage = "",
  } = details;

  const accentByStatus: Record<PageStatus, string> = {
    form: "#ff9f1c",
    success: "#16a34a",
    "already-verified": "#0369a1",
    expired: "#d97706",
    invalid: "#dc2626",
  };
  const accent = accentByStatus[status];
  const styles = pageHeaderStyles(accent);

  // --- Result pages (no form) ---
  if (status !== "form") {
    const resultContent: Record<Exclude<PageStatus, "form">, { title: string; emoji: string; body: string }> = {
      success: {
        title: "Email Verified!",
        emoji: "🎉",
        body: adminName
          ? `Welcome to FPI Admin Portal, <strong>${adminName}</strong>! Your email <em>${adminEmail ?? ""}</em> has been confirmed. Your account is now active — you can sign in and start managing the platform.`
          : "Your email has been verified successfully. Your account is now active — you can sign in and start managing the FPI Admin Portal.",
      },
      "already-verified": {
        title: "Already Verified",
        emoji: "✅",
        body: "This email has already been verified. Your account is active — go ahead and sign in.",
      },
      expired: {
        title: "Code Expired",
        emoji: "⏰",
        body: "Your 6-digit verification code has expired (15-minute limit). Request a fresh code and we'll send a new email right away.",
      },
      invalid: {
        title: "Code Didn't Match",
        emoji: "⚠️",
        body:
          errorMessage || "That 6-digit code didn't match. Double-check the digits in the latest email we sent, or request a new code.",
      },
    };
    const r = resultContent[status as Exclude<PageStatus, "form">];
    const showResend = status === "expired" || status === "invalid";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${r.title} — FPI Admin Portal</title>
  <style>${styles}</style>
</head>
<body>
  <main class="card" role="main">
    <div class="brand-bar"></div>
    <div class="card-body">
      <div class="logo">
        <div class="logo-mark">F</div>
        <div class="logo-name">FPI Admin Portal</div>
      </div>
      <div class="icon">${r.emoji}</div>
      <h1>${r.title}</h1>
      <p class="body">${r.body}</p>
      <div class="divider"></div>
      <button class="btn" onclick="window.close()">Done — Close Tab</button>
      ${showResend ? `<button class="btn secondary" onclick="location.href='/api/auth/admin/verify?email=${encodeURIComponent(prefillEmail || adminEmail || "")}'">Go back & try again / request new code</button>` : ""}
    </div>
    <footer class="card-foot">© ${year} FPI Admin Portal · All rights reserved.</footer>
  </main>
</body>
</html>`;
  }

  // --- OTP input form page ---
  const emailValEnc = prefillEmail.replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify Your Email — FPI Admin Portal</title>
  <style>${styles}</style>
</head>
<body>
  <main class="card" role="main">
    <div class="brand-bar"></div>
    <div class="card-body">
      <div class="logo">
        <div class="logo-mark">F</div>
        <div class="logo-name">FPI Admin Portal</div>
      </div>
      <div class="icon">🔐</div>
      <h1>Verify Your Email</h1>
      <p class="body">We just sent a <strong>6-digit verification code</strong> to your email. Enter it below to confirm your account and sign in.</p>
      ${errorMessage ? `<div class="alert warn">⚠️ ${errorMessage}</div>` : ""}
      <form id="vf" action="/api/auth/admin/verify" method="post" novalidate>
        <label class="field" for="email">Admin Email</label>
        <input type="email" id="email" name="email" autocomplete="email" value="${emailValEnc}" placeholder="you@email.com" required />
        <div style="height:18px"></div>
        <label class="field" for="d0">6-Digit Verification Code</label>
        <div class="otp-row" aria-label="6 digit code">
          <input class="otp" id="d0" name="d0" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1" />
          <input class="otp" id="d1" name="d1" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 2" />
          <input class="otp" id="d2" name="d2" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 3" />
          <input class="otp" id="d3" name="d3" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 4" />
          <input class="otp" id="d4" name="d4" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 5" />
          <input class="otp" id="d5" name="d5" inputmode="numeric" pattern="[0-9]" maxlength="1" autocomplete="one-time-code" aria-label="Digit 6" />
        </div>
        <input type="hidden" name="code" id="code" />
        <div class="meta">
          <span>⏱️ Code expires in 15 minutes</span>
          <a href="#" id="resendLnk">Resend code</a>
        </div>
        <button type="submit" class="btn">Verify Email & Activate Account</button>
      </form>
      <p class="hint">Didn't get the email? Check Spam or Promotions, or click "Resend code".</p>
    </div>
    <footer class="card-foot">© ${year} FPI Admin Portal · All rights reserved.</footer>
  </main>
  <script>
  (function () {
    const inputs = Array.from(document.querySelectorAll('input.otp'));
    const codeField = document.getElementById('code');
    const form = document.getElementById('vf');
    const emailField = document.getElementById('email');
    const resendLnk = document.getElementById('resendLnk');

    // Focus first empty OTP box on load (or email if missing)
    window.addEventListener('load', () => {
      if (!emailField.value) { emailField.focus(); return; }
      inputs[0].focus();
    });

    // Auto-advance and backspace-to-back
    inputs.forEach((inp, idx) => {
      inp.addEventListener('input', (e) => {
        let v = inp.value.replace(/\D/g, '');
        // If user pasted 2+ digits, distribute them
        if (v.length > 1) {
          const digits = v.split('');
          for (let k = 0; k < digits.length && idx + k < inputs.length; k++) {
            inputs[idx + k].value = digits[k];
            inputs[idx + k].classList.add('filled');
          }
          const nxt = Math.min(idx + digits.length, inputs.length - 1);
          inputs[nxt].focus();
          inp.value = (digits[0] ?? '');
          return;
        }
        if (v.length === 1) {
          inp.classList.add('filled');
          if (idx < inputs.length - 1) inputs[idx + 1].focus();
        } else {
          inp.classList.remove('filled');
        }
        inp.value = v;
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) {
          inputs[idx - 1].focus();
          inputs[idx - 1].value = '';
          inputs[idx - 1].classList.remove('filled');
        }
        if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1].focus();
        if (e.key === 'ArrowRight' && idx < inputs.length - 1) inputs[idx + 1].focus();
      });
      inp.addEventListener('paste', (e) => {
        const data = (e.clipboardData || window.clipboardData).getData('text');
        if (!data) return;
        const digits = data.replace(/\D/g, '').split('').slice(0, 6);
        if (digits.length === 0) return;
        e.preventDefault();
        for (let k = 0; k < digits.length; k++) {
          inputs[k].value = digits[k];
          inputs[k].classList.add('filled');
        }
        inputs[Math.min(digits.length, inputs.length - 1)].focus();
      });
    });

    // Combine boxes into hidden code field on submit
    form.addEventListener('submit', (e) => {
      const code = inputs.map(i => i.value).join('');
      if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        e.preventDefault();
        alert('Please enter all 6 digits of your verification code.');
        return;
      }
      if (!emailField.value) {
        e.preventDefault();
        alert('Please enter your email address.');
        emailField.focus();
        return;
      }
      codeField.value = code;
    });

    // Resend code via POST to resend-code endpoint
    resendLnk.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!emailField.value) { alert('Enter your email first, then click resend.'); emailField.focus(); return; }
      resendLnk.textContent = 'Sending…';
      resendLnk.style.pointerEvents = 'none';
      try {
        const r = await fetch('/api/auth/admin/resend-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailField.value }),
        });
        const j = await r.json();
        alert(j.message || 'Resend requested. If this email matches an unverified admin, a new code was sent.');
        resendLnk.textContent = 'Sent! Check inbox.';
        setTimeout(() => { resendLnk.textContent = 'Resend code'; resendLnk.style.pointerEvents = ''; }, 3500);
      } catch (err) {
        alert('Failed to request a new code. Please try again.');
        resendLnk.textContent = 'Resend code';
        resendLnk.style.pointerEvents = '';
      }
    });
  })();
  </script>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Decide if the request should render an HTML page vs JSON response.
// HTML: GET + browser Accepts text/html (or Sec-Fetch-Dest = document)
// JSON: Everything else (Postman POST, curl, API clients, etc.)
const clientWantsHtml = (req: Request): boolean => {
  if (req.method !== "GET") return false;
  const accept = (req.headers.accept as string | undefined) ?? "";
  const secFetchDest = (req.headers["sec-fetch-dest"] as string | undefined) ?? "";
  return accept.includes("text/html") || secFetchDest === "document";
};

// ---------------------------------------------------------------------------
// Verify using OTP {email, 6-digit code} — either via browser form submit
// (POST HTML) or via Postman/API (POST JSON). GET returns the HTML form.
// ---------------------------------------------------------------------------
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  const wantsHtml = clientWantsHtml(req);

  // Helper: render a status-page response (or JSON)
  const send = (
    statusCode: number,
    jsonPayload: { success: boolean; message: string },
    page: PageStatus,
    details?: PageDetails
  ): void => {
    res.status(statusCode);
    if (wantsHtml || page === "form") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderOtpPage(page, details));
    } else {
      res.json(jsonPayload);
    }
  };

  // --- GET: show the OTP input form (optionally with prefilled email) ---
  if (req.method === "GET" && wantsHtml) {
    const prefillEmail = (req.query.email as string) || "";
    // Backwards compat: if old JWT-link style ?token= is still in URL, ignore it
    // and just show the form with any ?email= prefill.
    return send(
      200,
      { success: true, message: "Use the OTP form to enter your 6-digit code" },
      "form",
      { prefillEmail }
    );
  }

  // --- POST: accept {email, code} OR {email, d0..d5} from the form ---
  try {
    const email: string =
      (req.body?.email as string) || (req.query.email as string) || "";

    // Accept plain string `code` (Postman/API) OR 6 fields from the HTML form
    let code: string = (req.body?.code as string) || "";
    if (!code) {
      const parts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const d = (req.body?.[`d${i}`] as string) ?? "";
        if (d) parts.push(d);
      }
      code = parts.join("");
    }

    // ---- VALIDATE INPUTS ----
    if (!email) {
      const msg = "Email is required";
      return send(
        400,
        { success: false, message: msg },
        "form",
        { errorMessage: msg, prefillEmail: email }
      );
    }
    if (!/^\d{6}$/.test(code)) {
      const msg = "Please enter a valid 6-digit numeric code";
      return send(
        400,
        { success: false, message: msg },
        "form",
        { errorMessage: msg, prefillEmail: email }
      );
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      // Generic error message (email enumeration protection)
      return send(
        400,
        { success: false, message: "Invalid email or code" },
        "invalid",
        { adminEmail: email, prefillEmail: email }
      );
    }

    if (admin.isVerified) {
      return send(
        400,
        { success: false, message: "Email is already verified" },
        "already-verified",
        {
          adminName: `${admin.firstName} ${admin.lastName}`,
          adminEmail: admin.email,
          prefillEmail: email,
        }
      );
    }

    if (!admin.verificationCodeHash || !admin.verificationCodeExpiresAt) {
      return send(
        400,
        { success: false, message: "No pending verification code. Request a new one via resend." },
        "expired",
        { adminEmail: email, prefillEmail: email }
      );
    }

    // ---- EXPIRED? ----
    if (new Date() > admin.verificationCodeExpiresAt) {
      // Wipe for safety
      admin.verificationCodeHash = null;
      admin.verificationCodeExpiresAt = null;
      await admin.save();
      return send(
        400,
        { success: false, message: "Verification code has expired. Please request a new one." },
        "expired",
        { adminEmail: email, prefillEmail: email }
      );
    }

    // ---- MATCH? ----
    const matches = await bcrypt.compare(code, admin.verificationCodeHash);
    if (!matches) {
      return send(
        400,
        { success: false, message: "Invalid code" },
        "invalid",
        {
          adminEmail: email,
          prefillEmail: email,
          errorMessage: "That 6-digit code didn't match the one we emailed you. Double-check or request a fresh code.",
        }
      );
    }

    // ---- SUCCESS: mark verified, wipe the single-use OTP fields ----
    admin.isVerified = true;
    admin.verificationCodeHash = null;
    admin.verificationCodeExpiresAt = null;
    await admin.save();

    return send(
      200,
      { success: true, message: "Email verified successfully. You can now sign in." },
      "success",
      {
        adminName: `${admin.firstName} ${admin.lastName}`,
        adminEmail: admin.email,
      }
    );
  } catch (error) {
    console.error(error);
    return send(
      500,
      { success: false, message: "Something went wrong" },
      "invalid"
    );
  }
};

export const adminSignin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, masterKey } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // ---- MASTER-KEY GATE (same as signup) ----
    if (!validateMasterKey(masterKey)) {
      const delay = 500 + Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, delay));
      res.status(403).json({
        success: false,
        message: "Invalid admin access key. Contact the platform owner.",
      });
      return;
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const passwordMatch = await bcrypt.compare(
      password,
      admin.password
    );

    if (!passwordMatch) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    // ---- BLOCK SIGNIN UNTIL EMAIL IS VERIFIED ----
    if (!admin.isVerified) {
      res.status(403).json({
        success: false,
        message: "Email not verified. Please verify your email before signing in.",
      });
      return;
    }

    // ---- ACCESS JWT (long-lived: 7d, used for protected routes) ----
    const token = jwt.sign(
      {
        id: admin._id.toString(),
        role: admin.role,
        type: "access",
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      success: true,
      message: "Admin signed in successfully",
      data: {
        admin: {
          id: admin._id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
          isVerified: admin.isVerified,
        },
        token,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};