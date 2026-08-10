// Vercel's entrypoint. Deliberately plain JavaScript that re-exports the
// already-compiled handler: the platform bundles files under api/ with esbuild,
// which does not emit the decorator metadata NestJS needs for dependency
// injection. `yarn build` compiles the real code with tsc first, so what gets
// bundled here is output that already carries that metadata.
const handler = require('../dist/src/vercel').default;

module.exports = handler;
