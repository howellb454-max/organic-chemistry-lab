"use client";

import { useState } from "react";
import Image from "next/image";
import { FlaskConical } from "lucide-react";
import { KetcherWrapper } from "@/components/molecule/ketcher-wrapper";

interface CompoundStructureProps {
  smiles: string | null;
  imageUrl: string;
  name: string;
}

export function CompoundStructure({ smiles, imageUrl, name }: CompoundStructureProps) {
  const [ketcherFailed, setKetcherFailed] = useState(false);

  if (!smiles || ketcherFailed) {
    return (
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border bg-white p-4">
        {ketcherFailed ? (
          <div className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
            <FlaskConical className="size-6" />
            <span>Estructura no disponible en Ketcher</span>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt={`Estructura 2D de ${name}`}
            width={300}
            height={300}
            className="h-auto w-full object-contain"
            unoptimized
          />
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="h-[300px] w-full">
        <KetcherWrapper
          initialSmiles={smiles}
          readOnly
          className="h-full"
        />
      </div>
    </div>
  );
}
