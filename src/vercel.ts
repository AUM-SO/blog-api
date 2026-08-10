import type { INestApplication } from '@nestjs/common';
import { createApp } from './create-app';

type NodeHandler = (req: unknown, res: unknown) => void;

// One app per warm container, not per request: NestFactory.create() builds the
// whole DI graph and opens a database connection, which would blow the response
// budget if it ran on every invocation.
let appPromise: Promise<INestApplication> | undefined;

function getApp() {
  // The promise itself is cached, so concurrent cold requests wait on a single
  // bootstrap instead of each starting their own.
  appPromise ??= createApp().then(async (app) => {
    // init() rather than listen(): the platform owns the socket here, and
    // listening on a port in a serverless function does nothing.
    await app.init();
    return app;
  });
  return appPromise;
}

export default async function handler(req: unknown, res: unknown) {
  const app = await getApp();
  const express = app.getHttpAdapter().getInstance() as NodeHandler;
  express(req, res);
}
