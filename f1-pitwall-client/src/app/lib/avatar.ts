const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Storage object name for an avatar upload, or null if the file type isn't allowed.
 * The extension comes from a MIME allowlist and the name is random, so neither the
 * client-supplied filename nor the username (which may hold path characters) can
 * influence the object path or overwrite another user's file.
 */
export function avatarFileName(mimeType: string): string | null {
  const ext = EXTENSION_BY_MIME[mimeType];
  return ext ? `${crypto.randomUUID()}.${ext}` : null;
}
