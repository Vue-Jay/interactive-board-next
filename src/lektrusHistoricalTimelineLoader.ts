import {historicalBlockForYear, historicalYearState, validateHistoricalManifest, validateHistoricalPack, type HistoricalManifest, type HistoricalPack} from './lektrusHistoricalTimeline.ts';

/** Only the manifest and a requested period are downloaded. Two cached
 * periods permit adjacent-year stepping without repeated network requests. */
export function createHistoricalTimelineLoader(baseUrl: string, request: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, '');
  let manifestPromise: Promise<HistoricalManifest> | undefined;
  const cached = new Map<string, Promise<HistoricalPack>>();
  function manifest() {
    if (!manifestPromise) {
      manifestPromise = request(`${base}/manifest.json`, {cache:'no-cache'}).then(response => {
        if (!response.ok) throw new Error(`Historical manifest: HTTP ${response.status}`);
        return response.json();
      }).then(validateHistoricalManifest).catch(error => {manifestPromise = undefined; throw error;});
    }
    return manifestPromise;
  }
  async function year(year: number) {
    const index = await manifest();
    const block = historicalBlockForYear(index,year);
    if (!block) return {year,status:'outside-source-coverage' as const,records:[],drawable:[],overlays:[],rejected:[],coverageGaps:[]};
    let pending = cached.get(block.sha256);
    if (pending) cached.delete(block.sha256);
    else pending = request(`${base}/${block.file}`, {cache:'force-cache'}).then(async response => {
      if (!response.ok) throw new Error(`Historical period: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== block.bytes) throw new Error('Historical period size mismatch');
      // A content-addressed pack must match its manifest, not a stale proxy response.
      const digest = await crypto.subtle.digest('SHA-256',bytes);
      const hex = Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
      if (hex !== block.sha256) throw new Error('Historical period integrity mismatch');
      return validateHistoricalPack(JSON.parse(new TextDecoder().decode(bytes)),block);
    }).catch(error => {if (cached.get(block.sha256) === pending) cached.delete(block.sha256); throw error;});
    cached.set(block.sha256,pending);
    while (cached.size > 2) cached.delete(cached.keys().next().value!);
    return historicalYearState(await pending,year);
  }
  return {manifest,year};
}
