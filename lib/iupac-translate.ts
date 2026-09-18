const IUPAC_SUFFIX_MAP: [RegExp, string][] = [
  [/oic acid$/gi, "oico"],
  [/ous acid$/gi, "oso"],
  [/sulfonic acid$/gi, "sulfónico"],
  [/carboxylic acid$/gi, "carboxílico"],
  [/yl chloride$/gi, "ilo de cloruro"],
  [/yl bromide$/gi, "ilo de bromuro"],
  [/yl iodide$/gi, "ilo de yoduro"],
];

const IUPAC_ROOT_MAP: [RegExp, string][] = [
  [/cyclo/gi, "ciclo"],
  [/methane/gi, "metano"],
  [/ethane/gi, "etano"],
  [/propane/gi, "propano"],
  [/butane/gi, "butano"],
  [/pentane/gi, "pentano"],
  [/hexane/gi, "hexano"],
  [/heptane/gi, "heptano"],
  [/octane/gi, "octano"],
  [/nonane/gi, "nonano"],
  [/decane/gi, "decano"],
  [/undecane/gi, "undecano"],
  [/dodecane/gi, "dodecano"],

  [/oxane/gi, "oxano"],
  [/oxolane/gi, "oxolano"],
  [/pyran/gi, "pirano"],

  [/methyl/gi, "metil"],
  [/ethyl/gi, "etil"],
  [/propyl/gi, "propil"],
  [/butyl/gi, "butil"],
  [/pentyl/gi, "pentil"],
  [/hexyl/gi, "hexil"],
  [/heptyl/gi, "heptil"],
  [/octyl/gi, "octil"],
  [/nonyl/gi, "nonil"],
  [/decyl/gi, "decil"],
  [/isopropyl/gi, "isopropil"],
  [/isobutyl/gi, "isobutil"],
  [/tert-butyl/gi, "ter-butil"],
  [/sec-butyl/gi, "sec-butil"],

  [/hydroxy/gi, "hidroxi"],
  [/oxo/gi, "oxo"],
  [/amino/gi, "amino"],
  [/thiol/gi, "tiol"],
  [/sulfanyl/gi, "sulfanil"],
  [/chloro/gi, "cloro"],
  [/bromo/gi, "bromo"],
  [/fluoro/gi, "fluoro"],
  [/iodo/gi, "yodo"],
  [/nitro/gi, "nitro"],
  [/mercapto/gi, "mercapto"],
  [/sulfhydryl/gi, "sulfhidrilo"],

  [/phenyl/gi, "fenil"],
  [/benzyl/gi, "bencil"],
  [/vinyl/gi, "vinilo"],
  [/allyl/gi, "alilo"],
  [/acetoxy/gi, "acetoxi"],
  [/acetyloxy/gi, "acetoxi"],
  [/hydroxymethyl/gi, "hidroximetil"],

  [/purine/gi, "purina"],
  [/pyrimidine/gi, "pirimidina"],
  [/pyridine/gi, "piridina"],
  [/pyrrole/gi, "pirrol"],
  [/furan/gi, "furano"],
  [/thiophene/gi, "tiofeno"],
  [/imidazole/gi, "imidazol"],
  [/oxazole/gi, "oxazol"],
  [/thiazole/gi, "tiazol"],
  [/indole/gi, "indol"],
  [/quinoline/gi, "quinolina"],
  [/isoquinoline/gi, "isoquinolina"],
  [/naphthalene/gi, "naftaleno"],
  [/anthracene/gi, "antraceno"],
  [/phenanthrene/gi, "fenantreno"],
  [/benzene/gi, "benceno"],
  [/toluene/gi, "tolueno"],
  [/xylene/gi, "xileno"],

  [/xanthine/gi, "xantina"],
  [/adenine/gi, "adenina"],
  [/guanine/gi, "guanina"],
  [/cytosine/gi, "citosina"],
  [/thymine/gi, "timina"],
  [/uracil/gi, "uracilo"],

  [/alcohol$/gi, "alcohol"],
  [/aldehyde$/gi, "aldehído"],
  [/ketone$/gi, "ketona"],
  [/ether$/gi, "éter"],
  [/ester$/gi, "éster"],
  [/amine$/gi, "amina"],
  [/amide$/gi, "amida"],
  [/nitrile$/gi, "nitrilo"],
  [/carboxylic$/gi, "carboxílico"],

  [/acid$/gi, "ácido"],
];

const IUPAC_WORD_MAP: [RegExp, string][] = [
  [/^acid$/i, "ácido"],
  [/^aldehyde$/i, "aldehído"],
  [/^ketone$/i, "ketona"],
  [/^alcohol$/i, "alcohol"],
  [/^amine$/i, "amina"],
  [/^amide$/i, "amida"],
  [/^nitrile$/i, "nitrilo"],
  [/^thiol$/i, "tiol"],
  [/^ester$/i, "éster"],
  [/^ether$/i, "éter"],
];

export function translateIupacToEs(iupacName: string): string {
  if (!iupacName) return "";

  let result = iupacName;

  for (const [pattern, replacement] of IUPAC_SUFFIX_MAP) {
    result = result.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of IUPAC_ROOT_MAP) {
    result = result.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of IUPAC_WORD_MAP) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      break;
    }
  }

  if (iupacName === iupacName.toUpperCase() && iupacName.length > 3) {
    result = result.toLowerCase();
  }

  return result;
}
