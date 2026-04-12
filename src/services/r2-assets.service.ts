import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { isR2AssetsEnvComplete } from '@config/env.validation';
import { getR2S3Client } from './clients/r2-s3-client';

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
  return isR2AssetsEnvComplete();
}

export function getR2PublicBaseUrl(): string {
  const base = tryGetR2PublicBaseUrl();
  if (!base) {
    throw new Error('R2_PUBLIC_BASE_URL não configurada');
  }
  return base;
}

function requireR2AssetsBucketName(): string {
  const bucket = getR2AssetsBucketName();
  if (!bucket) {
    throw new Error('R2_ASSETS_BUCKET_NAME não configurado');
  }
  return bucket;
}

export function tryGetR2PublicBaseUrl(): string | null {
  const raw = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!raw) return null;
  let s = raw;
  if (!s.startsWith('http://') && !s.startsWith('https://')) {
    s = `https://${s}`;
  }
  s = s.replace(/\/$/, '');
  if (s.endsWith('/default_logo.png')) {
    s = s.slice(0, -'/default_logo.png'.length);
  }
  return s || null;
}

export function getPublicDefaultLogoUrl(): string | null {
  const base = tryGetR2PublicBaseUrl();
  if (!base) return null;
  return `${base}/default_logo.png`;
}

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

const LOGO_KEY_IMAGE_RE = /\.(png|jpe?g|webp|gif)$/i;

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
    throw new Error(
      'Tipo de imagem não permitido (use PNG, JPEG, WebP ou GIF)',
    );
  }

  const bucket = requireR2AssetsBucketName();
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

export function publicUrlToR2KeyIfOurBucket(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  if (!assertLogoUrlBelongsToOurR2(url)) return null;
  const base = getR2PublicBaseUrl();
  let path = url.slice(base.length);
  if (path.startsWith('/')) path = path.slice(1);
  return path || null;
}

export async function deleteTenantLogoObjectsExceptKey(params: {
  slug: string;
  keepKey: string;
  brandNameSegmentsToScan: string[];
  previousLogoUrlFromDb: string | null | undefined;
}): Promise<void> {
  if (!isR2AssetsConfigured()) return;
  const bucket = requireR2AssetsBucketName();
  const client = getR2S3Client();
  const slugSeg = normalizeSlugForR2Key(params.slug);
  const toDelete = new Set<string>();

  const prevKey = publicUrlToR2KeyIfOurBucket(params.previousLogoUrlFromDb);
  if (prevKey && prevKey !== params.keepKey) {
    toDelete.add(prevKey);
  }

  const seenPrefixes = new Set<string>();
  for (const raw of params.brandNameSegmentsToScan) {
    const prefix = `${normalizeBrandNameForR2Key(raw)}-${slugSeg}.`;
    if (seenPrefixes.has(prefix)) continue;
    seenPrefixes.add(prefix);
    let continuationToken: string | undefined;
    do {
      const out = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const c of out.Contents ?? []) {
        const k = c.Key;
        if (k && k !== params.keepKey && LOGO_KEY_IMAGE_RE.test(k)) {
          toDelete.add(k);
        }
      }
      continuationToken = out.IsTruncated
        ? out.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  for (const key of toDelete) {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      // no-op
    }
  }
}

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
  const bucket = requireR2AssetsBucketName();
  const out = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: 20,
    }),
  );
  const key = out.Contents?.map((c: { Key?: string }) => c.Key).find(
    (k: string | undefined) => Boolean(k && LOGO_KEY_IMAGE_RE.test(k)),
  );
  if (!key) return null;
  const base = tryGetR2PublicBaseUrl();
  if (!base) return null;
  return `${base}/${key}`;
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
