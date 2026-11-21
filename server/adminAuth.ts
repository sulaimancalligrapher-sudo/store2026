import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Ephemeral fallback secret for HMAC session signing when ADMIN_SESSION_SECRET is not provided.
const EPHEMERAL_SIGNING_KEY = crypto.randomBytes(32);

function getSigningKey(): Buffer {
  const configured = process.env.ADMIN_SESSION_SECRET?.trim();
  if (configured) {
    return crypto.createHash('sha256').update(configured).digest();
  }
  return EPHEMERAL_SIGNING_KEY;
}

let claimedPasswordHash: string | null = null;
let claimingInFlight = false;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPasswordHash(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function getAdminAuthStatus(): {
  needsSetup: boolean;
  envConfigured: boolean;
} {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    return { needsSetup: false, envConfigured: true };
  }
  return {
    needsSetup: claimedPasswordHash === null,
    envConfigured: false,
  };
}

export function claimInitialAdminPassword(password: string): {
  ok: boolean;
  error?: string;
} {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    return { ok: false, error: 'تم ضبط كلمة مرور الإدارة مسبقاً في إعدادات البيئة.' };
  }
  if (claimingInFlight || claimedPasswordHash !== null) {
    return { ok: false, error: 'تم تعيين كلمة مرور الإدارة مسبقاً.' };
  }
  if (password.length < 6 || password.length > 100) {
    return { ok: false, error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' };
  }

  claimingInFlight = true;
  try {
    claimedPasswordHash = hashPassword(password);
    return { ok: true };
  } finally {
    claimingInFlight = false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const envPass = process.env.ADMIN_PASSCODE?.trim();
  if (envPass) {
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
  }
  if (!claimedPasswordHash) return false;
  return verifyPasswordHash(password, claimedPasswordHash);
}

export function issueAdminToken(): string {
  const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 hours
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSigningKey())
    .update(payload)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول للوصول إلى الإعدادات.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول.' });
    return;
  }
  next();
}
