import multer from 'multer';

const memory = multer.memoryStorage();

export const tenantPgDumpUpload = multer({
  storage: memory,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const n = String(file.originalname ?? '').toLowerCase();
    if (n.endsWith('.sql') || n.endsWith('.sql.gz') || n.endsWith('.gz')) {
      cb(null, true);
      return;
    }
    cb(
      new Error(
        'Formato inválido. Envie um arquivo .sql ou .sql.gz (pg_dump).',
      ),
    );
  },
});
