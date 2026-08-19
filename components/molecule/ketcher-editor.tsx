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
    async (ketcher: Ketcher) => {
      ketcherRef.current = ketcher;

      if (initialSmiles) {
        try {
          await ketcher.setMolecule(initialSmiles);
        } catch (err) {
          console.warn("Ketcher: failed to load molecule", err);
        }
      }

      if (readOnly) {
        ketcher.editor.options({ viewOnlyMode: true });
      }
    },
    [initialSmiles, readOnly]
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
