import { parseSmiles, hasUnsupportedElements, type Molecule } from "./smiles-parser";
import { findMainChain } from "./find-main-chain";
import { numberChain } from "./number-chain";
import { buildName } from "./build-name";

export interface NamingResult {
  name: string | null;
  error: string | null;
  steps: string[];
}

function hasRingClosures(mol: Molecule): boolean {
  return mol.ringAtoms.size > 0;
}

function getBondOrder(mol: Molecule, a: number, b: number): 1 | 2 | 3 {
  for (const bond of mol.bonds) {
    if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
      return bond.order;
    }
  }
  return 1;
}

function hasExplicitBond(mol: Molecule, a: number, b: number): boolean {
  return mol.bonds.some(
    (bd) => (bd.from === a && bd.to === b) || (bd.from === b && bd.to === a)
  );
}

function isAlternatingHexagon(mol: Molecule, hex: number[]): boolean {
  const orders: number[] = [];
  for (let i = 0; i < 6; i++) orders.push(getBondOrder(mol, hex[i], hex[(i + 1) % 6]));
  const a = [2, 1, 2, 1, 2, 1];
  const b = [1, 2, 1, 2, 1, 2];
  return orders.every((o, i) => o === a[i]) || orders.every((o, i) => o === b[i]);
}

function findKekuleCycle(mol: Molecule): Set<number> | null {
  if (mol.atoms.length < 6 || mol.atoms.length > 40) return null;
  const path: number[] = [];
  const onPath = new Set<number>();

  function dfs(start: number, cur: number): Set<number> | null {
    if (path.length === 6) {
      return hasExplicitBond(mol, cur, start) && isAlternatingHexagon(mol, path)
        ? new Set(path)
        : null;
    }
    for (const nb of mol.atoms[cur]?.neighbors ?? []) {
      if (!onPath.has(nb) && mol.atoms[nb]?.element === "C" && (mol.atoms[nb]?.neighbors.length ?? 0) >= 2) {
        path.push(nb);
        onPath.add(nb);
        const found = dfs(start, nb);
        if (found) return found;
        path.pop();
        onPath.delete(nb);
      }
    }
    return null;
  }

  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i]?.element !== "C") continue;
    path.length = 0;
    onPath.clear();
    path.push(i);
    onPath.add(i);
    const found = dfs(i, i);
    if (found) return found;
  }
  return null;
}

export function isAromatic(mol: Molecule): Set<number> | null {
  const flagged = new Set<number>();
  for (let i = 0; i < mol.atoms.length; i++) {
    const a = mol.atoms[i];
    if (a.aromatic && a.element === "C") flagged.add(i);
  }
  if (flagged.size === 6) {
    let ok = true;
    for (const id of flagged) {
      const inRing = mol.atoms[id]?.neighbors.filter((n) => flagged.has(n)) ?? [];
      if (inRing.length !== 2) {
        ok = false;
        break;
      }
    }
    if (ok) return flagged;
  }
  return findKekuleCycle(mol);
}

const ELEMENT_NAMES_ES: Record<string, string> = {
  S: "azufre", P: "fósforo", Si: "silicio", Na: "sodio", Mg: "magnesio",
  Al: "aluminio", Ti: "titanio", Fe: "hierro", Ni: "níquel", Cu: "cobre",
  Zn: "zinc", Se: "selenio", Te: "telurio", Li: "litio", K: "potasio",
  Ca: "calcio", B: "boro",
};

export function nameMolecule(smiles: string): NamingResult {
  const steps: string[] = [];

  try {
    const mol = parseSmiles(smiles);

    if (mol.atoms.length === 0) {
      return { name: null, error: "No se pudo解析 la estructura molecular.", steps };
    }

    const unsupported = hasUnsupportedElements(mol);
    if (unsupported) {
      const nombre = ELEMENT_NAMES_ES[unsupported] ?? `el elemento ${unsupported}`;
      return {
        name: null,
        error: `Esta estructura contiene ${nombre} (${unsupported}), que aún no es compatible con el nomenclador automático. Solo se soportan C, H, O, N y halógenos (F, Cl, Br, I).`,
        steps,
      };
    }

    const isCyclic = hasRingClosures(mol);
    if (isCyclic) {
      steps.push("Estructura: Se detectó un ciclo en la molécula, se añadirá el prefijo 'ciclo-' al nombre del padre.");
    }

    const aromaticCycle = isAromatic(mol);
    const aromaticParent: string | null = aromaticCycle ? "benceno" : null;
    if (aromaticParent) {
      steps.push("Estructura: Se identificó un anillo aromático de benceno como núcleo principal.");
    }

    const mainChain = findMainChain(
      mol,
      steps,
      aromaticCycle ? [...aromaticCycle] : undefined
    );
    if (!mainChain || mainChain.chain.length < 1) {
      return { name: null, error: "No se pudo determinar la cadena principal.", steps };
    }

    const numberingResult = numberChain(mol, mainChain, steps);
    const name = buildName(mol, numberingResult, mainChain, steps, isCyclic, aromaticParent);

    if (!name) {
      return { name: null, error: "No se pudo generar el nombre IUPAC.", steps };
    }

    return { name, error: null, steps };
  } catch (err) {
    console.error("IUPAC naming error:", err);
    return { name: null, error: "Error al procesar la estructura molecular.", steps };
  }
}
