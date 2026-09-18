import type { Molecule } from "./smiles-parser";

export type FunctionalGroupType =
  | "carboxylic_acid"
  | "ester"
  | "amide"
  | "nitrile"
  | "aldehyde"
  | "ketone"
  | "alcohol"
  | "amine"
  | "none";

export interface DetectedGroup {
  type: FunctionalGroupType;
  carbonId: number;
  priority: number;
}

export const GROUP_LABELS_ES: Record<FunctionalGroupType, string> = {
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

export const GROUP_PRIORITY: Record<FunctionalGroupType, number> = {
  carboxylic_acid: 8,
  ester: 7,
  amide: 6,
  nitrile: 5,
  aldehyde: 4,
  ketone: 3,
  alcohol: 2,
  amine: 1,
  none: 0,
};

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

function countCarbonNeighbors(mol: Molecule, atomId: number, exclude?: number): number {
  const atom = mol.atoms[atomId];
  if (!atom) return 0;
  let count = 0;
  for (const n of atom.neighbors) {
    if (n === exclude) continue;
    if (mol.atoms[n]?.element === "C") count++;
  }
  return count;
}

function findCarboxylicAcids(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    let hasDoubleO = false;
    let hasSingleOH = false;
    for (const n of atom.neighbors) {
      const neighbor = mol.atoms[n];
      if (!neighbor) continue;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 2) hasDoubleO = true;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 1) {
        const oNeighbors = neighbor.neighbors.filter((x) => x !== i);
        if (oNeighbors.length === 0 || oNeighbors.some((x) => mol.atoms[x]?.element === "H")) {
          hasSingleOH = true;
        }
      }
    }
    if (hasDoubleO && hasSingleOH) {
      results.push({ type: "carboxylic_acid", carbonId: i, priority: GROUP_PRIORITY.carboxylic_acid });
    }
  }
  return results;
}

function findEsters(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    let hasDoubleO = false;
    let hasSingleOC = false;
    for (const n of atom.neighbors) {
      const neighbor = mol.atoms[n];
      if (!neighbor) continue;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 2) hasDoubleO = true;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 1) {
        const oNeighbors = neighbor.neighbors.filter((x) => x !== i);
        if (oNeighbors.some((x) => mol.atoms[x]?.element === "C")) hasSingleOC = true;
      }
    }
    if (hasDoubleO && hasSingleOC) {
      results.push({ type: "ester", carbonId: i, priority: GROUP_PRIORITY.ester });
    }
  }
  return results;
}

function findAmides(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    let hasDoubleO = false;
    let hasN = false;
    for (const n of atom.neighbors) {
      const neighbor = mol.atoms[n];
      if (!neighbor) continue;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 2) hasDoubleO = true;
      if (neighbor.element === "N") hasN = true;
    }
    if (hasDoubleO && hasN) {
      results.push({ type: "amide", carbonId: i, priority: GROUP_PRIORITY.amide });
    }
  }
  return results;
}

function findNitriles(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    for (const n of atom.neighbors) {
      if (mol.atoms[n]?.element === "N" && getBondOrder(mol, i, n) === 3) {
        results.push({ type: "nitrile", carbonId: i, priority: GROUP_PRIORITY.nitrile });
        break;
      }
    }
  }
  return results;
}

function findAldehydes(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    let hasDoubleO = false;
    for (const n of atom.neighbors) {
      if (mol.atoms[n]?.element === "O" && getBondOrder(mol, i, n) === 2) {
        hasDoubleO = true;
        break;
      }
    }
    if (!hasDoubleO) continue;
    const cNeighbors = countCarbonNeighbors(mol, i);
    if (cNeighbors <= 1) {
      const alreadyAcid = findCarboxylicAcids(mol).some((g) => g.carbonId === i);
      const alreadyAmide = findAmides(mol).some((g) => g.carbonId === i);
      const alreadyEster = findEsters(mol).some((g) => g.carbonId === i);
      if (!alreadyAcid && !alreadyAmide && !alreadyEster) {
        results.push({ type: "aldehyde", carbonId: i, priority: GROUP_PRIORITY.aldehyde });
      }
    }
  }
  return results;
}

