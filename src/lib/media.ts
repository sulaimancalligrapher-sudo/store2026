export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function extractGoogleDriveFileId(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes('drive.google.com') && !u.hostname.includes('docs.google.com')) {
      return null;
    }
    const fileMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(u.pathname);
    if (fileMatch) return fileMatch[1];

    const idParam = u.searchParams.get('id');
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;

    return null;
  } catch {
    return null;
  }
}

export function resolveImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!isSafeHttpUrl(trimmed)) return '';

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w1200`;
  }

  return trimmed;
}

export type ResolvedMedia =
  | { kind: 'none' }
  | { kind: 'iframe'; src: string }
  | { kind: 'audio'; src: string }
  | { kind: 'video'; src: string }
  | { kind: 'link'; src: string };

export function resolvePreviewMedia(rawUrl: string): ResolvedMedia {
  const trimmed = rawUrl.trim();
  if (!isSafeHttpUrl(trimmed)) return { kind: 'none' };

  const driveId = extractGoogleDriveFileId(trimmed);
  if (driveId) {
    return {
      kind: 'iframe',
      src: `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`,
    };
  }

  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
      let videoId = '';
      if (u.hostname === 'youtu.be') {
        videoId = u.pathname.replace(/^\//, '').split('/')[0] || '';
      } else {
        videoId = u.searchParams.get('v') || '';
        if (!videoId && u.pathname.startsWith('/embed/')) {
          videoId = u.pathname.split('/')[2] || '';
        }
      }
      if (videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return {
          kind: 'iframe',
          src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
        };
      }
    }

    const lowerPath = u.pathname.toLowerCase();
    if (/\.(mp3|wav|ogg|m4a|aac)$/.test(lowerPath)) {
      return { kind: 'audio', src: trimmed };
    }
    if (/\.(mp4|webm|mov)$/.test(lowerPath)) {
      return { kind: 'video', src: trimmed };
    }
  } catch {
    return { kind: 'none' };
  }

  return { kind: 'link', src: trimmed };
}
