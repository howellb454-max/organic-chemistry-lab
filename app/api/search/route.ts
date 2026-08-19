import { NextRequest, NextResponse } from "next/server";
import { searchCompound, CompoundNotFoundError } from "@/lib/pubchem";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Debes escribir un nombre de compuesto." },
      { status: 400 }
    );
  }

  try {
    const compound = await searchCompound(q.trim());
    return NextResponse.json(compound);
  } catch (err) {
    if (err instanceof CompoundNotFoundError) {
      return NextResponse.json(
        { error: `No se encontró ningún compuesto para "${q}". Intenta con otro nombre.` },
        { status: 404 }
      );
    }

    console.error("PubChem API error:", err);
    return NextResponse.json(
      { error: "Error al consultar PubChem. Intenta de nuevo más tarde." },
      { status: 502 }
    );
  }
}
