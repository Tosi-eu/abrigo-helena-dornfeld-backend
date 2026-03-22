import { ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getR2S3Client } from './r2-s3-client';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function getR2AssetsBucketName(): string | undefined {
  return process.env.R2_ASSETS_BUCKET_NAME?.trim() || undefined;
}

export function isR2AssetsConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      getR2AssetsBucketName() &&
      process.env.R2_PUBLIC_BASE_URL?.trim(),
  );
}

export function getR2PublicBaseUrl(): string {
  return process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '');
}

/** Nome de marca → segmento seguro para chave S3 (minúsculas, hífens). */
export function normalizeBrandNameForR2Key(raw: string): string {
  const s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'logo';
}

export function normalizeSlugForR2Key(raw: string): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'tenant';
}

/**
 * Chave no bucket: `{marca-normalizada}-{slug}.{ext}`
 */
export async function uploadTenantLogoToR2(params: {
  slug: string;
  brandName: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ key: string; publicUrl: string }> {
  if (!isR2AssetsConfigured()) {
    throw new Error('R2 não configurado');
  }
  const ext = MIME_TO_EXT[params.contentType];
  if (!ext) {
    throw new Error('Tipo de imagem não permitido (use PNG, JPEG, WebP ou GIF)');
  }

  const bucket = getR2AssetsBucketName()!;
  const brandSeg = normalizeBrandNameForR2Key(params.brandName);
  const slugSeg = normalizeSlugForR2Key(params.slug);
  const key = `${brandSeg}-${slugSeg}.${ext}`;

  const client = getR2S3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
      CacheControl: 'public, max-age=31536000',
    }),
  );

  const publicUrl = `${getR2PublicBaseUrl()}/${key}`;
  return { key, publicUrl };
}

export function assertLogoUrlBelongsToOurR2(url: string): boolean {
  if (!isR2AssetsConfigured()) return false;
  const base = getR2PublicBaseUrl();
  return url.startsWith(`${base}/`);
}

const LOGO_KEY_IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

function logoListCacheTtlMs(): number {
  const raw = process.env.R2_LOGO_LIST_CACHE_TTL_MS?.trim();
  if (raw === '0') return 0;
  const n = raw != null ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 0) return n;
  return 10 * 60 * 1000;
}

const LOGO_RESOLVE_CACHE_MAX = 2000;

type LogoResolveCacheEntry = { url: string | null; expiresAt: number };

const logoResolveCache = new Map<string, LogoResolveCacheEntry>();

function tenantLogoResolveCacheKey(tenant: {
  slug: string;
  brandName: string | null;
  name: string;
}): string {
  const brandRaw =
    String(tenant.brandName ?? '').trim() ||
    String(tenant.name ?? '').trim() ||
    'logo';
  const brandSeg = normalizeBrandNameForR2Key(brandRaw);
  const slugSeg = normalizeSlugForR2Key(tenant.slug);
  return `${slugSeg}:${brandSeg}`;
}

function pruneLogoResolveCacheIfNeeded(): void {
  if (logoResolveCache.size <= LOGO_RESOLVE_CACHE_MAX) return;
  const now = Date.now();
  for (const [k, v] of logoResolveCache) {
    if (v.expiresAt <= now) logoResolveCache.delete(k);
  }
  if (logoResolveCache.size <= LOGO_RESOLVE_CACHE_MAX) return;
  const sorted = [...logoResolveCache.entries()].sort(
    (a, b) => a[1].expiresAt - b[1].expiresAt,
  );
  const drop = Math.max(1, Math.floor(LOGO_RESOLVE_CACHE_MAX / 5));
  for (let i = 0; i < drop && i < sorted.length; i++) {
    logoResolveCache.delete(sorted[i][0]);
  }
}

export function invalidateTenantLogoResolveCacheForSlug(slug: string): void {
  const prefix = `${normalizeSlugForR2Key(slug)}:`;
  for (const k of logoResolveCache.keys()) {
    if (k.startsWith(prefix)) logoResolveCache.delete(k);
  }
}

async function listTenantLogoKeyFromR2(tenant: {
  slug: string;
  brandName: string | null;
  name: string;
}): Promise<string | null> {
  const brandRaw =
    String(tenant.brandName ?? '').trim() ||
    String(tenant.name ?? '').trim() ||
    'logo';
  const brandSeg = normalizeBrandNameForR2Key(brandRaw);
  const slugSeg = normalizeSlugForR2Key(tenant.slug);
  const prefix = `${brandSeg}-${slugSeg}.`;

  const client = getR2S3Client();
  const bucket = getR2AssetsBucketName()!;
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 20,
    }),
  );
  const key = out.Contents?.map((c) => c.Key).find((k) => k && LOGO_KEY_IMAGE_RE.test(k));
  if (!key) return null;
  return `${getR2PublicBaseUrl()}/${key}`;
}

export async function tryResolveTenantLogoPublicUrlFromR2(tenant: {
  slug: string;
  brandName: string | null;
  name: string;
}): Promise<string | null> {
  if (!isR2AssetsConfigured()) return null;
  const ttl = logoListCacheTtlMs();
  const cacheKey = tenantLogoResolveCacheKey(tenant);
  const now = Date.now();

  if (ttl > 0) {
    const hit = logoResolveCache.get(cacheKey);
    if (hit && hit.expiresAt > now) {
      return hit.url;
    }
  }

  let url: string | null;
  try {
    url = await listTenantLogoKeyFromR2(tenant);
  } catch {
    url = null;
  }

  if (ttl > 0) {
    pruneLogoResolveCacheIfNeeded();
    logoResolveCache.set(cacheKey, {
      url,
      expiresAt: now + ttl,
    });
  }

  return url;
}