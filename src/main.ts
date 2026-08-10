import { createApp } from './create-app';
import { startNgrokTunnel } from './ngrok';

// The long-running entrypoint: used locally and by any host that runs the
// process itself. The serverless entrypoint lives in api/index.js and shares
// createApp() so both paths configure the app identically.
async function bootstrap() {
  const app = await createApp();
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // Only does anything when NGROK_AUTHTOKEN is set — see src/ngrok.ts.
  await startNgrokTunnel(port);
}
void bootstrap();
