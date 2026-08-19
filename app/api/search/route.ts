import { NextRequest, NextResponse } from "next/server";
import { searchCompound, searchCompoundBySmiles, CompoundNotFoundError } from "@/lib/pubchem";
import { resolveIupacName } from "@/lib/opsin";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Debes escribir un nombre de compuesto." },
      { status: 400 }
    );
  }

  const query = q.trim();

  // 1. Try PubChem by name
  try {
    const compound = await searchCompound(query);
    return NextResponse.json(compound);
  } catch (err) {
    if (!(err instanceof CompoundNotFoundError)) {
      console.error("PubChem API error:", err);
      return NextResponse.json(
        { error: "Error al consultar PubChem. Intenta de nuevo más tarde." },
        { status: 502 }
      );
    }
  }

  // 2. PubChem didn't find it — try OPSIN
  const opsinResult = await resolveIupacName(query);

  if (!opsinResult) {
    return NextResponse.json(
      { error: `No se encontró ningún compuesto para "${query}". Intenta con otro nombre.` },
      { status: 404 }
    );
  }

  // 3. OPSIN resolved it — try PubChem by SMILES
  const fromSmiles = await searchCompoundBySmiles(opsinResult.smiles);

  if (fromSmiles) {
    return NextResponse.json(fromSmiles);
  }

  // 4. PubChem doesn't have it even by SMILES — return what OPSIN gave us
  return NextResponse.json({
    cid: null,
    name: query,
    molecularFormula: null,
    molecularWeight: null,
    canonicalSMILES: opsinResult.smiles,
    inchi: opsinResult.inchi,
    source: "opsin",
  });
}
