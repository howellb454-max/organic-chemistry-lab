import type { Molecule } from "./smiles-parser";
import type { ChainResult } from "./find-main-chain";

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

export interface Substituent {
  name: string;
  chainPositions: number[];
}

function getSubstituentName(mol: Molecule, startAtom: number, fromChainAtom: number): Substituent | null {
  const branchAtoms: number[] = [];
  const visited = new Set<number>([fromChainAtom]);

  function dfs(atomId: number): void {
    branchAtoms.push(atomId);
    visited.add(atomId);
    const atom = mol.atoms[atomId];
    if (!atom) return;
    for (const neighbor of atom.neighbors) {
      if (visited.has(neighbor)) continue;
      if (neighbor === fromChainAtom) continue;
      dfs(neighbor);
    }
  }

  dfs(startAtom);

  if (branchAtoms.length === 0) return null;

  const elements = branchAtoms.map((id) => mol.atoms[id]?.element || "C");
  const carbonCount = elements.filter((e) => e === "C").length;
  const halogens = elements.filter((e) => ["F", "Cl", "Br", "I"].includes(e));
  const halogenCount = halogens.length;

  if (branchAtoms.length === 1) {
    const el = mol.atoms[startAtom]?.element || "C";
    if (el === "C") return { name: "metil", chainPositions: branchAtoms };
    if (el === "F") return { name: "fluoro", chainPositions: branchAtoms };
    if (el === "Cl") return { name: "cloro", chainPositions: branchAtoms };
    if (el === "Br") return { name: "bromo", chainPositions: branchAtoms };
    if (el === "I") return { name: "yodo", chainPositions: branchAtoms };
    return null;
  }

  if (carbonCount === 2 && halogenCount === 0) {
    return { name: "etil", chainPositions: branchAtoms };
  }
  if (carbonCount === 3 && halogenCount === 0) {
    const hasBranch = branchAtoms.some((id) => {
      const atom = mol.atoms[id];
      return atom && atom.neighbors.filter((n) => !visited.has(n) || n === fromChainAtom).length > 1;
    });
    if (!hasBranch) {
      return { name: "propil", chainPositions: branchAtoms };
    }
    return { name: "isopropil", chainPositions: branchAtoms };
  }
  if (carbonCount === 4 && halogenCount === 0) {
    const startNeighbors = mol.atoms[startAtom]?.neighbors.filter((n) => branchAtoms.includes(n) || n === fromChainAtom) || [];
    const branchingAtoms = branchAtoms.filter((id) => {
      const atom = mol.atoms[id];
      if (!atom) return false;
      let branchCount = 0;
      for (const n of atom.neighbors) {
        if (branchAtoms.includes(n)) branchCount++;
      }
      return branchCount >= 2;
    });
    if (branchingAtoms.length === 0) {
      return { name: "butil", chainPositions: branchAtoms };
    }
    if (branchingAtoms.length === 1 && branchingAtoms[0] === startAtom) {
      return { name: "isobutil", chainPositions: branchAtoms };
    }
    if (branchingAtoms.length === 1) {
      const branchNeighbors = mol.atoms[branchingAtoms[0]]?.neighbors.filter((n) => branchAtoms.includes(n)) || [];
      if (branchNeighbors.length === 3) {
        return { name: "ter-butil", chainPositions: branchAtoms };
      }
      return { name: "sec-butil", chainPositions: branchAtoms };
    }
    return { name: "butil", chainPositions: branchAtoms };
  }
  if (carbonCount >= 5 && halogenCount === 0) {
    const prefix = getPentylPrefix(mol, branchAtoms, startAtom, fromChainAtom);
    return { name: prefix, chainPositions: branchAtoms };
  }

  if (halogenCount > 0 && carbonCount > 0) {
    const halogenName = getHalogenName(halogenNames(halogenCount, halogens));
    const carbonPrefix = getCarbonPrefix(carbonCount);
    return { name: halogenName + carbonPrefix + "il", chainPositions: branchAtoms };
  }

  if (halogenCount === 1 && carbonCount === 0) {
    return { name: getHalogenName(halogenNames(1, halogens)), chainPositions: branchAtoms };
  }

  return null;
}

