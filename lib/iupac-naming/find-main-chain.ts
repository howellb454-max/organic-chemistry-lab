import type { Molecule } from "./smiles-parser";
import {
  detectAllFunctionalGroups,
  GROUP_PRIORITY,
  type DetectedGroup,
  type FunctionalGroupType,
} from "./functional-groups";

export interface ChainResult {
  chain: number[];
  unsaturationPositions: { position: number; order: 2 | 3 }[];
  alcoholPositions: number[];
  aminePositions: number[];
  principalGroup: DetectedGroup | null;
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
  principalGroupPriority: number;
  length: number;
  unsaturationBonus: number;
}

function scoreChain(
  mol: Molecule,
  chain: number[],
  groupsOnChain: DetectedGroup[]
): ChainScore {
  let maxPriority = 0;
  for (const g of groupsOnChain) {
    if (chain.includes(g.carbonId) && g.priority > maxPriority) {
      maxPriority = g.priority;
    }
  }

  let unsaturationBonus = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const order = getBondOrder(mol, chain[i], chain[i + 1]);
    if (order === 2) unsaturationBonus += 10;
    if (order === 3) unsaturationBonus += 20;
  }

  return { principalGroupPriority: maxPriority, length: chain.length, unsaturationBonus };
}

function compareChains(
  mol: Molecule,
  a: number[],
  b: number[],
  groupsOnChain: DetectedGroup[]
): number {
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;

  const sa = scoreChain(mol, a, groupsOnChain);
  const sb = scoreChain(mol, b, groupsOnChain);

  if (sa.principalGroupPriority !== sb.principalGroupPriority) {
    return sb.principalGroupPriority - sa.principalGroupPriority;
  }
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

const GROUP_LABELS: Record<FunctionalGroupType, string> = {
  carboxylic_acid: "ácido carboxílico (-COOH)",
  ester: "éster (-COOR)",
  amide: "amida (-CONH₂)",
  nitrile: "nitrilo (-CN)",
  aldehyde: "aldehído (-CHO)",
  ketone: "cetona (C=O)",
  alcohol: "alcohol (-OH)",
  amine: "amina (-NH₂)",
  none: "",
};

export function findMainChain(mol: Molecule, steps?: string[]): ChainResult | null {
  if (mol.atoms.length === 0) return null;

  const allGroups = detectAllFunctionalGroups(mol);
  const alcoholCarbons = findAlcoholCarbons(mol);

  let bestChain: number[] = [];

  for (let i = 0; i < mol.atoms.length; i++) {
    const paths = findAllPaths(mol, i, new Set());
    for (const path of paths) {
      if (compareChains(mol, path, bestChain, allGroups) < 0) {
        bestChain = path;
      }
    }
  }

  if (bestChain.length === 0) return null;

  const principalGroup = allGroups.find((g) => bestChain.includes(g.carbonId)) ?? null;
  const groupsOnChain = allGroups.filter((g) => bestChain.includes(g.carbonId));
  const bestScore = scoreChain(mol, bestChain, allGroups);
  const unsatCount = countUnsaturation(mol, bestChain);

  if (steps) {
    const carbonCount = bestChain.filter((id) => mol.atoms[id]?.element === "C").length;
    steps.push(
      `Cadena principal: Se identificó una cadena de ${carbonCount} carbono${carbonCount > 1 ? "s" : ""} como la de mayor prioridad.`
    );

    if (principalGroup && principalGroup.type !== "none") {
      const label = GROUP_LABELS[principalGroup.type];
      steps.push(
        `Prioridad: Se eligió esta cadena porque contiene el grupo de mayor jerarquía: ${label}.`
      );
    } else if (bestScore.principalGroupPriority > 0 && principalGroup) {
      const label = GROUP_LABELS[principalGroup.type];
      steps.push(
        `Prioridad: Grupo funcional detectado: ${label}.`
      );
    }

    if (unsatCount > 0) {
      const tipos = unsatCount > 1 ? "insaturaciones" : "insaturación";
      steps.push(`Insaturación: Se detectó(n) ${unsatCount} ${tipos} en la cadena principal.`);
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

  const aminePositions: number[] = [];
  if (principalGroup?.type === "amine") {
    for (const id of bestChain) {
      const atom = mol.atoms[id];
      if (atom?.element !== "C") continue;
      for (const n of atom.neighbors) {
        const nAtom = mol.atoms[n];
        if (nAtom?.element !== "N") continue;
        const cN = nAtom.neighbors.filter((x) => mol.atoms[x]?.element === "C");
        if (cN.length === 1) aminePositions.push(id);
      }
    }
  }

  return {
    chain: bestChain,
    unsaturationPositions,
    alcoholPositions,
    aminePositions,
    principalGroup,
  };
}
