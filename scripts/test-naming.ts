import { nameMolecule } from "../lib/iupac-naming/index";
import { getCompoundType } from "../lib/iupac-naming/functional-groups";

interface Case {
  smiles: string;
  expected: string | null;
  describe: string;
  principalType?: string;
  secondaryTypes?: string[];
  compoundType?: string;
}

const NEW_CASES: Case[] = [
  { smiles: "CCS", expected: "etanotiol", describe: "tiol lineal" },
  { smiles: "CC(S)C", expected: "propano-2-tiol", describe: "tiol ramificado" },
  { smiles: "OCCS", expected: "2-sulfaniletan-1-ol", describe: "alcohol gana a tiol (tiol como prefijo sulfanil)" },
  { smiles: "NCCS", expected: "2-aminoetano-1-tiol", describe: "tiol gana a amina" },
  { smiles: "CCN", expected: "etanamina", describe: "amina intacta" },
  { smiles: "C[N+](=O)[O-]", expected: "nitrometano", describe: "nitro con cargas" },
  { smiles: "[O-][N+](=O)c1ccccc1", expected: "nitrobenceno", describe: "nitro aromático" },
  { smiles: "[O-][N+](=O)c1ccc(O)cc1", expected: "4-nitrofenol", describe: "fenol sustituido con nitro" },
];

const REGRESSION_CASES: Case[] = [
  {
    smiles: "CC(C)OC",
    expected: "2-metoxipropano",
    describe: "éter ramificado",
    principalType: "ether",
    compoundType: "Éter",
  },
  { smiles: "CCOCC", expected: "etoxietano", describe: "dietil éter" },
  { smiles: "O=Cc1ccccc1", expected: "benzaldehído", describe: "nombre retenido aromático" },
  { smiles: "OC(=O)c1ccccc1", expected: "ácido benzoico", describe: "ácido aromático" },
  { smiles: "c1ccccc1", expected: "benceno", describe: "anillo sin sustituyentes" },
  { smiles: "CC(C)C(CC)CCC(CCBr)CCC", expected: "6-(2-bromoetil)-3-etil-2-metilnonano", describe: "haloalquilo con localizador interno" },
];

const CONSERVATION_CASES: Case[] = [
  { smiles: "CCSCC", expected: null, describe: "sulfuro no soportado" },
  { smiles: "C[S](=O)=O", expected: null, describe: "sulfóxido/sulfona no soportado" },
  { smiles: "C[O-][N+](=O)", expected: null, describe: "nitrito no soportado" },
];

const DISPLAY_CASES: Case[] = [
  {
    smiles: "CCS",
    expected: "etanotiol",
    describe: "tiol único se marca principal",
    principalType: "thiol",
    compoundType: "Tiol",
  },
  {
    smiles: "[O-][N+](=O)c1ccccc1",
    expected: "nitrobenceno",
    describe: "nitro único se marca principal",
    principalType: "nitro",
    compoundType: "Aromático con nitro",
  },
  {
    smiles: "OCCS",
    expected: "2-sulfaniletan-1-ol",
    describe: "dos grupos: alcohol principal, tiol secundario",
    principalType: "alcohol",
    secondaryTypes: ["thiol"],
    compoundType: "Alcohol",
  },
  {
    smiles: "C1CCCCC1",
    expected: "ciclohexano",
    describe: "ciclohexano se clasifica como Cicloalcano",
    compoundType: "Cicloalcano",
  },
  {
    smiles: "CCCCCC",
    expected: "hexano",
    describe: "alcano lineal sigue siendo Alcano",
    compoundType: "Alcano",
  },
  {
    smiles: "OC1CCCCC1",
    expected: "ciclohexan-1-ol",
    describe: "ciclohexanol: el grupo alcohol gana sobre el ciclo",
    principalType: "alcohol",
    compoundType: "Alcohol",
  },
];

let passed = 0;
let failed = 0;

function run(label: string, cases: Case[]) {
  console.log(`\n== ${label} ==`);
  for (const c of cases) {
    const result = nameMolecule(c.smiles);
    const got = result.name ?? `ERROR: ${result.error}`;
    const expected = c.expected ?? "<error>";
    const groups = result.functionalGroupsDetected ?? [];

    const problems: string[] = [];
    let ok =
      c.expected === null
        ? result.name === null && result.error !== null
        : result.name === c.expected;
    if (!ok) problems.push(`nombre esperado "${expected}"`);

    if (c.principalType !== undefined) {
      const principals = groups.filter((g) => g.isPrincipal);
      const match = principals.length === 1 && principals[0].type === c.principalType;
      if (!match) {
        ok = false;
        problems.push(`principal "${c.principalType}" (obtuvo ${JSON.stringify(principals.map((g) => g.type))})`);
      }
    }

    if (c.secondaryTypes) {
      for (const t of c.secondaryTypes) {
        const g = groups.find((x) => x.type === t);
        if (!g || g.isPrincipal) {
          ok = false;
          problems.push(`secundario "${t}"`);
        }
      }
    }

    if (c.compoundType !== undefined) {
      const type = getCompoundType(groups, result.steps, result.isCyclic);
      if (type !== c.compoundType) {
        ok = false;
        problems.push(`tipo "${c.compoundType}" (obtuvo "${type}")`);
      }
    }

    if (ok) {
      passed++;
      const extra =
        c.principalType !== undefined
          ? `  [principal: ${c.principalType}${c.compoundType ? `, tipo: ${c.compoundType}` : ""}]`
          : "";
      console.log(`  PASS  ${c.smiles.padEnd(28)} -> ${got}${extra}`);
    } else {
      failed++;
      console.log(`  FAIL  ${c.smiles.padEnd(28)} -> ${got}  (${problems.join("; ")})`);
    }
  }
}

run("Nuevos: tiol y nitro", NEW_CASES);
run("Regresión", REGRESSION_CASES);
run("Conservación (deben dar error)", CONSERVATION_CASES);
run("Grupos funcionales (display)", DISPLAY_CASES);

console.log(`\nRESULTADO: ${passed} pasan, ${failed} fallan`);
if (failed > 0) process.exitCode = 1;
