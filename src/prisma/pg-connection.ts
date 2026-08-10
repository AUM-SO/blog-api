import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PoolConfig } from 'pg';

/**
 * Builds the `pg` connection config used by both the runtime PrismaService and
 * the one-off migration scripts.
 *
 * The important part is TLS. Supabase accepts unencrypted connections, and a
 * connection string without an `sslmode` parameter — which is what the Supabase
 * quickstart hands you — silently connects in plaintext. Everything here is
 * built so that can never happen: TLS is always enabled, and the only choice is
 * whether the server certificate is verified.
 *
 * Supabase serves a certificate signed by its own CA, so full verification
 * requires that CA on disk. Download it from the dashboard
 * (Project Settings > Database > SSL Configuration > Download certificate) and
 * point `PG_SSL_ROOT_CERT` at it, or drop it at `certs/supabase-ca.crt`.
 * Without it the connection is still encrypted but not authenticated, which
 * leaves it open to an active man-in-the-middle.
 */

const DEFAULT_CA_PATH = 'certs/supabase-ca.crt';

export interface PgConnectionResult {
  config: PoolConfig;
  /** True when the server certificate is verified against a known CA. */
  verified: boolean;
  caPath?: string;
}

export function buildPgConnection(rawUrl: string): PgConnectionResult {
  const placeholders = rawUrl.match(/\[[^\]]*\]|<[^>]*>/g);
  if (placeholders) {
    throw new Error(
      `Connection URL still contains placeholders: ${placeholders.join(', ')}. ` +
        'Replace them with the real Supabase project ref, region and password.',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      'Connection URL is not valid. Expected the form ' +
        'postgresql://user:password@host:6543/postgres',
    );
  }

  // `pg` maps sslmode=require onto verify-full, which fails against Supabase's
  // own CA. TLS is configured through the `ssl` option below instead, so strip
  // the parameter rather than letting it fight with that.
  url.searchParams.delete('sslmode');

  const caPath = process.env.PG_SSL_ROOT_CERT ?? DEFAULT_CA_PATH;
  const resolvedCa = resolve(caPath);
  const hasCa = existsSync(resolvedCa);

  return {
    config: {
      connectionString: url.toString(),
      ssl: hasCa
        ? { ca: readFileSync(resolvedCa, 'utf8'), rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    },
    verified: hasCa,
    caPath: hasCa ? resolvedCa : undefined,
  };
}
