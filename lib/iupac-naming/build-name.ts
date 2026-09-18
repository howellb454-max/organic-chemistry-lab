import type { Molecule } from "./smiles-parser";
import type { NumberingResult } from "./number-chain";
import type { ChainResult } from "./find-main-chain";
import type { FunctionalGroupType } from "./functional-groups";
import { getEsterAlkylName } from "./functional-groups";

const PARENT_NAMES: Record<number, string> = {
  1: "met", 2: "et", 3: "prop", 4: "but", 5: "pent",
  6: "hex", 7: "hept", 8: "oct", 9: "non", 10: "dec",
  11: "undec", 12: "dodec", 13: "tridec", 14: "tetradec",
  15: "pentadec", 16: "hexadec", 17: "heptadec", 18: "octadec",
  19: "nonadec", 20: "eicos",
};

function getParentName(carbonCount: number): string {
  return PARENT_NAMES[carbonCount] ?? carbonCount + "-carbon";
}

function getMultiplier(count: number): string {
  switch (count) {
    case 2: return "di";
    case 3: return "tri";
    case 4: return "tetra";
    case 5: return "penta";
    case 6: return "hexa";
    case 7: return "hepta";
    case 8: return "octa";
    case 9: return "nona";
    case 10: return "deca";
    default: return count + "-";
  }
}

