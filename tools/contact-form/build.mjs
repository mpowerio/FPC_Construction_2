// The estimate form now lives in the built pages (tools/site). This wrapper keeps the
// package's build/check commands working:
//   npm run build        -> node tools/site/build.mjs
//   npm run check:asset  -> node tools/site/build.mjs --check (built HTML matches sources)
import { execFileSync } from 'node:child_process';
const build = new URL('../site/build.mjs', import.meta.url).pathname;
execFileSync(process.execPath, [build, ...(process.argv.includes('--check') ? ['--check'] : [])], { stdio: 'inherit' });
