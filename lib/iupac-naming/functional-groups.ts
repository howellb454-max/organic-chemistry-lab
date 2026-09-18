import type { Molecule } from "./smiles-parser";
import { isNitroGroup } from "./nitro-group";

export type FunctionalGroupType =
  | "carboxylic_acid"
  | "ester"
  | "amide"
  | "nitrile"
  | "aldehyde"
  | "ketone"
  | "alcohol"
  | "thiol"
  | "amine"
  | "none";

export interface DetectedGroup {
  type: FunctionalGroupType;
  carbonId: number;
  priority: number;
}

export type DisplayGroupType = FunctionalGroupType | "nitro" | "ether";

export interface FunctionalGroupInfo {
  type: DisplayGroupType;
  nameEs: string;
  isPrincipal: boolean;
  priority?: number;
}

export const GROUP_DISPLAY_NAMES_ES: Record<DisplayGroupType, string> = {
  carboxylic_acid: "Ácido carboxílico",
  ester: "Éster",
  amide: "Amida",
  nitrile: "Nitrilo",
  aldehyde: "Aldehído",
  ketone: "Cetona",
  alcohol: "Alcohol",
  thiol: "Tiol",
  amine: "Amina",
  nitro: "Nitro",
  ether: "Éter",
  none: "Sin grupo",
};

export const GROUP_LABELS_ES: Record<FunctionalGroupType, string> = {
  carboxylic_acid: "ácido carboxílico (-COOH)",
  ester: "éster (-COOR)",
  amide: "amida (-CONH₂)",
  nitrile: "nitrilo (-CN)",
  aldehyde: "aldehído (-CHO)",
  ketone: "cetona (C=O)",
  alcohol: "alcohol (-OH)",
  thiol: "tiol (-SH)",
  amine: "amina (-NH₂)",
  none: "",
};

export const GROUP_PRIORITY: Record<FunctionalGroupType, number> = {
  carboxylic_acid: 9,
  ester: 8,
  amide: 7,
  nitrile: 6,
  aldehyde: 5,
  ketone: 4,
  alcohol: 3,
  thiol: 2,
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
    if (isNitroGroup(mol, i)) continue;
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

export function isThiolSulfur(mol: Molecule, atomId: number): boolean {
  const atom = mol.atoms[atomId];
  if (!atom || atom.element !== "S") return false;
  const heavy = atom.neighbors.filter((n) => mol.atoms[n] && mol.atoms[n].element !== "H");
  if (heavy.length !== 1) return false;
  return mol.atoms[heavy[0]]?.element === "C";
}

function findThiols(mol: Molecule): DetectedGroup[] {
  const results: DetectedGroup[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i]?.element !== "S") continue;
    if (!isThiolSulfur(mol, i)) continue;
    const carbon = mol.atoms[i].neighbors.find(
      (n) => mol.atoms[n]?.element === "C"
    );
    if (carbon === undefined) continue;
    results.push({ type: "thiol", carbonId: carbon, priority: GROUP_PRIORITY.thiol });
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
    ...findThiols(mol),
    ...findAmines(mol),
  ];
  return groups.sort((a, b) => b.priority - a.priority);
}

export function getPrincipalGroup(mol: Molecule): DetectedGroup | null {
  const groups = detectAllFunctionalGroups(mol);
  return groups.length > 0 ? groups[0] : null;
}

function findNitroGroups(mol: Molecule): FunctionalGroupInfo[] {
  const results: FunctionalGroupInfo[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i]?.element !== "N") continue;
    if (!isNitroGroup(mol, i)) continue;
    results.push({ type: "nitro", nameEs: GROUP_DISPLAY_NAMES_ES.nitro, isPrincipal: false });
  }
  return results;
}

function findEthers(mol: Molecule): FunctionalGroupInfo[] {
  const results: FunctionalGroupInfo[] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i]?.element !== "O") continue;
    const carbonNeighbors = (mol.atoms[i]?.neighbors ?? []).filter(
      (n) => mol.atoms[n]?.element === "C"
    );
    if (carbonNeighbors.length !== 2) continue;
    const isEsterOrAcidOxygen = carbonNeighbors.some((c) =>
      (mol.atoms[c]?.neighbors ?? []).some(
        (n) => mol.atoms[n]?.element === "O" && getBondOrder(mol, c, n) === 2
      )
    );
    if (isEsterOrAcidOxygen) continue;
    results.push({ type: "ether", nameEs: GROUP_DISPLAY_NAMES_ES.ether, isPrincipal: false });
  }
  return results;
}

/**
 * Lista de grupos funcionales para mostrar en la UI, reutilizando la
 * detección estructural del motor. Si solo hay un grupo, se marca como
 * principal (aunque en IUPAC estricto sea un sustituyente, como éter o
 * nitro). Si hay varios, es principal el de mayor prioridad IUPAC con
 * sufijo y el resto son sustituyentes. Un hidrocarburo sin heteroátomos
 * devuelve [].
 */
export function detectFunctionalGroupsForDisplay(mol: Molecule): FunctionalGroupInfo[] {
  const namingGroups = detectAllFunctionalGroups(mol);
  const principalType = namingGroups[0]?.type;
  const seen = new Set<DisplayGroupType>();
  const result: FunctionalGroupInfo[] = [];

  for (const group of namingGroups) {
    if (seen.has(group.type)) continue;
    seen.add(group.type);
    result.push({
      type: group.type,
      nameEs: GROUP_DISPLAY_NAMES_ES[group.type],
      isPrincipal: group.type === principalType,
      priority: group.priority,
    });
  }

  for (const group of [...findNitroGroups(mol), ...findEthers(mol)]) {
    if (seen.has(group.type)) continue;
    seen.add(group.type);
    result.push(group);
  }

  if (result.length === 1) {
    result[0].isPrincipal = true;
  }

  return result;
}

const FAMILY_BY_TYPE: Record<DisplayGroupType, string> = {
  carboxylic_acid: "Ácido carboxílico",
  ester: "Éster",
  amide: "Amida",
  nitrile: "Nitrilo",
  aldehyde: "Aldehído",
  ketone: "Cetona",
  alcohol: "Alcohol",
  thiol: "Tiol",
  amine: "Amina",
  ether: "Éter",
  nitro: "Nitroalcano",
  none: "Compuesto orgánico",
};

/**
 * Familia química ("Tipo de Compuesto") derivada del grupo funcional
 * principal efectivo de `detectFunctionalGroupsForDisplay`. Si no hay
 * grupo funcional, usa señales estructurales de los pasos del motor
 * (aromaticidad, insaturaciones) y, como último recurso, "Alcano".
 * Nunca inspecciona el nombre IUPAC.
 */
export function getCompoundType(groups: FunctionalGroupInfo[], steps: string[] = []): string {
  const principal = groups.find((g) => g.isPrincipal);
  if (principal) {
    if (principal.type === "nitro" && steps.some((s) => /anillo aromático/i.test(s))) {
      return "Aromático con nitro";
    }
    return FAMILY_BY_TYPE[principal.type] ?? "Compuesto orgánico";
  }

  const text = steps.join(" ").toLowerCase();
  if (text.includes("anillo aromático")) return "Aromático";
  if (text.includes("enlace triple")) return "Alquino";
  if (text.includes("enlace doble")) return "Alqueno";
  if (/bromo|cloro|fluoro|yodo/.test(text)) return "Haloalcano";
  return "Alcano";
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
