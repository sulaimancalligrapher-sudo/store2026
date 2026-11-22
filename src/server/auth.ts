import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { BACKEND_CONFIG } from './backendConfig.ts';
import {
  getOrCreateLocalSessionSecret,
  getPersistedAdminAuthFromSheets,
  savePersistedAdminAuthToSheets,
  type PersistedAdminAuth,
} from './sheetsAdapter.ts';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

let activePersistedAuth: PersistedAdminAuth | null = null;

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

  const localSecret = getOrCreateLocalSessionSecret();
  if (localSecret) return localSecret;

  return crypto
    .createHmac('sha256', 'nukhba-default-session-key')
    .update(`${BACKEND_CONFIG.adminUsername}:${BACKEND_CONFIG.adminPasscode}`)
    .digest('hex');
}

export function getActiveAdminUsername(): string {
  return (
    process.env.ADMIN_USERNAME?.trim() ||
    activePersistedAuth?.username ||
    BACKEND_CONFIG.adminUsername.trim() ||
    'admin'
  );
}

export async function ensurePersistedAuthLoaded(forceFresh = false): Promise<void> {
  if (process.env.ADMIN_PASSWORD?.trim()) return;
  const persisted = await getPersistedAdminAuthFromSheets(forceFresh);
  if (persisted) {
    activePersistedAuth = persisted;
  } else if (forceFresh) {
    activePersistedAuth = null;
  }
}

export function getAuthSetupState() {
  const hasEnvPassword = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
  return {
    hasEnvAdminPassword: hasEnvPassword,
    hasClaimedAdminPassword: Boolean(activePersistedAuth),
    needsInitialSetup: false,
    defaultUsername: getActiveAdminUsername(),
  };
}

function verifyPasscodeAgainstSource(password: string, persisted: PersistedAdminAuth | null): boolean {
  const cleanPass = password.trim();
  if (!cleanPass) return false;

  if (persisted?.hash && persisted?.salt) {
    const candidate = crypto.scryptSync(cleanPass, persisted.salt, 64).toString('hex');
    return safeEqual(candidate, persisted.hash);
  }
  if (persisted?.plainPasscode) {
    return safeEqual(cleanPass, persisted.plainPasscode.trim());
  }
  return safeEqual(cleanPass, (BACKEND_CONFIG.adminPasscode || '123456').trim());
}

export async function claimInitialAdminPassword(
  username: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  await ensurePersistedAuthLoaded(true);
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return { ok: false, error: 'بيانات الإدارة محددة بالفعل في متغيرات البيئة (ADMIN_PASSWORD).' };
  }
  const cleanUser = (username || getActiveAdminUsername()).trim();
  if (cleanUser.length < 2) {
    return { ok: false, error: 'يجب أن يتكون اسم المستخدم من حرفين على الأقل.' };
  }
  if (!password || password.trim().length < 4) {
    return { ok: false, error: 'يجب أن يتكون رقم التسجيل / كلمة المرور من 4 أحرف أو أرقام على الأقل.' };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
  activePersistedAuth = { username: cleanUser, hash, salt };
  await savePersistedAdminAuthToSheets(activePersistedAuth);
  return { ok: true };
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!password) return false;
  await ensurePersistedAuthLoaded(true);

  const expectedUsername = getActiveAdminUsername().toLowerCase();
  const providedUsername = (username || '').trim().toLowerCase();
  if (!providedUsername || providedUsername !== expectedUsername) {
    return false;
  }

  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return safeEqual(password, envPass);
  }
  return verifyPasscodeAgainstSource(password, activePersistedAuth);
}

export async function updateAdminCredentials(
  currentPassword: string,
  newUsername: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  await ensurePersistedAuthLoaded(true);
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    return {
      ok: false,
      error: 'كلمة المرور محمية عبر متغير البيئة ADMIN_PASSWORD؛ لتغييرها عدّلها من إعدادات البيئة في Vercel.',
    };
  }

  if (!verifyPasscodeAgainstSource(currentPassword || '', activePersistedAuth)) {
    return { ok: false, error: 'رقم التسجيل الحالي غير صحيح.' };
  }

  const cleanUser = (newUsername || getActiveAdminUsername()).trim();
  if (cleanUser.length < 2) {
    return { ok: false, error: 'يجب أن يتكون اسم المستخدم من حرفين على الأقل.' };
  }

  let nextSalt = activePersistedAuth?.salt;
  let nextHash = activePersistedAuth?.hash;

  if (newPassword.trim()) {
    if (newPassword.trim().length < 4) {
      return { ok: false, error: 'رقم التسجيل الجديد يجب أن يكون 4 أحرف أو أرقام على الأقل.' };
    }
    nextSalt = crypto.randomBytes(16).toString('hex');
    nextHash = crypto.scryptSync(newPassword.trim(), nextSalt, 64).toString('hex');
  } else if (!nextSalt || !nextHash) {
    nextSalt = crypto.randomBytes(16).toString('hex');
    nextHash = crypto.scryptSync(currentPassword.trim(), nextSalt, 64).toString('hex');
  }

  activePersistedAuth = { username: cleanUser, hash: nextHash, salt: nextSalt };
  await savePersistedAdminAuthToSheets(activePersistedAuth);
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
  await ensurePersistedAuthLoaded(false);
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'جلسة الإدارة غير صالحة أو منتهية. يرجى تسجيل الدخول.' });
    return;
  }
  next();
}
