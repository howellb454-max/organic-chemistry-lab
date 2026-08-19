"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Atom, FlaskConical, Hash, Weight, Binary } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import type { CompoundResult } from "@/lib/pubchem";

export function SearchResults() {
  const searchParams = useSearchParams();
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
    const properties = [
      { icon: Hash, label: "CID", value: String(result.cid) },
      { icon: FlaskConical, label: "Fórmula Molecular", value: result.molecularFormula },
      { icon: Weight, label: "Masa Molar", value: `${result.molecularWeight} g/mol` },
      { icon: Binary, label: "SMILES", value: result.canonicalSMILES },
    ];

    return (
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
            <Atom className="size-5 text-emerald-500" />
          </div>
          <CardTitle className="text-xl">{result.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
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
        </CardContent>
      </Card>
    );
  }

  return null;
}
