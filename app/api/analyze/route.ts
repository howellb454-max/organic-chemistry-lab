import { NextRequest, NextResponse } from "next/server";
import { searchCompoundBySmiles, PubChemUnavailableError } from "@/lib/pubchem";
import { computeLocalAnalysis } from "@/lib/local-chemistry";
import { nameMolecule } from "@/lib/iupac-naming";

function detectGroups(smiles: string) {
  return nameMolecule(smiles).functionalGroupsDetected ?? [];
}

export async function GET(request: NextRequest) {
  const smiles = request.nextUrl.searchParams.get("smiles");

  if (!smiles || smiles.trim().length === 0) {
    return NextResponse.json(
      { error: "Debes proporcionar un SMILES válido." },
      { status: 400 }
    );
  }

  const trimmedSmiles = smiles.trim();

  try {
    const result = await searchCompoundBySmiles(trimmedSmiles);

    if (result) {
      return NextResponse.json({
        ...result,
        functionalGroupsDetected: detectGroups(result.canonicalSMILES || trimmedSmiles),
      });
    }

    return NextResponse.json({
      cid: null,
      name: null,
      molecularFormula: null,
      molecularWeight: null,
      canonicalSMILES: trimmedSmiles,
      source: "not_in_pubchem",
      functionalGroupsDetected: detectGroups(trimmedSmiles),
    });
  } catch (err) {
    if (err instanceof PubChemUnavailableError) {
      console.warn("PubChem unavailable during analyze, using local fallback:", err.message);
      const localData = computeLocalAnalysis(trimmedSmiles);
      return NextResponse.json({
        cid: null,
        name: null,
        molecularFormula: localData?.molecularFormula ?? null,
        molecularWeight: localData?.molecularWeight ?? null,
        canonicalSMILES: trimmedSmiles,
        source: "local",
        functionalGroupsDetected: detectGroups(trimmedSmiles),
      });
    }
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: "Error al consultar PubChem. Intenta de nuevo." },
      { status: 502 }
    );
  }
}
