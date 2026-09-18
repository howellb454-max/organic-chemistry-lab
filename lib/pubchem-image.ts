const PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug";

export function getCompoundImageUrl(cid: number): string {
  return `${PUBCHEM_BASE}/compound/cid/${cid}/PNG?image_size=500x500`;
}