import type { Molecule } from "./smiles-parser";
import { isNitroGroup, getNitroOxygenNeighbors } from "./nitro-group";

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

type AttachmentKind = "nitro" | "hidroxi" | "halo" | "metil" | "other";

interface Attachment {
  ringId: number;
  startAtom: number;
  kind: AttachmentKind;
}

function classifyAttachment(
  mol: Molecule,
  startAtom: number,
  ringId: number
): AttachmentKind {
  const start = mol.atoms[startAtom];
  if (!start) return "other";
  if (isNitroGroup(mol, startAtom)) return "nitro";
  if (start.element === "O" && heavyNeighbors(mol, startAtom, [ringId]).length === 0) {
    return "hidroxi";
  }
  if (start.element === "C" && heavyNeighbors(mol, startAtom, [ringId]).length === 0) {
    return "metil";
  }
  if (["F", "Cl", "Br", "I"].includes(start.element)) return "halo";
  return "other";
}

function orderRingCycle(mol: Molecule, ring: number[]): number[] {
  const set = new Set(ring);
  if (set.size < 3) return [...ring];
  const start = ring[0];
  const startNeighbors = (mol.atoms[start]?.neighbors ?? []).filter(
    (n) => set.has(n) && n !== start
  );
  if (startNeighbors.length < 2) return [...ring];
  const cycle = [start, startNeighbors[0]];
  while (cycle.length < set.size) {
    const last = cycle[cycle.length - 1];
    const prev = cycle[cycle.length - 2];
    const next = (mol.atoms[last]?.neighbors ?? []).find(
      (n) => set.has(n) && n !== prev && n !== start
    );
    if (next === undefined) break;
    cycle.push(next);
  }
  return cycle;
}

function ringLocants(
  cycle: number[],
  anchorId: number,
  reverse: boolean
): Map<number, number> {
  const idx = cycle.indexOf(anchorId);
  if (idx === -1) return new Map();
  const loc = new Map<number, number>();
  for (let k = 0; k < cycle.length; k++) {
    const pos = reverse ? (idx - k + cycle.length) % cycle.length : (idx + k) % cycle.length;
    loc.set(cycle[pos], k + 1);
  }
  return loc;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? Infinity;
    const y = b[i] ?? Infinity;
    if (x !== y) return x < y;
  }
  return false;
}

function getMultiplier(count: number): string {
  switch (count) {
    case 2: return "di";
    case 3: return "tri";
    case 4: return "tetra";
    case 5: return "penta";
    default: return count + "-";
  }
}

function haloName(mol: Molecule, atomId: number): string {
  const el = mol.atoms[atomId]?.element ?? "";
  switch (el) {
    case "F": return "fluoro";
    case "Cl": return "cloro";
    case "Br": return "bromo";
    case "I": return "yodo";
    default: return "";
  }
}

function buildRetainedNameImpl(
  base: string,
  subs: Attachment[],
  locMap: Map<number, number>,
  mol: Molecule,
  alwaysIncludeLocant: boolean
): string {
  const mapped: Record<string, number[]> = {};
  for (const a of subs) {
    const loc = locMap.get(a.ringId);
    if (loc === undefined) continue;
    const name = a.kind === "nitro" ? "nitro" : a.kind === "halo" ? haloName(mol, a.startAtom) : a.kind === "metil" ? "metil" : "";
    if (!name) continue;
    (mapped[name] ??= []).push(loc);
  }
  const names = Object.keys(mapped).sort();
  if (names.length === 0) return base;
  if (!alwaysIncludeLocant && subs.length === 1) return names[0] + base;
  const parts: string[] = [];
  for (const name of names) {
    const locs = mapped[name].sort((x, y) => x - y);
    if (locs.length === 1) parts.push(`${locs[0]}-${name}`);
    else parts.push(`${locs.join(",")}-${getMultiplier(locs.length)}${name}`);
  }
  return parts.join("-") + base;
}

