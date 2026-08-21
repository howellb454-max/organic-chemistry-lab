import { parseSmiles, hasUnsupportedElements, type Molecule } from "./smiles-parser";
import { findMainChain } from "./find-main-chain";
import { numberChain } from "./number-chain";
import { buildName } from "./build-name";

export interface NamingResult {
  name: string | null;
  error: string | null;
}

export function nameMolecule(smiles: string): NamingResult {
  try {
    const mol = parseSmiles(smiles);

    if (mol.atoms.length === 0) {
      return { name: null, error: "No se pudo解析 la estructura molecular." };
    }

    const unsupported = hasUnsupportedElements(mol);
    if (unsupported) {
      return {
        name: null,
        error: `Esta estructura incluye elementos que aún no sabemos nombrar automáticamente (ej. ${unsupported}). Solo se soportan hidrocarburos con halógenos (F, Cl, Br, I).`,
      };
    }

    const hasRings = hasRingClosures(mol);
    if (hasRings) {
      return {
        name: null,
        error: "Esta estructura contiene anillos. La nomenclatura de anillos aún no está soportada.",
      };
    }

    const mainChain = findMainChain(mol);
    if (!mainChain || mainChain.chain.length < 1) {
      return { name: null, error: "No se pudo determinar la cadena principal." };
    }

    const numberingResult = numberChain(mol, mainChain);
    const name = buildName(mol, numberingResult);

    if (!name) {
      return { name: null, error: "No se pudo generar el nombre IUPAC." };
    }

    return { name, error: null };
  } catch (err) {
    console.error("IUPAC naming error:", err);
    return { name: null, error: "Error al procesar la estructura molecular." };
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
