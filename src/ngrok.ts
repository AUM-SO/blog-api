import { Logger } from '@nestjs/common';

const logger = new Logger('Ngrok');

/**
 * Opens an ngrok tunnel so a public HTTPS URL points at the local server —
 * useful for testing from a phone or for anything that has to call back into a
 * machine behind NAT.
 *
 * Opt-in: nothing happens unless NGROK_AUTHTOKEN is set, and it is skipped in
 * production, where the app is reachable on its own.
 */
export async function startNgrokTunnel(
  port: number | string,
): Promise<string | undefined> {
  const authtoken = process.env.NGROK_AUTHTOKEN;
  if (!authtoken || process.env.NODE_ENV === 'production') {
    return undefined;
  }

  try {
    // Imported dynamically because @ngrok/ngrok is a devDependency: a
    // production install must not fail at module load looking for it.
    const ngrok = await import('@ngrok/ngrok');
    const listener = await ngrok.forward({
      addr: Number(port),
      authtoken,
      // A reserved domain keeps the URL stable across restarts. Optional —
      // without it ngrok hands out a random one each time.
      domain: process.env.NGROK_DOMAIN || undefined,
    });

    const url = listener.url() ?? undefined;
    if (url) {
      logger.log(`Tunnel open: ${url}/api (docs at ${url}/api/reference)`);
    }
    return url;
  } catch (error) {
    // A tunnel is a convenience; losing it must not take the local server down.
    logger.warn(
      `Could not open tunnel: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}
