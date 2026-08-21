import type { Molecule } from "./smiles-parser";

export interface ChainResult {
  chain: number[];
  unsaturationPositions: { position: number; order: 2 | 3 }[];
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

function scoreChain(mol: Molecule, chain: number[]): { carbonCount: number; unsaturationBonus: number; length: number } {
  let carbonCount = 0;
  let unsaturationBonus = 0;
  for (const atomId of chain) {
    if (mol.atoms[atomId]?.element === "C") carbonCount++;
  }
  for (let i = 0; i < chain.length - 1; i++) {
    const order = getBondOrder(mol, chain[i], chain[i + 1]);
    if (order === 2) unsaturationBonus += 10;
    if (order === 3) unsaturationBonus += 20;
  }
  return { carbonCount, unsaturationBonus, length: chain.length };
}

function compareChains(mol: Molecule, a: number[], b: number[]): number {
  const sa = scoreChain(mol, a);
  const sb = scoreChain(mol, b);
  if (sa.carbonCount !== sb.carbonCount) return sb.carbonCount - sa.carbonCount;
  if (sa.unsaturationBonus !== sb.unsaturationBonus) return sb.unsaturationBonus - sa.unsaturationBonus;
  return sb.length - sa.length;
}

export function findMainChain(mol: Molecule): ChainResult | null {
  if (mol.atoms.length === 0) return null;

  let bestChain: number[] = [];

  for (let i = 0; i < mol.atoms.length; i++) {
    const paths = findAllPaths(mol, i, new Set());
    for (const path of paths) {
      if (compareChains(mol, path, bestChain) < 0) {
        bestChain = path;
      }
    }
  }

  if (bestChain.length === 0) return null;

  const unsaturationPositions: { position: number; order: 2 | 3 }[] = [];
  for (let i = 0; i < bestChain.length - 1; i++) {
    const order = getBondOrder(mol, bestChain[i], bestChain[i + 1]);
    if (order === 2 || order === 3) {
      unsaturationPositions.push({ position: i, order });
    }
  }

  return { chain: bestChain, unsaturationPositions };
}
