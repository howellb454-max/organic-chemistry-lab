import type { Molecule } from "./smiles-parser";
import type { NumberingResult } from "./number-chain";
import type { ChainResult } from "./find-main-chain";

const PARENT_NAMES: Record<number, string> = {
  1: "met",
  2: "et",
  3: "prop",
  4: "but",
  5: "pent",
  6: "hex",
  7: "hept",
  8: "oct",
  9: "non",
  10: "dec",
  11: "undec",
  12: "dodec",
  13: "tridec",
  14: "tetradec",
  15: "pentadec",
  16: "hexadec",
  17: "heptadec",
  18: "octadec",
  19: "nonadec",
  20: "eicos",
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

export function buildName(
  mol: Molecule,
  numberingResult: NumberingResult,
  chainResult?: ChainResult,
  steps?: string[]
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

  let alcoholLocants: number[] = [];
  if (chainResult && chainResult.alcoholPositions.length > 0) {
    alcoholLocants = chainResult.alcoholPositions
      .map((id) => numbering.get(id))
      .filter((loc): loc is number => loc !== undefined)
      .sort((a, b) => a - b);
  }

  const hasAlcohol = alcoholLocants.length > 0;

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
  for (const sub of namedSubs) {
    const locantStr = sub.locants.join(",");
    const multiplier = getMultiplier(sub.locants.length);
    const hasBracket = sub.name.includes("-") && sub.locants.length === 1;
    if (hasBracket) {
      parts.push(`${locantStr}-(${sub.name})`);
    } else if (sub.locants.length === 1) {
      parts.push(`${locantStr}-${sub.name}`);
    } else {
      parts.push(`${locantStr}-${multiplier}${sub.name}`);
    }
  }

  const parentName = getParentName(carbonCount);
  const subPart = parts.length > 0 ? parts.join("-") : "";
  let fullName: string;

  if (hasAlcohol) {
    const ohLocantStr = alcoholLocants.join(",");
    const ohMultiplier = alcoholLocants.length > 1 ? getMultiplier(alcoholLocants.length) : "";
    const ohSuffix = `${ohLocantStr}-${ohMultiplier}ol`;

    if (hasDouble || hasTriple) {
      const unsatLocant = unsaturationPositions[0];
      const unsatInfix = hasTriple ? `${unsatLocant}-in` : `${unsatLocant}-en`;
      fullName = `${subPart}${parentName}-${unsatInfix}-${ohSuffix}`;
    } else if (subPart.length > 0) {
      fullName = `${subPart}${parentName}an-${ohSuffix}`;
    } else if (ohLocantStr === "1" && alcoholLocants.length === 1 && carbonCount === 2) {
      fullName = `${parentName}anol`;
    } else {
      fullName = `${parentName}an-${ohSuffix}`;
    }
  } else {
    let suffix = "ano";
    if (hasTriple) suffix = "ino";
    else if (hasDouble) suffix = "eno";

    const unsatStr = unsaturationPositions.length > 0
      ? unsaturationPositions.join(",") + "-"
      : "";

    fullName = subPart + unsatStr + parentName + suffix;
  }

  if (steps) {
    const alcoholCount = alcoholLocants.length;
    if (alcoholCount > 0) {
      const suffixName = alcoholCount === 1 ? "-ol" : alcoholCount === 2 ? "-diol" : "-triol";
      const grupoText = alcoholCount === 1 ? "grupo" : "grupos";
      steps.push(
        `Sufijo: Se usó el sufijo ${suffixName} porque la molécula contiene ${alcoholCount} ${grupoText} alcohol como grupo principal.`
      );
    } else if (hasDouble || hasTriple) {
      const tipo = hasTriple ? "triplete" : "doble";
      steps.push(
        `Sufijo: Se usó el sufijo -${hasTriple ? "ino" : "eno"} porque la molécula contiene un enlace ${tipo} como grupo funcional principal.`
      );
    } else {
      steps.push(`Sufijo: Se usó el sufijo -ano (alcano saturado).`);
    }

    steps.push(`Nombre final: ${fullName}.`);
  }

  return fullName;
}
