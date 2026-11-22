import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { BACKEND_CONFIG } from './backendConfig.ts';
import { getPersistedAdminAuthFromSheets, savePersistedAdminAuthToSheets } from './sheetsAdapter.ts';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const fallbackRandomSecret = crypto.randomBytes(32).toString('hex');

let claimedUsername: string | null = null;
let claimedPasswordHash: string | null = null;
let claimedPasswordSalt: string | null = null;

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET?.trim();
  if (envSecret) return envSecret;

  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return crypto.createHmac('sha256', 'nukhba-serverless-session-key').update(envPass).digest('hex');
  }

  if (claimedPasswordHash && claimedPasswordSalt) {
    return crypto
      .createHmac('sha256', 'nukhba-claimed-session-key')
      .update(`${claimedPasswordHash}:${claimedPasswordSalt}`)
      .digest('hex');
  }

  return fallbackRandomSecret;
}

export function getActiveAdminUsername(): string {
  return (
    process.env.ADMIN_USERNAME?.trim() ||
    claimedUsername ||
    BACKEND_CONFIG.adminUsername.trim() ||
    'admin'
  );
}

export async function ensurePersistedAuthLoaded(): Promise<void> {
  if (process.env.ADMIN_PASSWORD?.trim()) return;
  if (claimedPasswordHash && claimedPasswordSalt) return;
  const persisted = await getPersistedAdminAuthFromSheets();
  if (persisted) {
    claimedUsername = persisted.username || BACKEND_CONFIG.adminUsername.trim() || 'admin';
    claimedPasswordHash = persisted.hash;
    claimedPasswordSalt = persisted.salt;
  }
}

export function getAuthSetupState() {
  const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  return {
    hasEnvAdminPassword: hasEnvPassword,
    hasClaimedAdminPassword: Boolean(claimedPasswordHash),
    needsInitialSetup: !hasEnvPassword && !claimedPasswordHash,
    defaultUsername: getActiveAdminUsername(),
  };
}

export async function claimInitialAdminPassword(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  await ensurePersistedAuthLoaded();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return { ok: false, error: 'بيانات الإدارة محددة بالفعل في متغيرات البيئة (ADMIN_PASSWORD).' };
  }
  if (claimedPasswordHash) {
    return { ok: false, error: 'تم إعداد حساب الإدارة مسبقاً.' };
  }
  const cleanUser = (username || getActiveAdminUsername()).trim();
  if (cleanUser.length < 2) {
    return { ok: false, error: 'يجب أن يتكون اسم المستخدم من حرفين على الأقل.' };
  }
  if (!password || password.trim().length < 6) {
    return { ok: false, error: 'يجب أن يتكون رقم التسجيل / كلمة المرور من 6 أحرف أو أرقام على الأقل.' };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  claimedUsername = cleanUser;
  claimedPasswordSalt = salt;
  claimedPasswordHash = hash;
  await savePersistedAdminAuthToSheets({ username: cleanUser, hash, salt });
  return { ok: true };
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!password) return false;
  await ensurePersistedAuthLoaded();

  const expectedUsername = getActiveAdminUsername().toLowerCase();
  const providedUsername = (username || '').trim().toLowerCase();
  if (!providedUsername || providedUsername !== expectedUsername) {
    return false;
  }

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

export async function updateAdminCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  await ensurePersistedAuthLoaded();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return {
      ok: false,
      error: 'كلمة المرور محمية عبر متغير البيئة ADMIN_PASSWORD؛ لتغييرها عدّلها من إعدادات البيئة في Vercel.',
    };
  }
  if (!claimedPasswordHash || !claimedPasswordSalt) {
    return { ok: false, error: 'لم يتم إعداد حساب الإدارة بعد.' };
  }
  const currentCheck = crypto.scryptSync(currentPassword || '', claimedPasswordSalt, 64).toString('hex');
  if (!safeEqual(currentCheck, claimedPasswordHash)) {
    return { ok: false, error: 'رقم التسجيل الحالي غير صحيح.' };
  }

  const cleanUser = (newUsername || getActiveAdminUsername()).trim();
  if (cleanUser.length < 2) {
    return { ok: false, error: 'يجب أن يتكون اسم المستخدم من حرفين على الأقل.' };
  }

  let nextHash = claimedPasswordHash;
  let nextSalt = claimedPasswordSalt;
  if (newPassword.trim()) {
    if (newPassword.trim().length < 6) {
      return { ok: false, error: 'رقم التسجيل الجديد يجب أن يكون 6 أحرف أو أرقام على الأقل.' };
    }
    nextSalt = crypto.randomBytes(16).toString('hex');
    nextHash = crypto.scryptSync(newPassword.trim(), nextSalt, 64).toString('hex');
  }

  claimedUsername = cleanUser;
  claimedPasswordSalt = nextSalt;
  claimedPasswordHash = nextHash;
  await savePersistedAdminAuthToSheets({ username: cleanUser, hash: nextHash, salt: nextSalt });
  return { ok: true };
}

export function createAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
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

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  await ensurePersistedAuthLoaded();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'جلسة الإدارة غير صالحة أو منتهية. يرجى تسجيل الدخول.' });
    return;
  }
  next();
}
