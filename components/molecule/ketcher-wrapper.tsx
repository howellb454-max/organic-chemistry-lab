"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const KetcherEditorRaw = dynamic(
  () => import("./ketcher-editor").then((mod) => ({ default: mod.KetcherEditor })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando editor molecular...</p>
        </div>
      </div>
    ),
  }
);

interface KetcherWrapperProps {
  initialSmiles?: string;
  readOnly?: boolean;
  onSmilesChange?: (smiles: string) => void;
  className?: string;
}

export function KetcherWrapper(props: KetcherWrapperProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Cargando editor molecular...</p>
          </div>
        </div>
      }
    >
      <KetcherEditorRaw {...props} />
    </Suspense>
  );
}
