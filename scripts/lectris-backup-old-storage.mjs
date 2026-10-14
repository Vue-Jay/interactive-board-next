// READ-ONLY backup of old Supabase Storage bytes. Writes only under ignored LOCAL migration-backups.
// Run with Node >=20 through lectris-backup-old-storage.ps1. NEVER commit API secrets.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const SOURCE_REF = 'vblmywoczinzezcmqrgb';
const SOURCE_URL = 'https://' + SOURCE_REF + '.supabase.co';
const secret = process.env.LECTRIS_OLD_SUPABASE_SECRET_KEY;
const out = process.argv[2];
if (!secret || !(secret.startsWith('sb_secret_') || secret.startsWith('eyJ'))) {
  console.error('Missing OLD project Secret API key / legacy service_role key.');
  process.exit(2);
}
if (!out) throw Error('Missing output directory.');
const root = resolve(out);
if (!root.includes(sep + 'migration-backups' + sep)) throw Error('Local backup folder restriction failed.');

const headers = { apikey: secret, authorization: 'Bearer ' + secret, 'user-agent': 'lectris-local-backup-node/1.0' };

function checkName(name) {
  if (!name || name === '.' || name === '..' || /[<>:"\\|?*\x00-\x1f]/u.test(name) ||
      /[. ]$/u.test(name) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(name)) {
    throw Error('Unsafe or Windows-incompatible Storage filename; stopped.');
  }
  return name;
}

function localFile(bucket, key) {
  const segments = key.split('/').map(checkName);
  const result = resolve(join(root, checkName(bucket), ...segments));
  if (!result.startsWith(root + sep)) throw Error('Invalid storage path.');
  return result;
}

function encodedPath(key) { return key.split('/').map(encodeURIComponent).join('/'); }

async function api(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) },
    signal: AbortSignal.timeout(120000),
    redirect: 'error',
  });
  if (!res.ok) throw Error('OLD Supabase Storage HTTP ' + res.status + ' on ' + (opts.method || 'GET') + '. Check the OLD secret key and permissions.');
  return res;
}

async function* filesIn(bucket, folder = '') {
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const url = SOURCE_URL + '/storage/v1/object/list/' + encodeURIComponent(bucket);
    const res = await api(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefix: folder, limit, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw Error('Unexpected Storage listing format.');
    for (const item of rows) {
      if (typeof item?.name !== 'string') throw Error('Invalid Storage listing entry.');
      checkName(item.name);
      const path = folder ? folder + '/' + item.name : item.name;
      if (item.id == null) {
        yield* filesIn(bucket, path);
      } else {
        yield { bucket, path, size: item.metadata?.size ?? null, mimetype: item.metadata?.mimetype ?? null };
      }
    }
    if (rows.length < limit) break;
    if (offset > 1000000) throw Error('Aborted excessive listing pagination.');
  }
}

async function hashFile(file) {
  let bytes = 0;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) {
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest('hex') };
}

async function download(bucket, key) {
  const target = localFile(bucket, key);
  await mkdir(dirname(target), { recursive: true });
  const url = SOURCE_URL + '/storage/v1/object/authenticated/' + encodeURIComponent(bucket) + '/' + encodedPath(key);
  const res = await api(url);
  if (!res.body) throw Error('Missing response body.');
  const tmp = target + '.part';
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp, { flags: 'wx' }));
    await rename(tmp, target);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
  return hashFile(target);
}

async function main() {
  await mkdir(root, { recursive: true });
  const bucketRes = await api(SOURCE_URL + '/storage/v1/bucket');
  const buckets = await bucketRes.json();
  if (!Array.isArray(buckets) || buckets.length === 0) throw Error('Old Supabase returned no buckets.');
  const manifest = {
    sourceRef: SOURCE_REF,
    time: new Date().toISOString(),
    buckets: buckets.map(b => ({
      id: b.id, name: b.name, public: b.public,
      file_size_limit: b.file_size_limit ?? null,
      allowed_mime_types: b.allowed_mime_types ?? null,
    })),
    files: [],
  };
  const seen = new Set();
  let totalBytes = 0;
  for (const bucket of buckets) {
    const name = checkName(String(bucket.id));
    for await (const entry of filesIn(name)) {
      const unique = name + '\u0000' + entry.path;
      if (seen.has(unique)) throw Error('Duplicate Storage file path.');
      seen.add(unique);
      const info = await download(name, entry.path);
      if (entry.size != null && Number(entry.size) !== info.bytes) throw Error('Downloaded file has unexpected size.');
      manifest.files.push({ bucket: name, path: entry.path, mimetype: entry.mimetype, ...info });
      totalBytes += info.bytes;
      console.log('Verified download ' + manifest.files.length);
    }
  }
  await writeFile(join(root, 'storage-manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
  console.log('SOURCE: ' + SOURCE_REF);
  console.log('Buckets downloaded: ' + buckets.length);
  console.log('Files downloaded: ' + manifest.files.length);
  console.log('Total bytes: ' + totalBytes);
  console.log('SHA256 manifest saved locally. Neither database was changed.');
  if (buckets.length !== 3 || manifest.files.length !== 50) {
    console.log('ATTENTION: SQL snapshot listed 3 buckets and 50 rows; compare live Storage for changes.');
    process.exitCode = 3;
  } else {
    console.log('COUNTS MATCH: 3 buckets and 50 files (same as SQL snapshot).');
  }
}
main().catch(err => { console.error('FAILED: ' + err.message); console.error('Do not treat partial downloads as complete.'); process.exitCode = 1; });
