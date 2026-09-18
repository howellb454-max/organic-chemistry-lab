import { parseSmiles, hasUnsupportedElements, type Molecule } from "./smiles-parser";
import { findMainChain } from "./find-main-chain";
import { numberChain } from "./number-chain";
import { buildName } from "./build-name";
import {
  detectAllFunctionalGroups,
  detectFunctionalGroupsForDisplay,
  GROUP_LABELS_ES,
  isThiolSulfur,
  type FunctionalGroupType,
  type FunctionalGroupInfo,
  type DetectedGroup,
} from "./functional-groups";
import { isNitroGroup } from "./nitro-group";
import { tryBenzeneSubstitutedName } from "./aromatic-names";

export interface NamingResult {
  name: string | null;
  error: string | null;
  steps: string[];
  functionalGroupsDetected?: FunctionalGroupInfo[];
}

function hasRingClosures(mol: Molecule): boolean {
  return mol.ringAtoms.size > 0;
}

function findUnsupportedGroupError(mol: Molecule): string | null {
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (!atom) continue;

    if (atom.element === "S" && !isThiolSulfur(mol, i)) {
      return "Esta estructura contiene azufre (S) en un grupo que aún no sabemos nombrar con certeza (sulfuros, sulfonas, sulfóxidos, disulfuros, etc.).";
    }

    if (atom.element === "N") {
      const hasO = atom.neighbors.some((n) => mol.atoms[n]?.element === "O");
      if (hasO && !isNitroGroup(mol, i)) {
        return "Esta estructura incluye nitrógeno unido a oxígeno en un grupo que aún no sabemos nombrar con certeza.";
      }
      const hasDoubleC = atom.neighbors.some(
        (n) => mol.atoms[n]?.element === "C" && getBondOrder(mol, i, n) === 2
      );
      if (hasDoubleC) {
        return "Esta estructura incluye enlaces carbono-nitrógeno con doble enlace (iminas u oximas) que aún no sabemos nombrar con certeza.";
      }
    }
  }
  return null;
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

const SUFFIX_MARKERS: Record<FunctionalGroupType, RegExp> = {
  carboxylic_acid: /(oico|fórmico)/,
  ester: /oato/,
  amide: /amida/,
  nitrile: /nitrilo/,
  aldehyde: /(anal|aldehído)/,
  ketone: /ona/,
  alcohol: /ol$/,
  thiol: /tiol/,
  amine: /amina/,
  none: /./,
};

function validateNamingConsistency(
  mol: Molecule,
  name: string,
  ctx: {
    aromaticRing: Set<number> | null;
    mainChain: number[];
    topGroup: DetectedGroup | null;
  }
): string | null {
  const { aromaticRing, mainChain, topGroup } = ctx;

  const hasAromaticFlags = mol.atoms.some((a) => a.aromatic);
  if (hasAromaticFlags && !aromaticRing) {
    return "Esta estructura contiene un sistema aromático (anillos fusionados o heterociclos) que el nomenclador aún no sabe nombrar con certeza.";
  }

  const chainSet = new Set(mainChain);
  const ringSet = aromaticRing ?? new Set<number>();

  if (topGroup && topGroup.type !== "none" && !chainSet.has(topGroup.carbonId)) {
    const label = GROUP_LABELS_ES[topGroup.type];
    return `Esta estructura incluye elementos que aún no sabemos nombrar automáticamente: el grupo ${label} no queda sobre la cadena principal (combinación con anillo aromático u otras ramificaciones).`;
  }

  for (const bond of mol.bonds) {
    if (bond.order === 1) continue;
    const fromEl = mol.atoms[bond.from]?.element;
    const toEl = mol.atoms[bond.to]?.element;
    if (fromEl !== "C" || toEl !== "C") continue;
    const inChainOrRing =
      chainSet.has(bond.from) || chainSet.has(bond.to) || ringSet.has(bond.from) || ringSet.has(bond.to);
    if (!inChainOrRing) {
      return "Esta estructura incluye enlaces dobles o triples dentro de un sustituyente que aún no sabemos nombrar automáticamente.";
    }
  }

  if (topGroup && topGroup.type !== "none") {
    const marker = SUFFIX_MARKERS[topGroup.type];
    if (!marker.test(name)) {
      return "Esta estructura incluye elementos que aún no sabemos nombrar automáticamente (el nombre generado no reflejaría su grupo funcional principal).";
    }

    if (topGroup.type !== "alcohol") {
      let unsatOnChain = 0;
      for (let i = 0; i < mainChain.length - 1; i++) {
        for (const b of mol.bonds) {
          const a = mainChain[i]!;
          const n = mainChain[i + 1]!;
          if ((b.from === a && b.to === n) || (b.from === n && b.to === a)) {
            if (b.order === 2 || b.order === 3) unsatOnChain++;
            break;
          }
        }
      }
      if (unsatOnChain > 0 && !/(en|in)/.test(name)) {
        return "Esta estructura combina un grupo funcional con insaturaciones en la cadena que aún no sabemos nombrar con certeza.";
      }
    }
  }

  return null;
}

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

    const unsupportedGroup = findUnsupportedGroupError(mol);
    if (unsupportedGroup) {
      return { name: null, error: unsupportedGroup, steps };
    }

    const isCyclic = hasRingClosures(mol);
    if (isCyclic) {
      steps.push("Estructura: Se detectó un ciclo en la molécula, se añadirá el prefijo 'ciclo-' al nombre del padre.");
    }

    const allGroups = detectAllFunctionalGroups(mol);
    const functionalGroupsDetected = detectFunctionalGroupsForDisplay(mol);

    const aromaticCycle = isAromatic(mol);
    const aromaticParent: string | null = aromaticCycle ? "benceno" : null;
    if (aromaticParent) {
      steps.push("Estructura: Se identificó un anillo aromático de benceno como núcleo principal.");
    }

    const hasAromaticFlags = mol.atoms.some((a) => a.aromatic);
    if (hasAromaticFlags && !aromaticCycle) {
      return {
        name: null,
        error:
          "Esta estructura contiene un sistema aromático (anillos fusionados o heterociclos) que el nomenclador aún no sabe nombrar con certeza.",
        steps,
      };
    }

    if (aromaticCycle) {
      const retained = tryBenzeneSubstitutedName(mol, [...aromaticCycle]);
      if (retained) {
        steps.push(retained.explanation);
        steps.push(`Nombre final: ${retained.name}.`);
        return { name: retained.name, error: null, steps, functionalGroupsDetected };
      }
    }

    const mainChain = findMainChain(
      mol,
      steps,
      aromaticCycle ? [...aromaticCycle] : undefined
    );
    if (!mainChain || mainChain.chain.length < 1) {
      return { name: null, error: "No se pudo determinar la cadena principal.", steps, functionalGroupsDetected };
    }

    const numberingResult = numberChain(mol, mainChain, steps);
    const name = buildName(mol, numberingResult, mainChain, steps, isCyclic, aromaticParent);

    if (!name) {
      return { name: null, error: "No se pudo generar el nombre IUPAC.", steps, functionalGroupsDetected };
    }

    const topGroup = allGroups[0] ?? null;
    const consistencyError = validateNamingConsistency(mol, name, {
      aromaticRing: aromaticCycle,
      mainChain: mainChain.chain,
      topGroup,
    });
    if (consistencyError) {
      return { name: null, error: consistencyError, steps, functionalGroupsDetected };
    }

    return { name, error: null, steps, functionalGroupsDetected };
  } catch (err) {
    console.error("IUPAC naming error:", err);
    return { name: null, error: "Error al procesar la estructura molecular.", steps };
  }
}
