"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Header } from "../components/header";
import { KetcherWrapper } from "@/components/molecule/ketcher-wrapper";

function BuilderContent() {
  const searchParams = useSearchParams();
  const smiles = searchParams.get("smiles") ?? undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pt-6 pb-20 sm:px-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Constructor de Moléculas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dibuja estructuras químicas orgánicas con el editor visual.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <KetcherWrapper
              initialSmiles={smiles}
              className="h-[600px]"
            />
          </div>
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
