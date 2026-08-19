"use client";

import { useCallback, useEffect, useRef } from "react";
import { StandaloneStructServiceProvider } from "ketcher-standalone";
import { Editor } from "ketcher-react";
import type { Ketcher } from "ketcher-core";
import "ketcher-react/dist/index.css";

const structServiceProvider = new StandaloneStructServiceProvider();

interface KetcherEditorProps {
  initialSmiles?: string;
  readOnly?: boolean;
  onSmilesChange?: (smiles: string) => void;
  className?: string;
}

export function KetcherEditor({
  initialSmiles,
  readOnly = false,
  onSmilesChange,
  className,
}: KetcherEditorProps) {
  const ketcherRef = useRef<Ketcher | null>(null);

  const handleOnInit = useCallback(
    (ketcher: Ketcher) => {
      ketcherRef.current = ketcher;

      if (initialSmiles) {
        ketcher.setMolecule(initialSmiles);
      }
    },
    [initialSmiles]
  );

  useEffect(() => {
    return () => {
      ketcherRef.current = null;
    };
  }, []);

  return (
    <div className={className}>
      <Editor
        staticResourcesUrl=""
        structServiceProvider={structServiceProvider}
        onInit={handleOnInit}
        errorHandler={(msg) => console.warn("Ketcher:", msg)}
      />
    </div>
  );
}
