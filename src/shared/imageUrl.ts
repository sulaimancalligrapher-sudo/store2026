export function extractGoogleDriveFileId(rawUrl: string): string | null {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') {
      return null;
    }
    // Pattern 1: /file/d/<ID>/view...
    const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return fileMatch[1];

    // Pattern 2: /d/<ID>/...
    const dMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (dMatch?.[1]) return dMatch[1];

    // Pattern 3: ?id=<ID> (open?id=... or uc?id=...)
    const idParam = parsed.searchParams.get('id');
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  } catch {
    return null;
  }
  return null;
}

export function normalizeImageUrl(rawUrl: unknown): string {
  const raw = String(rawUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    const driveId = extractGoogleDriveFileId(raw);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    }
    return raw;
  } catch {
    return '';
  }
}

export function getImageCandidates(rawUrl?: string): string[] {
  const raw = String(rawUrl || '').trim();
  if (!raw) return [];
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) {
    return [
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`,
      `https://lh3.googleusercontent.com/d/${driveId}=w1200`,
      `https://drive.google.com/uc?export=view&id=${driveId}`,
    ];
  }
  if (raw.includes('drive.google.com/thumbnail?id=')) {
    try {
      const id = new URL(raw).searchParams.get('id');
      if (id) {
        return [
          raw,
          `https://lh3.googleusercontent.com/d/${id}=w1200`,
          `https://drive.google.com/uc?export=view&id=${id}`,
        ];
      }
    } catch {
      // ignore
    }
  }
  return [raw];
}
