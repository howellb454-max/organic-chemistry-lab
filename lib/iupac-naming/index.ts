import { parseSmiles, hasUnsupportedElements, type Molecule } from "./smiles-parser";
import { findMainChain } from "./find-main-chain";
import { numberChain } from "./number-chain";
import { buildName } from "./build-name";

export interface NamingResult {
  name: string | null;
  error: string | null;
  steps: string[];
}

function hasRingClosures(mol: Molecule): boolean {
  return mol.ringAtoms.size > 0;
}

export function nameMolecule(smiles: string): NamingResult {
  const steps: string[] = [];

  try {
    const mol = parseSmiles(smiles);

    if (mol.atoms.length === 0) {
      return { name: null, error: "No se pudo解析 la estructura molecular.", steps };
    }

    const unsupported = hasUnsupportedElements(mol);
    if (unsupported) {
      return {
        name: null,
        error: `Esta estructura incluye elementos que aún no sabemos nombrar automáticamente (ej. ${unsupported}). Solo se soportan C, H, O, N y halógenos (F, Cl, Br, I).`,
        steps,
      };
    }

    const isCyclic = hasRingClosures(mol);
    if (isCyclic) {
      steps.push("Estructura: Se detectó un ciclo en la molécula, se añadirá el prefijo 'ciclo-' al nombre del padre.");
    }

    const mainChain = findMainChain(mol, steps);
    if (!mainChain || mainChain.chain.length < 1) {
      return { name: null, error: "No se pudo determinar la cadena principal.", steps };
    }

    const numberingResult = numberChain(mol, mainChain, steps);
    const name = buildName(mol, numberingResult, mainChain, steps, isCyclic);

    if (!name) {
      return { name: null, error: "No se pudo generar el nombre IUPAC.", steps };
    }

    return { name, error: null, steps };
  } catch (err) {
    console.error("IUPAC naming error:", err);
    return { name: null, error: "Error al procesar la estructura molecular.", steps };
  }
}
