import type { Molecule } from "./smiles-parser";
import type { ChainResult } from "./find-main-chain";
import type { DetectedGroup } from "./functional-groups";
import { isNitroGroup } from "./nitro-group";

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

function countAlkoxyCarbons(mol: Molecule, startAtomId: number, fromChainAtom: number): number {
  const seen = new Set<number>([startAtomId, fromChainAtom]);
  const stack = [...(mol.atoms[startAtomId]?.neighbors ?? [])];
  let count = 0;
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    if (mol.atoms[id]?.element !== "C") continue;
    count++;
    stack.push(...mol.atoms[id].neighbors);
  }
  return count;
}

function getSubstituentName(mol: Molecule, startAtom: number, fromChainAtom: number): Substituent | null {
  const startEl = mol.atoms[startAtom]?.element;
  if (startEl === "O") {
    const otherNeighbors = (mol.atoms[startAtom]?.neighbors ?? []).filter((x) => x !== fromChainAtom);
    const bridgesToCarbon = otherNeighbors.some((x) => mol.atoms[x]?.element === "C");
    if (bridgesToCarbon) {
      const cCount = countAlkoxyCarbons(mol, startAtom, fromChainAtom);
      const alkoxyNames = ["metoxi", "etoxi", "propoxi", "butoxi"];
      const name = alkoxyNames[cCount - 1] ?? `${cCount}-oxi`;
      return { name, chainPositions: [startAtom, ...otherNeighbors] };
    }
  }

  if (startEl === "N" && isNitroGroup(mol, startAtom)) {
    const oxygens = mol.atoms[startAtom].neighbors.filter(
      (x) => mol.atoms[x]?.element === "O"
    );
    return { name: "nitro", chainPositions: [startAtom, ...oxygens] };
  }

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
    if (el === "O") return { name: "hidroxi", chainPositions: branchAtoms };
    if (el === "N") return { name: "amino", chainPositions: branchAtoms };
    if (el === "S") return { name: "sulfanil", chainPositions: branchAtoms };
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
    if (halogenCount === 1 && carbonCount >= 2) {
      const loc = halogenLocant(mol, branchAtoms, startAtom, halogens[0]);
      if (loc !== null) {
        return { name: `(${loc}-${halogenName}${carbonPrefix}il)`, chainPositions: branchAtoms };
      }
    }
    return { name: halogenName + carbonPrefix + "il", chainPositions: branchAtoms };
  }

  if (halogenCount === 1 && carbonCount === 0) {
    return { name: getHalogenName(halogenNames(1, halogens)), chainPositions: branchAtoms };
  }

  return null;
}

function halogenLocant(
  mol: Molecule,
  branchAtoms: number[],
  startAtom: number,
  halogenElement: string
): number | null {
  const carbonBranch = branchAtoms.filter((id) => mol.atoms[id]?.element === "C");
  const halogenAtom = branchAtoms.find((id) => mol.atoms[id]?.element === halogenElement);
  if (halogenAtom === undefined) return null;
  const carbonWithHalogen = (mol.atoms[halogenAtom]?.neighbors ?? []).find((n) =>
    carbonBranch.includes(n)
  );
  if (carbonWithHalogen === undefined) return null;
  const adj = new Map<number, number[]>();
  for (const c of carbonBranch) {
    adj.set(c, (mol.atoms[c]?.neighbors ?? []).filter((n) => carbonBranch.includes(n)));
  }
  const dist = new Map<number, number>([[startAtom, 0]]);
  const visited = new Set([startAtom]);
  const queue: number[] = [startAtom];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (visited.has(n)) continue;
      visited.add(n);
      dist.set(n, (dist.get(cur) ?? 0) + 1);
      queue.push(n);
    }
  }
  const d = dist.get(carbonWithHalogen);
  return d === undefined ? null : d + 1;
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
  atomIds: number[];
}

export function numberChain(
  mol: Molecule,
  chainResult: ChainResult,
  steps?: string[]
): NumberingResult {
  const { chain, unsaturationPositions, alcoholPositions, thiolPositions, aminePositions } = chainResult;

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
          rawSubstituents.push({ name: sub.name, chainIndex: i, atomIds: sub.chainPositions });
        }
      }
    }
  }

  const hasAlcoholSuffix = alcoholPositions.length > 0;
  const principalGroup = chainResult.principalGroup;
  const principalGroupAtoms = new Set<number>();
  if (principalGroup) {
    const pgAtom = mol.atoms[principalGroup.carbonId];
    if (pgAtom) {
      principalGroupAtoms.add(principalGroup.carbonId);
      for (const n of pgAtom.neighbors) principalGroupAtoms.add(n);
    }
  }

  const filteredSubs = rawSubstituents.filter((s) => {
    if (hasAlcoholSuffix && s.name === "hidroxi") return false;
    if (principalGroup?.type === "thiol" && s.name === "sulfanil") return false;
    if (principalGroup?.type === "amine" && s.name === "amino") return false;
    if (principalGroupAtoms.size > 0) {
      for (const a of s.atomIds) {
        if (principalGroupAtoms.has(a)) return false;
      }
    }
    return true;
  });

  const ohIndices = alcoholPositions
    .map((id) => chain.indexOf(id))
    .filter((i) => i !== -1);

  const amineIndices = aminePositions
    .map((id) => chain.indexOf(id))
    .filter((i) => i !== -1);

