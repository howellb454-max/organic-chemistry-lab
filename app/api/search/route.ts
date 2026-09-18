import { NextRequest, NextResponse } from "next/server";
import { searchCompound, searchCompoundBySmiles, CompoundNotFoundError, PubChemUnavailableError } from "@/lib/pubchem";
import { resolveIupacName } from "@/lib/opsin";
import { computeLocalAnalysis } from "@/lib/local-chemistry";
import { nameMolecule } from "@/lib/iupac-naming";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Debes escribir un nombre de compuesto." },
      { status: 400 }
    );
  }

  const query = q.trim();
  let pubchemUnavailable = false;

  try {
    const compound = await searchCompound(query);
    return NextResponse.json(compound);
  } catch (err) {
    if (err instanceof PubChemUnavailableError) {
      pubchemUnavailable = true;
    } else if (!(err instanceof CompoundNotFoundError)) {
      console.error("PubChem API error:", err);
      return NextResponse.json(
        { error: "Error al consultar PubChem. Intenta de nuevo más tarde." },
        { status: 502 }
      );
    }
  }

  const opsinResult = await resolveIupacName(query);

  if (!opsinResult) {
    if (pubchemUnavailable) {
      return NextResponse.json(
        { error: "PubChem no está disponible y OPSIN no pudo resolver el nombre. Intenta de nuevo más tarde." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: `No se encontró ningún compuesto para "${query}". Intenta con otro nombre.` },
      { status: 404 }
    );
  }

  try {
    const fromSmiles = await searchCompoundBySmiles(opsinResult.smiles);
    if (fromSmiles) {
      return NextResponse.json(fromSmiles);
    }
  } catch (err) {
    if (err instanceof PubChemUnavailableError) {
      pubchemUnavailable = true;
    } else {
      throw err;
    }
  }

  if (!pubchemUnavailable) {
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

  const localData = computeLocalAnalysis(opsinResult.smiles);
  const naming = nameMolecule(opsinResult.smiles);

  return NextResponse.json({
    cid: null,
    name: naming.name || query,
    molecularFormula: localData?.molecularFormula ?? null,
    molecularWeight: localData?.molecularWeight ?? null,
    canonicalSMILES: opsinResult.smiles,
    inchi: opsinResult.inchi,
    source: "local",
    pubchemUnavailable: true,
  });
}
