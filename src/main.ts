import { createApp } from './create-app';

// The long-running entrypoint: used locally and by any host that runs the
// process itself. The serverless entrypoint lives in api/index.js and shares
// createApp() so both paths configure the app identically.
async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