function concatSegments(...segments: string[]): string {
  return segments
    .filter((s) => s.length > 0)
    .join("")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function formatSuffix(locants: number[], base: string): string {
  return `${locants.join(",")}-${base}`;
}

function alphabetizeSubstituentName(name: string): string {
  const prefixes = ["di", "tri", "tetra", "penta", "hexa", "hepta", "octa", "nona", "deca"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix) && name.length > prefix.length) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

interface NamedSubstituent {
  name: string;
  locants: number[];
  baseName: string;
}

const SUFFIX_MAP: Record<FunctionalGroupType, string> = {
  carboxylic_acid: "oico",
  ester: "oato",
  amide: "amida",
  nitrile: "nitrilo",
  aldehyde: "al",
  ketone: "ona",
  alcohol: "ol",
  thiol: "tiol",
  amine: "amina",
  none: "",
};

export function buildName(
  mol: Molecule,
  numberingResult: NumberingResult,
  chainResult?: ChainResult,
  steps?: string[],
  isCyclic?: boolean,
  aromaticParent?: string | null
): string {
  const { chain, numbering, substituents } = numberingResult;

  if (chain.length === 0) return "";

  let carbonCount = 0;
  for (const id of chain) {
    if (mol.atoms[id]?.element === "C") carbonCount++;
  }

  const getBondOrder = (a: number, b: number): 1 | 2 | 3 => {
    for (const bond of mol.bonds) {
      if ((bond.from === a && bond.to === b) || (bond.from === b && bond.to === a)) {
        return bond.order;
      }
    }
    return 1;
  };

  const unsaturationPositions: number[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const order = getBondOrder(chain[i], chain[i + 1]);
    if (order === 2 || order === 3) {
      const posA = numbering.get(chain[i]) ?? i + 1;
      const posB = numbering.get(chain[i + 1]) ?? i + 2;
      unsaturationPositions.push(Math.min(posA, posB));
    }
  }

  const hasDouble = chain.some((id, i) => i < chain.length - 1 && getBondOrder(id, chain[i + 1]) === 2);
  const hasTriple = chain.some((id, i) => i < chain.length - 1 && getBondOrder(id, chain[i + 1]) === 3);

  const principalGroup = chainResult?.principalGroup;
  const pgType: FunctionalGroupType = principalGroup?.type ?? "none";

  let alcoholLocants: number[] = [];
  if (chainResult && chainResult.alcoholPositions.length > 0) {
    alcoholLocants = chainResult.alcoholPositions
      .map((id) => numbering.get(id))
      .filter((loc): loc is number => loc !== undefined)
      .sort((a, b) => a - b);
  }

  let thiolLocants: number[] = [];
  if (chainResult && chainResult.thiolPositions.length > 0) {
    thiolLocants = chainResult.thiolPositions
      .map((id) => numbering.get(id))
      .filter((loc): loc is number => loc !== undefined)
      .sort((a, b) => a - b);
  }

  const hasAlcohol = alcoholLocants.length > 0;
  const hasThiol = thiolLocants.length > 0;

  const grouped: Record<string, number[]> = {};
  for (const sub of substituents) {
    const locant = sub.chainPositions[0];
    const key = sub.name;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(locant);
  }

  const namedSubs: NamedSubstituent[] = [];
  for (const [name, locants] of Object.entries(grouped)) {
    namedSubs.push({ name, locants: locants.sort((a, b) => a - b), baseName: name });
  }

  namedSubs.sort((a, b) => {
    const aBase = alphabetizeSubstituentName(a.baseName);
    const bBase = alphabetizeSubstituentName(b.baseName);
    return aBase.localeCompare(bBase);
  });

  const parts: string[] = [];
  const allSingleOccurrences = namedSubs.every((s) => s.locants.length === 1);
  const omitSubLocants =
    carbonCount === 1 ||
    (carbonCount === 2 &&
      namedSubs.length === 1 &&
      allSingleOccurrences &&
      !hasAlcohol &&
      !hasThiol);
  for (const sub of namedSubs) {
    const locantStr = sub.locants.join(",");
    const displayName =
      sub.locants.length === 1 ? sub.name : `${getMultiplier(sub.locants.length)}${sub.name}`;
    if (omitSubLocants) {
      parts.push(displayName);
    } else {
      parts.push(`${locantStr}-${displayName}`);
    }
  }

  const parentName = getParentName(carbonCount);
  const cyclicPrefix = isCyclic ? "ciclo" : "";
  const subPrefix = parts.join("-");
  const simpleMolecule = carbonCount <= 2;
  let fullName: string;

  if (aromaticParent) {
    let core: string;
    if (namedSubs.length === 0) {
      core = aromaticParent;
    } else if (namedSubs.length === 1) {
      core = `${namedSubs[0].name}${aromaticParent}`;
    } else {
      core = `${subPrefix}-${aromaticParent}`;
    }
    fullName = core;
    if (steps) {
      steps.push("Núcleo: El padre es 'benceno' porque se detectó un anillo aromático.");
      steps.push(`Nombre final: ${fullName}.`);
    }
    return fullName;
  }

  const collectLocantsOnChain = (
    predicate: (atomId: number) => boolean
  ): number[] => {
    const locants = new Set<number>();
    for (const id of chain) {
      const loc = numbering.get(id);
      if (loc !== undefined && predicate(id)) locants.add(loc);
    }
    return [...locants].sort((a, b) => a - b);
  };

  if (pgType === "carboxylic_acid") {
    fullName = carbonCount === 1
      ? "ácido fórmico"
      : concatSegments("ácido ", subPrefix, cyclicPrefix, parentName, "anoico");
  } else if (pgType === "aldehyde") {
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, "anal");
  } else if (pgType === "ketone") {
    const ketLocants = collectLocantsOnChain((id) =>
      (mol.atoms[id]?.neighbors ?? []).some(
        (n) => mol.atoms[n]?.element === "O" && getBondOrder(id, n) === 2
      )
    );
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, `an-${formatSuffix(ketLocants, "ona")}`);
  } else if (pgType === "amine") {
    const amineLocants = collectLocantsOnChain((id) =>
      (mol.atoms[id]?.neighbors ?? []).some((n) => {
        const nAtom = mol.atoms[n];
        return (
          nAtom?.element === "N" &&
          nAtom.neighbors.filter((x) => mol.atoms[x]?.element === "C").length === 1
        );
      })
    );
    const tail = simpleMolecule ? `an${SUFFIX_MAP.amine}` : `an-${formatSuffix(amineLocants, SUFFIX_MAP.amine)}`;
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, tail);
  } else if (pgType === "amide") {
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, "anamida");
  } else if (pgType === "nitrile") {
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, "anonitrilo");
  } else if (pgType === "ester") {
    const alkyl = principalGroup ? getEsterAlkylName(mol, principalGroup.carbonId) : "metilo";
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, `anoato de ${alkyl}`);
  } else if (hasAlcohol) {
    const ohBase = alcoholLocants.length > 1 ? `${getMultiplier(alcoholLocants.length)}ol` : "ol";
    let tail: string;
    if (hasDouble || hasTriple) {
      const unsatLocant = unsaturationPositions[0];
      const unsatInfix = hasTriple ? `${unsatLocant}-in` : `${unsatLocant}-en`;
      tail = `-${unsatInfix}-${formatSuffix(alcoholLocants, ohBase)}`;
    } else if (alcoholLocants.length > 1) {
      tail = `ano-${formatSuffix(alcoholLocants, ohBase)}`;
    } else if (simpleMolecule && subPrefix === "") {
      tail = `an${ohBase}`;
    } else {
      tail = `an-${formatSuffix(alcoholLocants, ohBase)}`;
    }
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, tail);
  } else if (hasThiol) {
    const thBase = thiolLocants.length > 1 ? `${getMultiplier(thiolLocants.length)}tiol` : "tiol";
    let tail: string;
    if (hasDouble || hasTriple) {
      const unsatLocant = unsaturationPositions[0];
      const unsatInfix = hasTriple ? `${unsatLocant}-in` : `${unsatLocant}-en`;
      tail = `-${unsatInfix}-${formatSuffix(thiolLocants, thBase)}`;
    } else if (thiolLocants.length > 1) {
      tail = `ano-${formatSuffix(thiolLocants, thBase)}`;
    } else if (simpleMolecule && subPrefix === "") {
      tail = `ano${thBase}`;
    } else {
      tail = `ano-${formatSuffix(thiolLocants, thBase)}`;
    }
    fullName = concatSegments(subPrefix, cyclicPrefix, parentName, tail);
  } else {
    let suffix = "ano";
    if (hasTriple) suffix = "ino";
    else if (hasDouble) suffix = "eno";

    const omitUnsatLocant = !isCyclic && carbonCount <= 3;
    const unsatStr =
      !omitUnsatLocant && unsaturationPositions.length > 0
        ? unsaturationPositions.join(",") + "-"
        : "";

    fullName = concatSegments(subPrefix, cyclicPrefix, unsatStr, parentName, suffix);
  }

  if (steps) {
    if (pgType !== "none" && pgType !== "alcohol" && pgType !== "thiol") {
      steps.push(`Sufijo: Se usó el sufijo del grupo funcional principal (${pgType}).`);
    } else if (hasAlcohol) {
      const alcoholCount = alcoholLocants.length;
      const suffixName = alcoholCount === 1 ? "-ol" : alcoholCount === 2 ? "-diol" : "-triol";
      const grupoText = alcoholCount === 1 ? "grupo" : "grupos";
      steps.push(
        `Sufijo: Se usó el sufijo ${suffixName} porque la molécula contiene ${alcoholCount} ${grupoText} alcohol como grupo principal.`
      );
    } else if (hasThiol) {
      const thiolCount = thiolLocants.length;
      const suffixName = thiolCount === 1 ? "-tiol" : thiolCount === 2 ? "-ditiol" : "-tritiol";
      const grupoText = thiolCount === 1 ? "grupo" : "grupos";
      steps.push(
        `Sufijo: Se usó el sufijo ${suffixName} porque la molécula contiene ${thiolCount} ${grupoText} tiol como grupo principal.`
      );
    } else if (hasDouble || hasTriple) {
      const tipo = hasTriple ? "triple" : "doble";
      steps.push(
        `Sufijo: Se usó el sufijo -${hasTriple ? "ino" : "eno"} porque la molécula contiene un enlace ${tipo}.`
      );
    } else {
      steps.push(`Sufijo: Se usó el sufijo -ano (alcano saturado).`);
    }

    steps.push(`Nombre final: ${fullName}.`);
  }

  return fullName;
}
