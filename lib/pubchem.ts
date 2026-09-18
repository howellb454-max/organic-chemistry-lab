import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, rename, writeFile } from "node:fs/promises";

const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

export interface CompoundResult {
  cid: number | null;
  name: string;
  molecularFormula: string | null;
  molecularWeight: string | null;
  canonicalSMILES: string;
  inchi?: string;
  source?: "opsin" | "local";
  pubchemUnavailable?: boolean;
}

export interface ExperimentalProperty {
  heading: string;
  value: string;
}

export interface CompoundDetail extends CompoundResult {
  inchikey: string | null;
  synonyms: string[];
  xlogp: number | null;
  tpsa: number | null;
  hbondDonors: number | null;
  hbondAcceptors: number | null;
  complexity: number | null;
  experimental: ExperimentalProperty[];
}

const cache = new Map<string, { data: CompoundResult; expiry: number }>();
const detailCache = new Map<number, { data: CompoundDetail; expiry: number }>();
const CACHE_TTL = 1000 * 60 * 60;

const CACHE_FILE = join(tmpdir(), "organic-lab-pubchem-cache.json");
const WRITE_MIN_INTERVAL_MS = 1000;

let cacheLoaded = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWrite = false;
let lastWriteAt = 0;

interface CacheSerialized {
  cache: Array<[string, { data: CompoundResult; expiry: number }]>;
  detailCache: Array<[number, { data: CompoundDetail; expiry: number }]>;
}

async function loadDiskCache(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = await readFile(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<CacheSerialized>;
    const now = Date.now();
    let restored = 0;
    for (const [key, entry] of parsed.cache ?? []) {
      if (entry?.expiry > now) {
        cache.set(key, entry as { data: CompoundResult; expiry: number });
        restored++;
      }
    }
    for (const [key, entry] of parsed.detailCache ?? []) {
      if (entry?.expiry > now) {
        detailCache.set(key, entry as { data: CompoundDetail; expiry: number });
        restored++;
      }
    }
    if (restored > 0) {
      console.log(`[pubchem-cache] cache hit (disk): ${restored} entradas restauradas`);
    }
  } catch {
    // archivo ausente o corrupto: seguir con caché en memoria vacía
  }
}

function scheduleCacheWrite(): void {
  pendingWrite = true;
  if (writeTimer) return;
  const wait = Math.max(0, lastWriteAt + WRITE_MIN_INTERVAL_MS - Date.now());
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void flushCache();
  }, wait);
}

