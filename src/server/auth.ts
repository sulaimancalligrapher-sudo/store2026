import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

let claimedPasswordHash: string | null = null;
let claimedPasswordSalt: string | null = null;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function getAuthSetupState() {
  const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  return {
    hasEnvAdminPassword: hasEnvPassword,
    hasClaimedAdminPassword: Boolean(claimedPasswordHash),
    needsInitialSetup: !hasEnvPassword && !claimedPasswordHash,
  };
}

export function claimInitialAdminPassword(password: string): { ok: boolean; error?: string } {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return { ok: false, error: 'كلمة مرور الإدارة محددة بالفعل في متغيرات البيئة (ADMIN_PASSWORD).' };
  }
  if (claimedPasswordHash) {
    return { ok: false, error: 'تم إعداد كلمة مرور الإدارة مسبقاً.' };
  }
  if (!password || password.trim().length < 6) {
    return { ok: false, error: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.' };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  claimedPasswordSalt = salt;
  claimedPasswordHash = hash;
  return { ok: true };
}

export function verifyAdminPassword(password: string): boolean {
  if (!password) return false;
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return safeEqual(password, envPass);
  }
  if (claimedPasswordHash && claimedPasswordSalt) {
    const candidate = crypto.scryptSync(password, claimedPasswordSalt, 64).toString('hex');
    return safeEqual(candidate, claimedPasswordHash);
  }
  return false;
}

export function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  if (!safeEqual(sig, expectedSig)) return false;
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

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'جلسة الإدارة غير صالحة أو منتهية. يرجى تسجيل الدخول.' });
    return;
  }
  next();
}
