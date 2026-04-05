import multer from 'multer';

const memory = multer.memoryStorage();

const imageMime = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

/** Tenant logo → R2 (`POST /tenant/branding/logo`). Max 2MB, images only. */
export const tenantLogoUpload = multer({
  storage: memory,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (imageMime.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        'Invalid file type. Allowed: PNG, JPEG, WebP, GIF (Content-Type image/*).',
      ),
    );
  },
});

/** Super-admin DB restore (`POST /admin/restore-backup`). Max 200MB. */
export const adminBackupUpload = multer({
  storage: memory,
  limits: { fileSize: 200 * 1024 * 1024 },
});
