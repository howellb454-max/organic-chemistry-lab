import type { Molecule } from "@/lib/iupac-naming/smiles-parser";

export interface LocalCompoundData {
  molecularFormula: string;
  molecularWeight: string;
}

const ATOMIC_MASS: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, F: 18.998,
  P: 30.974, S: 32.06, Cl: 35.45, Br: 79.904, I: 126.904,
  Si: 28.086, B: 10.81, Se: 78.96, Na: 22.99, Mg: 24.305,
  K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38,
  Mn: 54.938, Co: 58.933, Ni: 58.693, Ti: 47.867, Al: 26.982,
  Li: 6.941,
};

const VALENCE: Record<string, number[]> = {
  H: [1], B: [3], C: [4], N: [3, 5], O: [2], F: [1],
  Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1], Br: [1], I: [1],
  Se: [2, 4, 6], Na: [1], Mg: [2], K: [1], Ca: [2],
  Fe: [2, 3], Cu: [1, 2], Zn: [2], Mn: [2, 4, 7],
  Co: [2, 3], Ni: [2], Ti: [4], Al: [3], Li: [1],
};

function expectedValence(element: string): number {
  const vals = VALENCE[element];
  return vals ? vals[0] : 4;
}

interface FAtom {
  element: string;
  neighbors: number[];
  bondOrders: number[];
  aromatic: boolean;
  bracketH: number | null;
}

interface FBond {
  from: number;
  to: number;
  order: number;
}

interface FMolecule {
  atoms: FAtom[];
  bonds: FBond[];
}

function addFBond(mol: FMolecule, from: number, to: number, order: number): void {
  if (from === to) return;
  mol.bonds.push({ from, to, order });
  const a1 = mol.atoms[from];
  const a2 = mol.atoms[to];
  a1.neighbors.push(to);
  a1.bondOrders.push(order);
  a2.neighbors.push(from);
  a2.bondOrders.push(order);
}

const TWO_LETTER_ELEMENTS = new Set([
  "Cl", "Br", "Si", "Na", "Mg", "Al", "Ti", "Fe", "Ni",
  "Cu", "Zn", "Se", "Te", "Li", "Mn", "Co", "Ca", "K",
]);
const AROMATIC_SET = new Set(["c", "n", "o", "s", "p"]);
const AROMATIC_MAP: Record<string, string> = {
  c: "C", n: "N", o: "O", s: "S", p: "P",
};

