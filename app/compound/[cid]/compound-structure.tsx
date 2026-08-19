"use client";

import Image from "next/image";

interface CompoundStructureProps {
  imageUrl: string;
  name: string;
}

export function CompoundStructure({ imageUrl, name }: CompoundStructureProps) {
  return (
    <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border bg-white p-4">
      <Image
        src={imageUrl}
        alt={`Estructura 2D de ${name}`}
        width={300}
        height={300}
        className="h-auto w-full object-contain"
        unoptimized
      />
    </div>
  );
}