const ohForward = ohIndices.map((i) => i + 1);
const ohBackward = ohIndices.map((i) => chain.length - i);
const minOhForward = ohForward.length > 0 ? Math.min(...ohForward) : Infinity;
const minOhBackward = ohBackward.length > 0 ? Math.min(...ohBackward) : Infinity;

const thiolIndices = thiolPositions
  .map((id) => chain.indexOf(id))
  .filter((i) => i !== -1);

const thiolForward = thiolIndices.map((i) => i + 1);
const thiolBackward = thiolIndices.map((i) => chain.length - i);
const minThiolForward = thiolForward.length > 0 ? Math.min(...thiolForward) : Infinity;
const minThiolBackward = thiolBackward.length > 0 ? Math.min(...thiolBackward) : Infinity;

const amForward = amineIndices.map((i) => i + 1);
  const amBackward = amineIndices.map((i) => chain.length - i);
  const minAmForward = amForward.length > 0 ? Math.min(...amForward) : Infinity;
  const minAmBackward = amBackward.length > 0 ? Math.min(...amBackward) : Infinity;

  const unsatForward = unsaturationPositions.map((u) => u.position + 1);
  const unsatBackward = unsaturationPositions.map((u) => chain.length - u.position - 1);
  const minUnsatForward = unsatForward.length > 0 ? Math.min(...unsatForward) : Infinity;
  const minUnsatBackward = unsatBackward.length > 0 ? Math.min(...unsatBackward) : Infinity;

  const locantsForward = filteredSubs.map((s) => s.chainIndex + 1).sort((a, b) => a - b);
  const locantsBackward = filteredSubs.map((s) => chain.length - s.chainIndex).sort((a, b) => a - b);

  let useForward = true;

  if (minOhForward < minOhBackward) {
    useForward = true;
  } else if (minOhBackward < minOhForward) {
    useForward = false;
  } else if (minThiolForward < minThiolBackward) {
    useForward = true;
  } else if (minThiolBackward < minThiolForward) {
    useForward = false;
  } else if (minAmForward < minAmBackward) {
    useForward = true;
  } else if (minAmBackward < minAmForward) {
    useForward = false;
  } else if (minUnsatForward < minUnsatBackward) {
    useForward = true;
  } else if (minUnsatBackward < minUnsatForward) {
    useForward = false;
  } else {
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
  for (const raw of filteredSubs) {
    const locant = useForward ? raw.chainIndex + 1 : chain.length - raw.chainIndex;
    substituents.push({ name: raw.name, chainPositions: [locant] });
  }

  if (steps) {
    const fromLabel = useForward ? "izquierdo (C1)" : "derecho";
    const toLabel = useForward ? "derecho" : "izquierdo (C1)";

    if (alcoholPositions.length > 0) {
      const ohLocantsForStep = useForward ? ohForward : ohBackward;
      const ohLocantsJoined = ohLocantsForStep
        .filter((loc) => loc !== Infinity)
        .sort((a, b) => a - b)
        .join(", ");
      steps.push(
        `Numeración: Se numeró de ${fromLabel} a ${toLabel} para asignar el localizador más bajo al grupo alcohol (posición ${ohLocantsJoined}).`
      );
    } else if (thiolPositions.length > 0) {
      const thiolLocantsForStep = useForward ? thiolForward : thiolBackward;
      const thiolLocantsJoined = thiolLocantsForStep
        .filter((loc) => loc !== Infinity)
        .sort((a, b) => a - b)
        .join(", ");
      steps.push(
        `Numeración: Se numeró de ${fromLabel} a ${toLabel} para asignar el localizador más bajo al grupo tiol (posición ${thiolLocantsJoined}).`
      );
    } else if (aminePositions.length > 0) {
      const amLocantsForStep = useForward ? amForward : amBackward;
      const amLocantsJoined = amLocantsForStep
        .filter((loc) => loc !== Infinity)
        .sort((a, b) => a - b)
        .join(", ");
      steps.push(
        `Numeración: Se numeró de ${fromLabel} a ${toLabel} para asignar el localizador más bajo al carbono unido al nitrógeno (posición ${amLocantsJoined}).`
      );
    } else if (unsaturationPositions.length > 0) {
      steps.push(
        `Numeración: Se numeró de ${fromLabel} a ${toLabel} para asignar el localizador más bajo al enlace múltiple.`
      );
    } else if (filteredSubs.length > 0) {
      steps.push(
        `Numeración: Se numeró de ${fromLabel} a ${toLabel} para asignar el localizador más bajo al primer sustituyente.`
      );
    } else {
      steps.push(`Numeración: Se numeró la cadena de ${fromLabel} a ${toLabel}.`);
    }

    if (substituents.length > 0) {
      const sortedNames = substituents
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b));
      steps.push(
        `Sustituyentes: Se detectaron y ordenaron alfabéticamente: ${sortedNames.join(", ")}.`
      );
    }
  }

  return { chain, numbering, substituents };
}
