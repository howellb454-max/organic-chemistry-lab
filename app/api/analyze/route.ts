import { NextRequest, NextResponse } from "next/server";
import { searchCompoundBySmiles } from "@/lib/pubchem";

export async function GET(request: NextRequest) {
  const smiles = request.nextUrl.searchParams.get("smiles");

  if (!smiles || smiles.trim().length === 0) {
    return NextResponse.json(
      { error: "Debes proporcionar un SMILES válido." },
      { status: 400 }
    );
  }

  try {
    const result = await searchCompoundBySmiles(smiles.trim());

    if (result) {
      return NextResponse.json(result);
    }

    return NextResponse.json({
      cid: null,
      name: null,
      molecularFormula: null,
      molecularWeight: null,
      canonicalSMILES: smiles.trim(),
      source: "not_in_pubchem",
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json(
      { error: "Error al consultar PubChem. Intenta de nuevo." },
      { status: 502 }
    );
  }
}