function parseSmilesForFormula(smiles: string): FMolecule {
  const mol: FMolecule = { atoms: [], bonds: [] };
  let pos = 0;
  let current = -1;
  let pendingOrder = 1;
  const stack: number[] = [];
  const ringBonds = new Map<number, { atomId: number; order: number }>();

  function pushAtom(element: string, aromatic: boolean, bracketH: number | null): number {
    const id = mol.atoms.length;
    mol.atoms.push({ element, neighbors: [], bondOrders: [], aromatic, bracketH });
    return id;
  }

  while (pos < smiles.length) {
    const ch = smiles[pos];

    if (ch === "(") {
      stack.push(current);
      pos++;
    } else if (ch === ")") {
      current = stack.pop() ?? current;
      pos++;
    } else if (ch === "[") {
      const closeIdx = smiles.indexOf("]", pos);
      if (closeIdx === -1) break;
      const bracket = smiles.substring(pos + 1, closeIdx);
      let i = 0;
      let element = "";
      let isAromatic = false;
      if (i < bracket.length && bracket[i] >= "A" && bracket[i] <= "Z") {
        element = bracket[i]; i++;
        if (i < bracket.length && bracket[i] >= "a" && bracket[i] <= "z") {
          const candidate = element + bracket[i];
          if (TWO_LETTER_ELEMENTS.has(candidate)) {
            element = candidate; i++;
          } else {
            element += bracket[i]; i++;
          }
        }
      } else if (i < bracket.length && bracket[i] >= "a" && bracket[i] <= "z") {
        element = AROMATIC_MAP[bracket[i]] ?? bracket[i].toUpperCase();
        isAromatic = true;
        i++;
      }
      let hCount: number | null = null;
      if (i < bracket.length && bracket[i] === "H") {
        i++;
        if (i < bracket.length && bracket[i] >= "0" && bracket[i] <= "9") {
          hCount = parseInt(bracket[i], 10); i++;
        } else {
          hCount = 1;
        }
      }
      const nextId = pushAtom(element || "C", isAromatic, hCount);
      if (current >= 0) addFBond(mol, current, nextId, pendingOrder);
      pendingOrder = 1;
      current = nextId;
      pos = closeIdx + 1;
    } else if (ch >= "A" && ch <= "Z") {
      let element = ch; pos++;
      if (pos < smiles.length && smiles[pos] >= "a" && smiles[pos] <= "z") {
        const candidate = element + smiles[pos];
        if (TWO_LETTER_ELEMENTS.has(candidate)) {
          element = candidate; pos++;
        }
      }
      const nextId = pushAtom(element, false, null);
      if (current >= 0) addFBond(mol, current, nextId, pendingOrder);
      pendingOrder = 1;
      current = nextId;
    } else if (AROMATIC_SET.has(ch)) {
      const nextId = pushAtom(AROMATIC_MAP[ch], true, null);
      if (current >= 0) addFBond(mol, current, nextId, pendingOrder);
      pendingOrder = 1;
      current = nextId;
      pos++;
    } else if (ch === "=") {
      pendingOrder = 2; pos++;
    } else if (ch === "#") {
      pendingOrder = 3; pos++;
    } else if (ch >= "0" && ch <= "9") {
      const ringNum = parseInt(ch, 10);
      if (ringBonds.has(ringNum)) {
        const rb = ringBonds.get(ringNum)!;
        addFBond(mol, rb.atomId, current, rb.order);
        ringBonds.delete(ringNum);
      } else {
        ringBonds.set(ringNum, { atomId: current, order: pendingOrder });
      }
      pendingOrder = 1; pos++;
    } else if (ch === "%" && pos + 2 < smiles.length) {
      const ringNum = parseInt(smiles.substring(pos + 1, pos + 3), 10);
      if (ringBonds.has(ringNum)) {
        const rb = ringBonds.get(ringNum)!;
        addFBond(mol, rb.atomId, current, rb.order);
        ringBonds.delete(ringNum);
      } else {
        ringBonds.set(ringNum, { atomId: current, order: pendingOrder });
      }
      pendingOrder = 1; pos += 3;
    } else if (ch === "-" || ch === "/" || ch === "\\") {
      pos++;
    } else {
      pos++;
    }
  }

  return mol;
}

function countImplicitH(mol: FMolecule, atomId: number): number {
  const atom = mol.atoms[atomId];
  if (!atom) return 0;
  if (atom.element === "H") return 0;

  if (atom.bracketH !== null) return atom.bracketH;

  let explicitSum = 0;
  for (const order of atom.bondOrders) explicitSum += order;

  let ev = expectedValence(atom.element);

  if (atom.aromatic) {
    if (atom.element === "C") {
      ev = 3;
    } else if (atom.element === "N" || atom.element === "O" || atom.element === "S" || atom.element === "P") {
      ev = Math.max(1, ev - 1);
    }
  }

  return Math.max(0, ev - explicitSum);
}

function getAtomCounts(mol: FMolecule): Map<string, number> {
  const counts = new Map<string, number>();

  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    counts.set(atom.element, (counts.get(atom.element) ?? 0) + 1);
    const implicitH = countImplicitH(mol, i);
    if (implicitH > 0) {
      counts.set("H", (counts.get("H") ?? 0) + implicitH);
    }
  }

  return counts;
}

function formatFormula(counts: Map<string, number>): string {
  const carbon = counts.get("C") ?? 0;
  const hydrogen = counts.get("H") ?? 0;
  const others: Array<[string, number]> = [];
  for (const [el, count] of counts) {
    if (el === "C" || el === "H") continue;
    others.push([el, count]);
  }
  others.sort((a, b) => a[0].localeCompare(b[0]));

  let formula = "";
  if (carbon > 0) formula += `C${carbon > 1 ? carbon : ""}`;
  if (hydrogen > 0) formula += `H${hydrogen > 1 ? hydrogen : ""}`;
  for (const [el, count] of others) {
    formula += `${el}${count > 1 ? count : ""}`;
  }
  return formula;
}

export function computeLocalAnalysis(smiles: string): LocalCompoundData | null {
  try {
    const mol = parseSmilesForFormula(smiles.trim());
    if (mol.atoms.length === 0) return null;

    const counts = getAtomCounts(mol);
    const formula = formatFormula(counts);

    let mass = 0;
    for (const [element, count] of counts) {
      const atomicMass = ATOMIC_MASS[element];
      if (atomicMass === undefined) return null;
      mass += atomicMass * count;
    }

    return {
      molecularFormula: formula,
      molecularWeight: mass.toFixed(2),
    };
  } catch {
    return null;
  }
}