function findKetones(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    let hasDoubleO = false;
    for (const n of atom.neighbors) {
      if (mol.atoms[n]?.element === "O" && getBondOrder(mol, i, n) === 2) {
        hasDoubleO = true;
        break;
      }
    }
    if (!hasDoubleO) continue;
    const cNeighbors = countCarbonNeighbors(mol, i);
    if (cNeighbors >= 2) {
      const alreadyAcid = findCarboxylicAcids(mol).some((g) => g.carbonId === i);
      const alreadyAmide = findAmides(mol).some((g) => g.carbonId === i);
      const alreadyEster = findEsters(mol).some((g) => g.carbonId === i);
      if (!alreadyAcid && !alreadyAmide && !alreadyEster) {
        results.push({ type: "ketone", carbonId: i, priority: GROUP_PRIORITY.ketone });
      }
    }
  }
  return results;
}

function findAlcohols(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "C") continue;
    for (const n of atom.neighbors) {
      const neighbor = mol.atoms[n];
      if (!neighbor) continue;
      if (neighbor.element === "O" && getBondOrder(mol, i, n) === 1) {
        const oNeighbors = neighbor.neighbors.filter((x) => x !== i);
        if (oNeighbors.length === 0 || oNeighbors.some((x) => mol.atoms[x]?.element === "H")) {
          const alreadyAcid = findCarboxylicAcids(mol).some((g) => g.carbonId === i);
          const alreadyEster = findEsters(mol).some((g) => g.carbonId === i);
          if (!alreadyAcid && !alreadyEster) {
            results.push({ type: "alcohol", carbonId: i, priority: GROUP_PRIORITY.alcohol });
          }
        }
      }
    }
  }
  return results;
}

function findAmines(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (atom.element !== "N") continue;
    const carbonNeighbors = atom.neighbors.filter((n) => mol.atoms[n]?.element === "C");
    if (carbonNeighbors.length === 1) {
      const alreadyAmide = findAmides(mol).some((g) => {
        const amideC = mol.atoms[g.carbonId];
        return amideC?.neighbors.includes(i);
      });
      if (!alreadyAmide) {
        results.push({ type: "amine", carbonId: carbonNeighbors[0], priority: GROUP_PRIORITY.amine });
      }
    }
  }
  return results;
}

export function detectAllFunctionalGroups(mol: Molecule): DetectedGroup[] {
  const groups: DetectedGroup[] = [
    ...findCarboxylicAcids(mol),
    ...findEsters(mol),
    ...findAmides(mol),
    ...findNitriles(mol),
    ...findAldehydes(mol),
    ...findKetones(mol),
    ...findAlcohols(mol),
    ...findAmines(mol),
  ];
  return groups.sort((a, b) => b.priority - a.priority);
}

export function getPrincipalGroup(mol: Molecule): DetectedGroup | null {
  const groups = detectAllFunctionalGroups(mol);
  return groups.length > 0 ? groups[0] : null;
}

export function isOnChain(group: DetectedGroup, chain: number[]): boolean {
  return chain.includes(group.carbonId);
}

export function getEsterAlkylName(mol: Molecule, esterCarbon: number): string {
  let bridgeO = -1;
  for (const n of mol.atoms[esterCarbon]?.neighbors ?? []) {
    if (mol.atoms[n]?.element === "O" && getBondOrder(mol, esterCarbon, n) === 1) {
      bridgeO = n;
      break;
    }
  }
  if (bridgeO === -1) return "metilo";

  const seen = new Set<number>([esterCarbon, bridgeO]);
  const stack = [...(mol.atoms[bridgeO]?.neighbors ?? [])];
  let carbonCount = 0;
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (mol.atoms[id]?.element !== "C") continue;
    carbonCount++;
    stack.push(...mol.atoms[id].neighbors);
  }

  const alkylNames = ["metilo", "etilo", "propilo", "butilo", "pentilo"];
  return alkylNames[carbonCount - 1] ?? `${carbonCount}-carbonilo`;
}
