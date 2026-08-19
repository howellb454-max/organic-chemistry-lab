const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

export interface CompoundResult {
  cid: number;
  name: string;
  molecularFormula: string;
  molecularWeight: string;
  canonicalSMILES: string;
}

const cache = new Map<string, { data: CompoundResult; expiry: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function searchCompound(query: string): Promise<CompoundResult> {
  const key = query.toLowerCase().trim();

  const cached = cache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const propertiesUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(key)}/property/MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
  const cidsUrl = `${PUBCHEM_BASE}/compound/name/${encodeURIComponent(key)}/cids/JSON`;

  const [propsRes, cidsRes] = await Promise.all([
    fetch(propertiesUrl, { next: { revalidate: 3600 } }),
    fetch(cidsUrl, { next: { revalidate: 3600 } }),
  ]);

  if (!propsRes.ok || !cidsRes.ok) {
    throw new CompoundNotFoundError(key);
  }

  const propsJson = await propsRes.json();
  const cidsJson = await cidsRes.json();

  const table = propsJson?.PropertyTable?.Properties?.[0];
  const cid = cidsJson?.IdentifierList?.CID?.[0];

  if (!table || !cid) {
    throw new CompoundNotFoundError(key);
  }

  const result: CompoundResult = {
    cid,
    name: table.IUPACName || query,
    molecularFormula: table.MolecularFormula,
    molecularWeight: String(table.MolecularWeight),
    canonicalSMILES: table.CanonicalSMILES || table.ConnectivitySMILES,
  };

  cache.set(key, { data: result, expiry: Date.now() + CACHE_TTL });

  return result;
}

export function getCompoundImageUrl(cid: number): string {
  return `${PUBCHEM_BASE}/compound/cid/${cid}/PNG?image_size=500x500`;
}

export class CompoundNotFoundError extends Error {
  constructor(query: string) {
    super(`No se encontró el compuesto: "${query}"`);
    this.name = "CompoundNotFoundError";
  }
}
