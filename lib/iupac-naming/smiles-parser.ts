export interface Atom {
  id: number;
  element: string;
  neighbors: number[];
}

export interface Bond {
  from: number;
  to: number;
  order: 1 | 2 | 3;
}

export interface Molecule {
  atoms: Atom[];
  bonds: Bond[];
  ringAtoms: Set<number>;
}

const ATOM_PATTERN = /([A-Z][a-z]?)/g;

function addBond(mol: Molecule, from: number, to: number, order: 1 | 2 | 3): void {
  if (from === to) return;
  mol.bonds.push({ from, to, order });
  const a1 = mol.atoms[from];
  const a2 = mol.atoms[to];
  if (a1 && !a1.neighbors.includes(to)) a1.neighbors.push(to);
  if (a2 && !a2.neighbors.includes(from)) a2.neighbors.push(from);
}

function ensureAtom(mol: Molecule, id: number, element?: string): void {
  while (mol.atoms.length <= id) {
    mol.atoms.push({ id: mol.atoms.length, element: "C", neighbors: [] });
  }
  if (element) mol.atoms[id].element = element;
}

export function parseSmiles(smiles: string): Molecule {
  const mol: Molecule = { atoms: [], bonds: [], ringAtoms: new Set() };
  let pos = 0;
  let currentAtom = -1;
  let pendingBondOrder: 1 | 2 | 3 = 1;
  const stack: number[] = [];
  const ringBonds: Map<number, { atomId: number; order: 1 | 2 | 3 }> = new Map();

  const TWO_LETTER_ELEMENTS = new Set(["Cl", "Br", "Si", "Na", "Mg", "Al", "Ti", "Fe", "Ni", "Cu", "Zn", "Se", "Te"]);

  function readElement(): string {
    if (pos >= smiles.length) return "C";
    const ch = smiles[pos];
    if (ch >= "A" && ch <= "Z") {
      if (pos + 1 < smiles.length) {
        const next = smiles[pos + 1];
        if (next >= "a" && next <= "z") {
          const candidate = ch + next;
          if (TWO_LETTER_ELEMENTS.has(candidate)) {
            pos += 2;
            return candidate;
          }
        }
      }
      pos++;
      return ch;
    }
    return "C";
  }

  while (pos < smiles.length) {
    const ch = smiles[pos];

    if (ch === "(") {
      stack.push(currentAtom);
      pos++;
    } else if (ch === ")") {
      currentAtom = stack.pop() ?? currentAtom;
      pos++;
    } else if (ch >= "A" && ch <= "Z") {
      const el = readElement();
      const nextId = mol.atoms.length;
      ensureAtom(mol, nextId, el);

      if (currentAtom >= 0) {
        addBond(mol, currentAtom, nextId, pendingBondOrder);
      }
      pendingBondOrder = 1;
      currentAtom = nextId;
    } else if (ch === "=") {
      pendingBondOrder = 2;
      pos++;
    } else if (ch === "#") {
      pendingBondOrder = 3;
      pos++;
    } else if (ch >= "0" && ch <= "9") {
      const ringNum = parseInt(ch, 10);
      if (ringBonds.has(ringNum)) {
        const rb = ringBonds.get(ringNum)!;
        addBond(mol, rb.atomId, currentAtom, rb.order);
        mol.ringAtoms.add(rb.atomId);
        mol.ringAtoms.add(currentAtom);
        ringBonds.delete(ringNum);
      } else {
        ringBonds.set(ringNum, { atomId: currentAtom, order: pendingBondOrder });
      }
      pendingBondOrder = 1;
      pos++;
    } else if (ch === "%" && pos + 2 < smiles.length) {
      const ringNum = parseInt(smiles.substring(pos + 1, pos + 3), 10);
      if (ringBonds.has(ringNum)) {
        const rb = ringBonds.get(ringNum)!;
        addBond(mol, rb.atomId, currentAtom, rb.order);
        mol.ringAtoms.add(rb.atomId);
        mol.ringAtoms.add(currentAtom);
        ringBonds.delete(ringNum);
      } else {
        ringBonds.set(ringNum, { atomId: currentAtom, order: pendingBondOrder });
      }
      pendingBondOrder = 1;
      pos += 3;
    } else if (ch === "-" || ch === "/" || ch === "\\") {
      pos++;
    } else if (ch === "[") {
      const closeIdx = smiles.indexOf("]", pos);
      if (closeIdx === -1) break;
      const bracket = smiles.substring(pos + 1, closeIdx);
      let element = "";
      let i = 0;
      if (bracket[i] >= "A" && bracket[i] <= "Z") {
        element = bracket[i];
        i++;
        if (i < bracket.length && bracket[i] >= "a" && bracket[i] <= "z") {
          element += bracket[i];
          i++;
        }
      }
      const nextId = mol.atoms.length;
      ensureAtom(mol, nextId, element || "C");
      if (currentAtom >= 0) {
        addBond(mol, currentAtom, nextId, pendingBondOrder);
      }
      pendingBondOrder = 1;
      currentAtom = nextId;
      pos = closeIdx + 1;
    } else {
      pos++;
    }
  }

  return mol;
}

export function hasUnsupportedElements(mol: Molecule): string | null {
  const supported = new Set(["C", "H", "F", "Cl", "Br", "I", "O", "N"]);
  for (const atom of mol.atoms) {
    if (!supported.has(atom.element)) {
      return atom.element;
    }
  }
  return null;
}
