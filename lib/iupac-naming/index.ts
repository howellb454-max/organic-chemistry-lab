import { parseSmiles, hasUnsupportedElements, type Molecule } from "./smiles-parser";
import { findMainChain } from "./find-main-chain";
import { numberChain } from "./number-chain";
import { buildName } from "./build-name";

export interface NamingResult {
  name: string | null;
  error: string | null;
  steps: string[];
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
        error: `Esta estructura incluye elementos que aún no sabemos nombrar automáticamente (ej. ${unsupported}). Solo se soportan hidrocarburos con halógenos (F, Cl, Br, I).`,
        steps,
      };
    }

    const hasRings = hasRingClosures(mol);
    if (hasRings) {
      return {
        name: null,
        error: "Esta estructura contiene anillos. La nomenclatura de anillos aún no está soportada.",
        steps,
      };
    }

    const mainChain = findMainChain(mol, steps);
    if (!mainChain || mainChain.chain.length < 1) {
      return { name: null, error: "No se pudo determinar la cadena principal.", steps };
    }

    const numberingResult = numberChain(mol, mainChain, steps);
    const name = buildName(mol, numberingResult, mainChain, steps);

    if (!name) {
      return { name: null, error: "No se pudo generar el nombre IUPAC.", steps };
    }

    return { name, error: null, steps };
  } catch (err) {
    console.error("IUPAC naming error:", err);
    return { name: null, error: "Error al procesar la estructura molecular.", steps };
  }
}

function hasRingClosures(mol: Molecule): boolean {
  const visited = new Set<number>();
  const recStack = new Set<number>();

  function dfs(atomId: number, parentId: number): boolean {
    visited.add(atomId);
    recStack.add(atomId);
    const atom = mol.atoms[atomId];
    if (!atom) {
      recStack.delete(atomId);
      return false;
    }
    for (const neighbor of atom.neighbors) {
      if (neighbor === parentId) continue;
      if (recStack.has(neighbor)) {
        recStack.delete(atomId);
        return true;
      }
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, atomId)) {
          recStack.delete(atomId);
          return true;
        }
      }
    }
    recStack.delete(atomId);
    return false;
  }

  for (let i = 0; i < mol.atoms.length; i++) {
    if (!visited.has(i)) {
      if (dfs(i, -1)) return true;
    }
  }
  return false;
}