function halogenNames(count: number, halogens: string[]): string {
  if (count === 1) return halogens[0];
  if (halogens.every((h) => h === halogens[0])) return halogens[0];
  return halogens.sort().join("");
}

function getHalogenName(el: string): string {
  switch (el) {
    case "F": return "fluoro";
    case "Cl": return "cloro";
    case "Br": return "bromo";
    case "I": return "yodo";
    default: return el.toLowerCase();
  }
}

function getCarbonPrefix(n: number): string {
  switch (n) {
    case 1: return "met";
    case 2: return "et";
    case 3: return "prop";
    case 4: return "but";
    case 5: return "pent";
    case 6: return "hex";
    case 7: return "hept";
    case 8: return "oct";
    case 9: return "non";
    case 10: return "dec";
    default: return n + "-carbon";
  }
}

function getPentylPrefix(mol: Molecule, branchAtoms: number[], startAtom: number, _fromChainAtom: number): string {
  const carbonCount = branchAtoms.filter((id) => mol.atoms[id]?.element === "C").length;
  if (carbonCount === 5) return "pentil";

  let maxBranchLen = 0;
  const visited = new Set<number>();
  function dfs(atomId: number, depth: number): void {
    visited.add(atomId);
    if (depth > maxBranchLen) maxBranchLen = depth;
    const atom = mol.atoms[atomId];
    if (!atom) return;
    for (const n of atom.neighbors) {
      if (branchAtoms.includes(n) && !visited.has(n)) {
        dfs(n, depth + 1);
      }
    }
  }
  dfs(startAtom, 0);

  if (maxBranchLen <= 3) return "isopentil";
  return getCarbonPrefix(carbonCount) + "il";
}

export interface NumberingResult {
  chain: number[];
  numbering: Map<number, number>;
  substituents: Substituent[];
}

interface RawSubstituent {
  name: string;
  chainIndex: number;
}

export function numberChain(
  mol: Molecule,
  chainResult: ChainResult
): NumberingResult {
  const { chain, unsaturationPositions } = chainResult;

  if (chain.length === 0) {
    return { chain, numbering: new Map(), substituents: [] };
  }

  const chainSet = new Set(chain);
  const rawSubstituents: RawSubstituent[] = [];

  for (let i = 0; i < chain.length; i++) {
    const atomId = chain[i];
    const atom = mol.atoms[atomId];
    if (!atom) continue;

    for (const neighbor of atom.neighbors) {
      if (!chainSet.has(neighbor)) {
        const sub = getSubstituentName(mol, neighbor, atomId);
        if (sub) {
          rawSubstituents.push({ name: sub.name, chainIndex: i });
        }
      }
    }
  }

  const unsatForward = unsaturationPositions.map((u) => u.position + 1);
  const unsatBackward = unsaturationPositions.map((u) => chain.length - u.position - 1);
  const minUnsatForward = unsatForward.length > 0 ? Math.min(...unsatForward) : Infinity;
  const minUnsatBackward = unsatBackward.length > 0 ? Math.min(...unsatBackward) : Infinity;

  let useForward: boolean;
  if (minUnsatForward < minUnsatBackward) {
    useForward = true;
  } else if (minUnsatBackward < minUnsatForward) {
    useForward = false;
  } else {
    const locantsForward = rawSubstituents.map((s) => s.chainIndex + 1).sort((a, b) => a - b);
    const locantsBackward = rawSubstituents.map((s) => chain.length - s.chainIndex).sort((a, b) => a - b);
    useForward = true;
    for (let i = 0; i < Math.max(locantsForward.length, locantsBackward.length); i++) {
      const f = locantsForward[i] ?? Infinity;
      const b = locantsBackward[i] ?? Infinity;
      if (f < b) { useForward = true; break; }
      if (b < f) { useForward = false; break; }
    }
  }

  const numbering = new Map<number, number>();
  if (useForward) {
    chain.forEach((id, i) => numbering.set(id, i + 1));
  } else {
    chain.forEach((id, i) => numbering.set(id, chain.length - i));
  }

  const substituents: Substituent[] = [];
  for (const raw of rawSubstituents) {
    const locant = useForward ? raw.chainIndex + 1 : chain.length - raw.chainIndex;
    substituents.push({ name: raw.name, chainPositions: [locant] });
  }

  return { chain, numbering, substituents };
}
