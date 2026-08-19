"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Atom, FlaskConical, Hash, Weight, Binary, AlertTriangle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { CompoundResult, getCompoundImageUrl } from "@/lib/pubchem";

export function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";

  const [result, setResult] = useState<CompoundResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    if (!q) {
      setResult(null);
      setError(null);
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);
    setImgError(false);
    setImgLoaded(false);

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
    const hasPubChemData = result.cid !== null;
    const imageUrl = hasPubChemData ? getCompoundImageUrl(result.cid!) : null;

    const properties = [
      { icon: Hash, label: "CID", value: String(result.cid), show: hasPubChemData },
      { icon: FlaskConical, label: "Fórmula Molecular", value: result.molecularFormula ?? "", show: result.molecularFormula !== null },
      { icon: Weight, label: "Masa Molar", value: result.molecularWeight ? `${result.molecularWeight} g/mol` : "", show: result.molecularWeight !== null },
      { icon: Binary, label: "SMILES", value: result.canonicalSMILES, show: true },
    ].filter((p) => p.show);

    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Atom className="size-5 text-emerald-500" />
          </div>
          <CardTitle className="text-xl">{result.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasPubChemData && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                Nombre resuelto por OPSIN. PubChem no tiene este compuesto en su base de datos, por lo que no hay datos de fórmula, masa ni imagen 2D disponibles.
              </span>
            </div>
          )}

          <div className="flex flex-col items-center gap-6 sm:flex-row">
            {imageUrl && (
              <div className="flex w-full flex-col items-center gap-2 sm:w-48">
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border bg-white p-2">
                  {!imgError ? (
                    <>
                      {!imgLoaded && (
                        <div className="flex size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                      )}
                      <Image
                        src={imageUrl}
                        alt={`Estructura 2D de ${result.name}`}
                        width={200}
                        height={200}
                        className={`h-auto w-full object-contain transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0 absolute"}`}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => setImgError(true)}
                        unoptimized
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
                      <FlaskConical className="size-6" />
                      <span>Estructura no disponible</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Estructura 2D</span>
              </div>
            )}

            <dl className={`grid gap-4 ${imageUrl ? "flex-1 sm:grid-cols-2" : "w-full sm:grid-cols-2"}`}>
              {properties.map((prop) => (
                <div key={prop.label} className="rounded-lg bg-muted/50 p-3">
                  <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <prop.icon className="size-3" />
                    {prop.label}
                  </dt>
                  <dd className="font-mono text-sm break-all">{prop.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
