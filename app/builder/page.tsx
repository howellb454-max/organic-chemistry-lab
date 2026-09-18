"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  Atom,
  FlaskConical,
  Hash,
  Weight,
  Binary,
  Search,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ListOrdered,
} from "lucide-react";
import { Header } from "../components/header";
import { KetcherWrapper } from "@/components/molecule/ketcher-wrapper";
import { ErrorBoundary } from "@/components/error-boundary";
import type { KetcherApi } from "@/components/molecule/ketcher-editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { nameMolecule } from "@/lib/iupac-naming";

interface AnalyzeResult {
  cid: number | null;
  name: string | null;
  molecularFormula: string | null;
  molecularWeight: string | null;
  canonicalSMILES: string;
  source?: "not_in_pubchem" | "local" | string;
}

function BuilderContent() {
  const searchParams = useSearchParams();
  const smiles = searchParams.get("smiles") ?? undefined;

  const [ketcherApi, setKetcherApi] = useState<KetcherApi | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iupacName, setIupacName] = useState<string | null>(null);
  const [iupacError, setIupacError] = useState<string | null>(null);
  const [iupacSteps, setIupacSteps] = useState<string[]>([]);

  const handleAnalyze = useCallback(async () => {
    if (!ketcherApi) return;

    setAnalyzing(true);
    setResult(null);
    setError(null);
    setIupacName(null);
    setIupacError(null);
    setIupacSteps([]);

    try {
      const currentSmiles = await ketcherApi.getSmiles();

      if (!currentSmiles || currentSmiles.trim().length === 0) {
        setError("Dibuja una estructura primero.");
        setAnalyzing(false);
        return;
      }

      const naming = nameMolecule(currentSmiles);
      if (naming.name) {
        setIupacName(naming.name);
        setIupacSteps(naming.steps);
      } else {
        setIupacError(naming.error);
      }

      const res = await fetch(
        `/api/analyze?smiles=${encodeURIComponent(currentSmiles)}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al analizar.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setAnalyzing(false);
    }
  }, [ketcherApi]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Constructor de Moléculas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Dibuja estructuras químicas orgánicas con el editor visual.
              </p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={!ketcherApi || analyzing}
              size="lg"
              className="shrink-0"
            >
              {analyzing ? (
                <div className="mr-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Search className="mr-1 size-4" />
              )}
              Analizar estructura
            </Button>
          </div>

          <ErrorBoundary fallbackTitle="Error en el editor molecular">
            <div className="overflow-hidden rounded-xl border">
              <KetcherWrapper
                initialSmiles={smiles}
                onReady={setKetcherApi}
                className="h-[600px]"
              />
            </div>
          </ErrorBoundary>

          {error && (
            <Card className="mt-6">
              <CardContent className="flex items-center gap-3 p-4">
                <FlaskConical className="size-5 shrink-0 text-destructive" />
                <p className="text-sm">{error}</p>
              </CardContent>
            </Card>
          )}

          {iupacName && (
            <Card className="mt-6 border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Nombre IUPAC generado
                  </p>
                  <p className="text-lg font-semibold">{iupacName}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {iupacName && iupacSteps.length > 0 && (
            <Card className="mt-4 border-emerald-500/20 bg-emerald-500/[0.03]">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ListOrdered className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-base">
                  Desglose de Nomenclatura
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {iupacSteps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-semibold text-emerald-500">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-muted-foreground pt-0.5">
                        {step}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {iupacError && (
            <Card className="mt-6 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <BookOpen className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Nomenclatura IUPAC
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {iupacError}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="mt-6">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Atom className="size-5 text-emerald-500" />
                </div>
                <CardTitle className="text-xl">
                  {result.name || "Compuesto analizado"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.source === "not_in_pubchem" && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Este compuesto no está en la base de datos de PubChem,
                      pero aquí está su SMILES.
                    </span>
                  </div>
                )}

                {result.source === "local" && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      PubChem no está disponible. Fórmula y masa molar calculadas
                      localmente, no verificadas contra PubChem.
                    </span>
                  </div>
                )}

                <dl className="grid gap-3 sm:grid-cols-2">
                  {result.cid && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Hash className="size-3" />
                        CID
                      </dt>
                      <dd className="font-mono text-sm">{result.cid}</dd>
                    </div>
                  )}
                  {result.molecularFormula && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <FlaskConical className="size-3" />
                        Fórmula Molecular
                      </dt>
                      <dd className="font-mono text-sm">
                        {result.molecularFormula}
                      </dd>
                    </div>
                  )}
                  {result.molecularWeight && (
                    <div className="rounded-lg bg-muted/50 p-3">
                      <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Weight className="size-3" />
                        Masa Molar
                      </dt>
                      <dd className="font-mono text-sm">
                        {result.molecularWeight} g/mol
                      </dd>
                    </div>
                  )}
                  <div className="rounded-lg bg-muted/50 p-3">
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Binary className="size-3" />
                      SMILES
                    </dt>
                    <dd className="font-mono text-sm break-all">
                      {result.canonicalSMILES}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Cargando builder...</p>
          </div>
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