async function flushCache(): Promise<void> {
  if (!pendingWrite) return;
  pendingWrite = false;
  lastWriteAt = Date.now();
  try {
    const data: CacheSerialized = { cache: [...cache], detailCache: [...detailCache] };
    const tmpPath = `${CACHE_FILE}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data), "utf8");
    await rename(tmpPath, CACHE_FILE);
  } catch {
    // fallo de escritura (permisos, disco lleno): ignorar y seguir con memoria
  }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_DELAYS_MS = [0, 800, 2400];

async function pubchemFetch(
  url: string,
  opts: { silent?: boolean } = {}
): Promise<Response> {
  const { silent = false } = opts;
  const maxRetries = silent ? 0 : MAX_RETRIES;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const delay = RETRY_DELAYS_MS[attempt] ?? 0;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) return res;
      if (!RETRYABLE_STATUSES.has(res.status)) return res;
      lastResponse = res;
      if (!silent) {
        console.warn(
          `PubChem HTTP ${res.status} en intento ${attempt + 1}/${maxRetries + 1}: ${url}`
        );
      }
    } catch (err: unknown) {
      if (attempt === maxRetries) throw err;
      if (!silent) console.warn(`PubChem error de red en intento ${attempt + 1}: ${err}`);
    }
  }

  if (silent && lastResponse) return lastResponse;
  if (silent) return new Response(null, { status: 503 });

  const status = lastResponse?.status ?? 503;
  const body = lastResponse ? await lastResponse.text().catch(() => "") : "";
  console.error(
    `PubChem no disponible después de ${maxRetries + 1} intentos. HTTP ${status} ${body}`
  );
  throw new PubChemUnavailableError(status);
}

export async function searchCompound(query: string): Promise<CompoundResult> {
  const key = query.toLowerCase().trim();
  await loadDiskCache();
  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[pubchem-cache] cache hit (memory): ${key}`);
    return cached.data;
  }
  console.log(`[pubchem-cache] cache miss: ${key} -> consultando PubChem`);

  const propertiesUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(key)}/property/MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
  const cidsUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(key)}/cids/JSON`;

  const [propsRes, cidsRes] = await Promise.all([
    pubchemFetch(propertiesUrl),
    pubchemFetch(cidsUrl),
  ]);

  if (propsRes.status === 404 || cidsRes.status === 404) {
    throw new CompoundNotFoundError(query);
  }

  if (!propsRes.ok || !cidsRes.ok) {
    throw new PubChemUnavailableError(propsRes.status || cidsRes.status);
  }

  const propsJson = await propsRes.json();
  const cidsJson = await cidsRes.json();
  const table = propsJson?.PropertyTable?.Properties?.[0];
  const cid = cidsJson?.IdentifierList?.CID?.[0];

  if (!table || !cid) {
    throw new CompoundNotFoundError(query);
  }

  const result: CompoundResult = {
    cid,
    name: table.IUPACName || query,
    molecularFormula: table.MolecularFormula,
    molecularWeight: String(table.MolecularWeight),
    canonicalSMILES: table.CanonicalSMILES || table.ConnectivitySMILES,
  };

  cache.set(key, { data: result, expiry: Date.now() + CACHE_TTL });
  scheduleCacheWrite();
  return result;
}

export function getCompoundImageUrl(cid: number): string {
  return `${PUBCHEM_BASE}/compound/cid/${cid}/PNG?image_size=500x500`;
}

export async function getCompoundByCid(cid: number): Promise<CompoundDetail | null> {
  await loadDiskCache();
  const cached = detailCache.get(cid);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[pubchem-cache] cache hit (memory): cid ${cid}`);
    return cached.data;
  }
  console.log(`[pubchem-cache] cache miss: cid ${cid} -> consultando PubChem`);

  const propsUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName,InChI,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,Complexity/JSON`;
  const synUrl = `${PUBCHEM_BASE}/compound/cid/${cid}/synonyms/JSON`;

  const [propsRes, synRes] = await Promise.all([
    pubchemFetch(propsUrl),
    pubchemFetch(synUrl),
  ]);

  if (propsRes.status === 404) return null;

  if (!propsRes.ok) {
    throw new PubChemUnavailableError(propsRes.status);
  }

  const propsJson = await propsRes.json();
  const table = propsJson?.PropertyTable?.Properties?.[0];
  if (!table) return null;

  let synonyms: string[] = [];
  if (synRes.ok) {
    const synJson = await synRes.json();
    const all = synJson?.InformationList?.Information?.[0]?.Synonym ?? [];
    synonyms = all
      .filter((s: string) => s.length <= 50 && !s.startsWith("CID ") && !/^\d+$/.test(s))
      .slice(0, 5);
  }

  let experimental: ExperimentalProperty[] = [];
  try {
    experimental = await getExperimentalProperties(cid);
  } catch (err) {
    console.warn(`No se pudieron obtener propiedades experimentales para CID ${cid}:`, err);
  }

  const result: CompoundDetail = {
    cid,
    name: table.IUPACName || "",
    molecularFormula: table.MolecularFormula,
    molecularWeight: String(table.MolecularWeight),
    canonicalSMILES: table.CanonicalSMILES || table.ConnectivitySMILES,
    inchi: table.InChI || null,
    inchikey: table.InChIKey || null,
    synonyms,
    xlogp: table.XLogP ?? null,
    tpsa: table.TPSA ?? null,
    hbondDonors: table.HBondDonorCount ?? null,
    hbondAcceptors: table.HBondAcceptorCount ?? null,
    complexity: table.Complexity ?? null,
    experimental,
  };

  detailCache.set(cid, { data: result, expiry: Date.now() + CACHE_TTL });
  scheduleCacheWrite();
  return result;
}

const PUG_VIEW_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug_view";
const EXPERIMENTAL_HEADINGS = ["Melting+Point", "Boiling+Point", "Solubility"];
const EXPERIMENTAL_HEADING_LABELS: Record<string, string> = {
  "Melting+Point": "Punto de fusión",
  "Boiling+Point": "Punto de ebullición",
  Solubility: "Solubilidad",
};

function extractPugViewStringValue(section: Record<string, unknown>): string | null {
  if (typeof section.StringValue === "string") return section.StringValue;
  if (Array.isArray(section.StringWithMarkup)) {
    for (const item of section.StringWithMarkup) {
      if (typeof item.String === "string") return item.String;
    }
  }
  if (Array.isArray(section.Section)) {
    for (const sub of section.Section) {
      const val = extractPugViewStringValue(sub);
      if (val) return val;
    }
  }
  return null;
}

export async function getExperimentalProperties(
  cid: number
): Promise<ExperimentalProperty[]> {
  const results = await Promise.all(
    EXPERIMENTAL_HEADINGS.map(async (heading) => {
      try {
        const url = `${PUG_VIEW_BASE}/data/compound/${cid}/JSON?heading=${heading}`;
        const res = await pubchemFetch(url, { silent: true });
        if (!res.ok) return null;
        const json = await res.json();
        const sections: Record<string, unknown>[] =
          json?.Record?.Section?.[0]?.Section?.[0]?.Section ?? [];
        for (const section of sections) {
          if (section.TOCHeading === heading) {
            const value = extractPugViewStringValue(section);
            if (value) {
              return {
                heading: EXPERIMENTAL_HEADING_LABELS[heading] ?? heading,
                value,
              } as ExperimentalProperty;
            }
          }
        }
      } catch {
        // experimental properties are optional — skip on failure
      }
      return null;
    })
  );

  return results.filter((r): r is ExperimentalProperty => r !== null);
}

export async function searchCompoundBySmiles(
  smiles: string
): Promise<CompoundResult | null> {
  const encoded = encodeURIComponent(smiles);
  const propsUrl = `${PUBCHEM_BASE}/compound/smiles/${encoded}/property/MolecularFormula,MolecularWeight,CanonicalSMILES,IUPACName/JSON`;
  const cidsUrl = `${PUBCHEM_BASE}/compound/smiles/${encoded}/cids/JSON`;

  const [propsRes, cidsRes] = await Promise.all([
    pubchemFetch(propsUrl),
    pubchemFetch(cidsUrl),
  ]);

  if (propsRes.status === 404 || cidsRes.status === 404) return null;

  if (!propsRes.ok || !cidsRes.ok) {
    throw new PubChemUnavailableError(propsRes.status || cidsRes.status);
  }

  const propsJson = await propsRes.json();
  const cidsJson = await cidsRes.json();
  const table = propsJson?.PropertyTable?.Properties?.[0];
  const cid = cidsJson?.IdentifierList?.CID?.[0];

  if (!table || !cid) return null;

  return {
    cid,
    name: table.IUPACName || "",
    molecularFormula: table.MolecularFormula,
    molecularWeight: String(table.MolecularWeight),
    canonicalSMILES: table.CanonicalSMILES || table.ConnectivitySMILES,
  };
}

export class CompoundNotFoundError extends Error {
  constructor(query: string) {
    super(`No se encontró el compuesto: "${query}"`);
    this.name = "CompoundNotFoundError";
  }
}

export class PubChemUnavailableError extends Error {
  public readonly status: number;
  constructor(status: number) {
    super(`PubChem no disponible temporalmente (HTTP ${status}).`);
    this.name = "PubChemUnavailableError";
    this.status = status;
  }
}
