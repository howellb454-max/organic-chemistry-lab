"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Atom, FlaskConical, ArrowRight, AlertTriangle, Weight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompoundResult, getCompoundImageUrl } from "@/lib/pubchem";

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q")?.trim() ?? "";

  const [result, setResult] = useState<CompoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) {
      setResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Error desconocido");
        } else {
          setResult(data);
        }
      })
      .catch(() => setError("Error de conexión. Intenta de nuevo."))
      .finally(() => setLoading(false));
  }, [q]);

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
        <Atom className="mb-4 size-10 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">
          Escribe el nombre de un compuesto para comenzar.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="mb-4 size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Buscando &quot;{q}&quot; en PubChem...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
        <FlaskConical className="mb-4 size-10 text-destructive" />
        <p className="text-lg font-medium">{error}</p>
      </div>
    );
  }

  if (result) {
    const hasCid = result.cid !== null;

    if (hasCid) {
      const imageUrl = getCompoundImageUrl(result.cid!);
      return (
        <button
          onClick={() => router.push(`/compound/${result.cid}`)}
          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
        >
          <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                <Image
                  src={imageUrl}
                  alt={`Estructura de ${result.name}`}
                  width={64}
                  height={64}
                  className="h-auto w-full object-contain"
                  unoptimized
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="truncate text-base font-semibold">{result.name}</h3>
                <p className="font-mono text-sm text-muted-foreground truncate">
                  {result.molecularFormula}
                  {result.molecularWeight && ` · ${result.molecularWeight} g/mol`}
                </p>
                <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                  {result.canonicalSMILES}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </CardContent>
          </Card>
        </button>
      );
    }

    // OPSIN-only or local-computed result (no CID) — show inline
    const isLocal = result.source === "local";
    return (
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Atom className="size-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{result.name}</h3>
              <p className="text-xs text-muted-foreground">
                {isLocal ? "Datos calculados localmente" : "Sin datos en PubChem"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              {isLocal
                ? "PubChem no está disponible. Los datos mostrados (fórmula, masa molar) son calculados localmente y no han sido verificados contra PubChem."
                : "Nombre resuelto por OPSIN. PubChem no tiene este compuesto, por lo que no hay datos de fórmula, masa ni imagen 2D disponibles."}
            </span>
          </div>

          {(result.molecularFormula || result.molecularWeight) && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {result.molecularFormula && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <FlaskConical className="size-3" />
                    Fórmula Molecular
                  </dt>
                  <dd className="font-mono text-sm">{result.molecularFormula}</dd>
                </div>
              )}
              {result.molecularWeight && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Weight className="size-3" />
                    Masa Molar
                  </dt>
                  <dd className="font-mono text-sm">{result.molecularWeight} g/mol</dd>
                </div>
              )}
            </dl>
          )}

          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              SMILES
            </dt>
            <dd className="font-mono text-sm break-all">{result.canonicalSMILES}</dd>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
