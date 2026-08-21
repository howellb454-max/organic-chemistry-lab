import type { Molecule } from "./smiles-parser";

export interface ChainResult {
  chain: number[];
  unsaturationPositions: { position: number; order: 2 | 3 }[];
  alcoholPositions: number[];
}

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

function findAllPaths(mol: Molecule, start: number, visited: Set<number>): number[][] {
  if (mol.atoms[start]?.element !== "C") return [];
  const paths: number[][] = [[start]];
  visited.add(start);
  const atom = mol.atoms[start];
  if (!atom) return paths;
  for (const neighbor of atom.neighbors) {
    if (visited.has(neighbor)) continue;
    if (mol.atoms[neighbor]?.element !== "C") continue;
    const subPaths = findAllPaths(mol, neighbor, new Set(visited));
    for (const subPath of subPaths) {
      paths.push([start, ...subPath]);
    }
  }
  return paths;
}

function findAlcoholCarbons(mol: Molecule): Set<number> {
  const result = new Set<number>();
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    for (const neighbor of atom.neighbors) {
      if (mol.atoms[neighbor]?.element === "O") {
        result.add(i);
        break;
      }
    }
  }
  return result;
}

interface ChainScore {
  alcoholCount: number;
  length: number;
  unsaturationBonus: number;
}

function scoreChain(mol: Molecule, chain: number[], alcoholCarbons: Set<number>): ChainScore {
  let alcoholCount = 0;
  for (const atomId of chain) {
    if (mol.atoms[atomId]?.element === "C" && alcoholCarbons.has(atomId)) alcoholCount++;
  }
  let unsaturationBonus = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const order = getBondOrder(mol, chain[i], chain[i + 1]);
    if (order === 2) unsaturationBonus += 10;
    if (order === 3) unsaturationBonus += 20;
  }
  return { alcoholCount, length: chain.length, unsaturationBonus };
}

function compareChains(
  mol: Molecule,
  a: number[],
  b: number[],
  alcoholCarbons: Set<number>
): number {
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const sa = scoreChain(mol, a, alcoholCarbons);
  const sb = scoreChain(mol, b, alcoholCarbons);

  if (sa.alcoholCount !== sb.alcoholCount) return sb.alcoholCount - sa.alcoholCount;
  if (sa.length !== sb.length) return sb.length - sa.length;
  return sb.unsaturationBonus - sa.unsaturationBonus;
}

function countUnsaturation(mol: Molecule, chain: number[]): number {
  let count = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const order = getBondOrder(mol, chain[i], chain[i + 1]);
    if (order === 2 || order === 3) count++;
  }
  return count;
}

export function findMainChain(mol: Molecule, steps?: string[]): ChainResult | null {
  if (mol.atoms.length === 0) return null;

  const alcoholCarbons = findAlcoholCarbons(mol);
  let bestChain: number[] = [];

  for (let i = 0; i < mol.atoms.length; i++) {
    const paths = findAllPaths(mol, i, new Set());
    for (const path of paths) {
      if (compareChains(mol, path, bestChain, alcoholCarbons) < 0) {
        bestChain = path;
      }
    }
  }

  if (bestChain.length === 0) return null;

  const carbonCount = bestChain.filter((id) => mol.atoms[id]?.element === "C").length;
  const bestScore = scoreChain(mol, bestChain, alcoholCarbons);
  const unsatCount = countUnsaturation(mol, bestChain);

  if (steps) {
    steps.push(
      `Cadena principal: Se identificó una cadena de ${carbonCount} carbono${carbonCount > 1 ? "s" : ""} como la de mayor prioridad.`
    );

    if (bestScore.alcoholCount > 0) {
      const grupoText = bestScore.alcoholCount === 1 ? "grupo" : "grupos";
      steps.push(
        `Prioridad: Se eligió esta cadena porque contiene ${bestScore.alcoholCount} ${grupoText} alcohol (-OH).`
      );
    }

    if (unsatCount > 0) {
      const tipos = bestScore.unsaturationBonus >= 20 ? "enlaces triples" : "enlaces dobles";
      steps.push(
        `Insaturación: Se detectaron ${unsatCount} ${tipos} en la cadena principal.`
      );
    }
  }

  const unsaturationPositions: { position: number; order: 2 | 3 }[] = [];
  for (let i = 0; i < bestChain.length - 1; i++) {
    const order = getBondOrder(mol, bestChain[i], bestChain[i + 1]);
    if (order === 2 || order === 3) {
      unsaturationPositions.push({ position: i, order });
    }
  }

  const alcoholPositions = bestChain.filter(
    (id) => mol.atoms[id]?.element === "C" && alcoholCarbons.has(id)
  );

  return { chain: bestChain, unsaturationPositions, alcoholPositions };
}