/**
 * Nombres de bencenos sustituidos:
 * - Bencenos monosustituidos con nombres retenidos (fenol, anisol, etc.).
 * - Bencenos con nitro y/o halógenos (nitrobenceno, 1,3-dinitrobenceno,
 *   clorobenceno,...).
 * - Fenoles sustituidos (p. ej. 4-nitrofenol), donde el -OH define el padre.
 * Solo devuelve un nombre cuando TODOS los sustituyentes son reconocidos.
 */
export function tryBenzeneSubstitutedName(
  mol: Molecule,
  ring: number[]
): RetainedAromaticName | null {
  const retained = tryRetainedAromaticName(mol, ring);
  if (retained) return retained;

  const ringSet = new Set(ring);
  const attachments: Attachment[] = [];
  for (const id of ring) {
    const atom = mol.atoms[id];
    if (!atom) continue;
    for (const n of atom.neighbors) {
      if (!ringSet.has(n) && mol.atoms[n]?.element !== "H") {
        attachments.push({ ringId: id, startAtom: n, kind: classifyAttachment(mol, n, id) });
      }
    }
  }

  if (attachments.some((a) => a.kind === "other")) return null;

  const covered = new Set<number>([...ringSet]);
  for (const a of attachments) {
    covered.add(a.startAtom);
    if (a.kind === "nitro") {
      for (const o of getNitroOxygenNeighbors(mol, a.startAtom)) covered.add(o);
    }
  }
  for (let i = 0; i < mol.atoms.length; i++) {
    const atom = mol.atoms[i];
    if (!atom || atom.element === "H") continue;
    if (!covered.has(i)) return null;
  }

  const cycle = orderRingCycle(mol, ring);
  if (cycle.length < ringSet.size) return null;

  const hydroxy = attachments.find((a) => a.kind === "hidroxi");
  const others = attachments.filter((a) => a.kind !== "hidroxi");

  if (hydroxy) {
    let bestLoc: number[] | null = null;
    let bestMap: Map<number, number> | null = null;
    for (const reverse of [false, true]) {
      const locMap = ringLocants(cycle, hydroxy.ringId, reverse);
      const locants = others
        .map((a) => locMap.get(a.ringId) ?? 0)
        .sort((a, b) => a - b);
      if (!bestLoc || lexLess(locants, bestLoc)) {
        bestLoc = locants;
        bestMap = locMap;
      }
    }
    if (!bestMap) return null;
    return {
      name: buildRetainedNameImpl("fenol", others, bestMap, mol, true),
      explanation:
        "Nomenclatura: El grupo hidroxilo (-OH) unido al anillo de benceno da el nombre retenido 'fenol'; los demás sustituyentes se añaden como prefijos.",
    };
  }

  if (attachments.length === 0) {
    return {
      name: "benceno",
      explanation: "Estructura: Anillo de benceno sin sustituyentes.",
    };
  }

  let bestLoc: number[] | null = null;
  let bestMap: Map<number, number> | null = null;
  const anchorCandidates = [...attachments].sort((a, b) =>
    (a.kind === "halo" ? haloName(mol, a.startAtom) : a.kind)
    .localeCompare(b.kind === "halo" ? haloName(mol, b.startAtom) : b.kind)
  );
  for (const cand of anchorCandidates) {
    for (const reverse of [false, true]) {
      const locMap = ringLocants(cycle, cand.ringId, reverse);
      const locants = attachments
        .map((a) => locMap.get(a.ringId) ?? 0)
        .sort((a, b) => a - b);
      if (!bestLoc || lexLess(locants, bestLoc)) {
        bestLoc = locants;
        bestMap = locMap;
      }
    }
  }
  if (!bestMap) return null;
  return {
    name: buildRetainedNameImpl("benceno", attachments, bestMap, mol, false),
    explanation:
      "Nomenclatura: Sustituyentes sobre el anillo de benceno nombrados como prefijos (el localizador se omite para un único sustituyente).",
  };
}
