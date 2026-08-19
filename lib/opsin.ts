const OPSIN_BASE = "https://www.ebi.ac.uk/opsin/ws";

export interface OpsinResult {
  smiles: string;
  inchi: string;
  stdinchikey: string;
}

export async function resolveIupacName(
  name: string
): Promise<OpsinResult | null> {
  try {
    const url = `${OPSIN_BASE}/${encodeURIComponent(name)}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) return null;

    const data = await res.json();

    if (data.status !== "SUCCESS" || !data.smiles) {
      return null;
    }

    return {
      smiles: data.smiles,
      inchi: data.stdinchi || data.inchi || "",
      stdinchikey: data.stdinchikey || "",
    };
  } catch {
    return null;
  }
}
