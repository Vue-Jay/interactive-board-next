// The installed apps have a local WebView origin, never the public API origin.
// Keep autonomous QA separate from the real, self-hosted Lektrus service.
import { spawnSync } from 'node:child_process';

const offline = process.env.VITE_LEKTRUS_LOCAL_TEST === 'true';
const env = {
  ...process.env,
  LEKTRUS_NATIVE_BUILD: 'true',
  VITE_LEKTRUS_BACKEND: offline ? '' : 'selfhost',
  VITE_LEKTRUS_API_ORIGIN: offline ? '' : (process.env.VITE_LEKTRUS_API_ORIGIN || 'https://lektrus.ru'),
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
};
if (!offline) {
  const origin = new URL(env.VITE_LEKTRUS_API_ORIGIN);
  if (origin.origin !== env.VITE_LEKTRUS_API_ORIGIN || origin.protocol !== 'https:' ||
      origin.hostname === 'localhost' || origin.hostname.endsWith('.supabase.co'))
    throw new Error('Native release requires a public HTTPS Lektrus API origin.');
}
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {env, stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
