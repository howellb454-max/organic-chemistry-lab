"use client";

import { useCallback, useEffect, useRef } from "react";
import { StandaloneStructServiceProvider } from "ketcher-standalone";
import { Editor } from "ketcher-react";
import type { Ketcher } from "ketcher-core";
import "ketcher-react/dist/index.css";

const structServiceProvider = new StandaloneStructServiceProvider();

export interface KetcherApi {
  getSmiles: () => Promise<string>;
}

interface KetcherEditorProps {
  initialSmiles?: string;
  readOnly?: boolean;
  onSmilesChange?: (smiles: string) => void;
  onReady?: (api: KetcherApi) => void;
  className?: string;
}

export function KetcherEditor({
  initialSmiles,
  readOnly = false,
  onSmilesChange,
  onReady,
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

      onReady?.({
        getSmiles: () => ketcher.getSmiles(),
      });
    },
    [initialSmiles, readOnly, onReady]
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
