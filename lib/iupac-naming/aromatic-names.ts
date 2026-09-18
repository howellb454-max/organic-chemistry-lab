import type { Molecule } from "./smiles-parser";

export interface RetainedAromaticName {
  name: string;
  explanation: string;
}

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

function heavyNeighbors(mol: Molecule, id: number, exclude: number[]): number[] {
  return (mol.atoms[id]?.neighbors ?? []).filter(
    (n) => !exclude.includes(n) && mol.atoms[n]?.element !== "H"
  );
}

/**
 * Intenta reconocer bencenos monosustituidos con nombres retenidos IUPAC
 * (fenol, benzaldehído, ácido benzoico, acetofenona, anisol).
 * Solo devuelve un nombre cuando la estructura coincide EXACTAMENTE con el
 * patrón: un anillo de benceno + un único sustituyente sin nada más.
 */
export function tryRetainedAromaticName(
  mol: Molecule,
  ring: number[]
): RetainedAromaticName | null {
  const ringSet = new Set(ring);

  const attachments: { ringAtom: number; startAtom: number }[] = [];
  for (const id of ring) {
    const atom = mol.atoms[id];
    if (!atom) continue;
    for (const n of atom.neighbors) {
      if (!ringSet.has(n) && mol.atoms[n]?.element !== "H") {
        attachments.push({ ringAtom: id, startAtom: n });
      }
    }
  }

  if (attachments.length !== 1) return null;
  const { startAtom } = attachments[0];
  const start = mol.atoms[startAtom];
  if (!start) return null;

  let patternAtoms: number[] = [];
  let result: RetainedAromaticName | null = null;

  if (start.element === "O" && heavyNeighbors(mol, startAtom, [attachments[0].ringAtom]).length === 0) {
    patternAtoms = [startAtom];
    result = {
      name: "fenol",
      explanation:
        "Nomenclatura: Un grupo hidroxilo (-OH) unido directamente al anillo de benceno recibe el nombre retenido 'fenol'.",
    };
  } else if (start.element === "O") {
    const bridged = heavyNeighbors(mol, startAtom, [attachments[0].ringAtom]);
    if (
      bridged.length === 1 &&
      mol.atoms[bridged[0]]?.element === "C" &&
      heavyNeighbors(mol, bridged[0], [startAtom]).length === 0
    ) {
      patternAtoms = [startAtom, bridged[0]];
      result = {
        name: "anisol",
        explanation:
          "Nomenclatura: Un grupo metoxi (-OCH₃) sobre el anillo recibe el nombre retenido 'anisol' (también válido: metoxibenceno).",
      };
    }
  } else if (start.element === "C") {
    const others = heavyNeighbors(mol, startAtom, [attachments[0].ringAtom]);
    let oxo = -1;
    let single = -1;
    let singleOrder: 1 | 2 | 3 = 1;
    for (const n of others) {
      if (mol.atoms[n]?.element !== "O") continue;
      const order = getBondOrder(mol, startAtom, n);
      if (order === 2 && oxo === -1) oxo = n;
      else if (order === 1 && single === -1) {
        single = n;
        singleOrder = order;
      }
    }

    const nonOxygen = others.filter((n) => mol.atoms[n]?.element !== "O");

    if (oxo !== -1 && single === -1 && nonOxygen.length === 0) {
      patternAtoms = [startAtom, oxo];
      result = {
        name: "benzaldehído",
        explanation:
          "Nomenclatura: Un grupo formilo (-CHO) sobre el anillo recibe el nombre retenido 'benzaldehído' (nombre sistemático alternativo: bencarbaldehído).",
      };
    } else if (
      oxo !== -1 &&
      single !== -1 &&
      singleOrder === 1 &&
      heavyNeighbors(mol, single, [startAtom]).length === 0 &&
      nonOxygen.length === 0
    ) {
      patternAtoms = [startAtom, oxo, single];
      result = {
        name: "ácido benzoico",
        explanation:
          "Nomenclatura: Un grupo carboxilo (-COOH) sobre el anillo da el 'ácido benzoico': el carbono del carboxilo no cuenta como parte del anillo.",
      };
    } else if (
      oxo !== -1 &&
      single !== -1 &&
      singleOrder === 1 &&
      nonOxygen.length === 1 &&
      mol.atoms[nonOxygen[0]]?.element === "C" &&
      heavyNeighbors(mol, nonOxygen[0], [startAtom]).length === 0
    ) {
      patternAtoms = [startAtom, oxo, single, ...nonOxygen];
      result = {
        name: "acetofenona",
        explanation:
          "Nomenclatura: Un grupo acetilo (-COCH₃) sobre el anillo recibe el nombre retenido 'acetofenona' (sistemático: feniletanona).",
      };
    }
  }

  if (!result) return null;

  // Verificación de exhaustividad: ningún átomo pesado puede quedar fuera del
  // anillo o del patrón reconocido.
  const covered = new Set<number>([...ringSet, ...patternAtoms]);
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (!atom || atom.element === "H") continue;
    if (!covered.has(i)) return null;
  }

  return result;
}
