import type { Molecule } from "./smiles-parser";

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

export function isNitroGroup(mol: Molecule, atomId: number): boolean {
  const atom = mol.atoms[atomId];
  if (!atom || atom.element !== "N") return false;
  const hasCarbon = atom.neighbors.some((n) => mol.atoms[n]?.element === "C");
  if (!hasCarbon) return false;

  let oxygenCount = 0;
  let doubleBonds = 0;
  let singleBonds = 0;
  for (const n of atom.neighbors) {
    const neighbor = mol.atoms[n];
    if (!neighbor) continue;
    if (neighbor.element === "O") {
      oxygenCount++;
      const order = getBondOrder(mol, atomId, n);
      if (order === 2) doubleBonds++;
      else singleBonds++;
    }
  }

  if (oxygenCount < 2 || doubleBonds < 1) return false;
  return singleBonds >= 1 || doubleBonds >= 2;
}

export function getNitroOxygenNeighbors(mol: Molecule, atomId: number): number[] {
  const atom = mol.atoms[atomId];
  if (!atom) return [];
  return atom.neighbors.filter((n) => mol.atoms[n]?.element === "O");
}