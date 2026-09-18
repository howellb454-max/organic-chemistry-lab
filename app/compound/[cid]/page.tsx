import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FlaskConical, Hash, Weight, Binary, Key, Tag, Pencil, Globe, ListOrdered, CheckCircle2, AlertTriangle, Atom, BookOpen, Beaker, Droplets, FlaskRound } from "lucide-react";
import { Header } from "../../components/header";
import { getCompoundByCid, getCompoundImageUrl, PubChemUnavailableError } from "@/lib/pubchem";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompoundStructure } from "./compound-structure";
import { translateIupacToEs } from "@/lib/iupac-translate";
import { getCommonNameEs } from "@/lib/common-names-es";
import { nameMolecule } from "@/lib/iupac-naming";
import { getCompoundType } from "@/lib/iupac-naming/functional-groups";

interface Props {
  params: Promise<{ cid: string }>;
}

const FAMILY_DESCRIPTIONS: Record<string, string> = {
  "Alcohol": "Pertenece a la familia de los alcoholes, caracterizados por el grupo hidroxilo (-OH).",
  "Éter": "Es un éter, con un átomo de oxígeno unido a dos cadenas de carbono (R-O-R').",
  "Tiol": "Es un tiol, caracterizado por el grupo sulfhidrilo (-SH).",
  "Aldehído": "Es un aldehído, con un grupo carbonilo terminal (-CHO).",
  "Cetona": "Es una cetona, con un grupo carbonilo entre dos carbonos (C=O).",
  "Ácido carboxílico": "Es un ácido carboxílico, con el grupo carboxilo (-COOH).",
  "Éster": "Es un éster, con el grupo funcional (-COO-).",
  "Amida": "Es una amida, con el grupo funcional (-CONH₂).",
  "Nitrilo": "Es un nitrilo, con un grupo ciano (-C≡N).",
  "Amina": "Es una amina, con un nitrógeno unido a la cadena de carbono (-NH₂).",
  "Nitroalcano": "Contiene un grupo nitro (-NO₂) unido a una cadena de carbono.",
  "Aromático con nitro": "Es un compuesto aromático que lleva un grupo nitro (-NO₂) sobre el anillo de benceno.",
  "Aromático": "Es un compuesto aromático con un anillo de benceno.",
  "Alqueno": "Es un alqueno, lo que significa que contiene al menos un enlace doble carbono-carbono.",
  "Alquino": "Es un alquino, conteniendo un enlace triple carbono-carbono.",
  "Haloalcano": "Contiene halógenos unidos a la cadena de carbono.",
  "Alcano": "Es un alcano saturado, sin enlaces múltiples.",
};

function buildEducationalSummary(compoundType: string, steps: string[]): string {
  const allText = steps.join(" ").toLowerCase();
  const parts: string[] = [];

  const chainMatch = allText.match(/cadena de (\d+) carbono/);
  if (chainMatch) {
    const n = parseInt(chainMatch[1], 10);
    parts.push(`La molécula tiene una cadena principal de ${n} carbono${n > 1 ? "s" : ""}.`);
  }

  const familyDescription = FAMILY_DESCRIPTIONS[compoundType];
  if (familyDescription) parts.push(familyDescription);

  if (/\bmetil\b/.test(allText)) parts.push("Tiene sustituyentes tipo metilo ramificados.");
  if (/\betil\b/.test(allText)) parts.push("Presenta cadenas laterales de etilo.");

  return parts.length > 0 ? parts.join(" ") : "Estructura orgánica sin grupos funcionales destacados.";
}

export default async function CompoundPage({ params }: Props) {
  const { cid: cidStr } = await params;
  const cid = Number(cidStr);

  if (!Number.isInteger(cid) || cid <= 0) {
    notFound();
  }

  let compound = null;
  let pubChemUnavailable = false;
  try {
    compound = await getCompoundByCid(cid);
  } catch (err) {
    if (err instanceof PubChemUnavailableError) {
      pubChemUnavailable = true;
    } else {
      throw err;
    }
  }

  if (!compound && !pubChemUnavailable) {
    notFound();
  }

  const imageUrl = getCompoundImageUrl(cid);
  const builderUrl = compound?.canonicalSMILES
    ? `/builder?smiles=${encodeURIComponent(compound.canonicalSMILES)}`
    : "/builder";

  const naming = compound?.canonicalSMILES
    ? nameMolecule(compound.canonicalSMILES)
    : null;

  const functionalGroups = naming?.functionalGroupsDetected ?? [];
  const compoundType = getCompoundType(functionalGroups, naming?.steps ?? []);
  const educationalSummary = buildEducationalSummary(compoundType, naming?.steps ?? []);

  const mainProps = compound
    ? [
        { icon: Hash, label: "CID", value: String(cid) },
        { icon: FlaskConical, label: "Fórmula Molecular", value: compound.molecularFormula },
        { icon: Weight, label: "Masa Molar", value: compound.molecularWeight ? `${compound.molecularWeight} g/mol` : null },
        { icon: Binary, label: "SMILES", value: compound.canonicalSMILES },
        { icon: Key, label: "InChI", value: compound.inchi },
        { icon: Tag, label: "InChIKey", value: compound.inchikey },
      ].filter((p) => p.value)
    : [];

  if (pubChemUnavailable) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 sm:px-6">
            <Link
              href="/search"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="mr-1 size-4" />
              Volver a búsqueda
            </Link>

            <Card className="mt-8 border-amber-500/30 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 p-6">
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium">PubChem no disponible temporalmente</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    El servicio PubChem está saturado o no responde (límite de peticiones).
                    Intenta de nuevo en unos segundos.
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">CID: {cid}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  if (!compound) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 pt-6 pb-20 sm:px-6">
          <div className="flex items-center justify-between">
            <Link
              href="/search"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft className="mr-1 size-4" />
              Volver a búsqueda
            </Link>

            <Link
              href={builderUrl}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil className="mr-1 size-3.5" />
              Editar en Builder
            </Link>
          </div>

          <div className="mt-6 flex flex-col items-start gap-8 lg:flex-row">
            <div className="flex w-full flex-col items-center gap-4 lg:w-72">
              <CompoundStructure
                imageUrl={imageUrl}
                name={compound.name || String(cid)}
              />
              <span className="text-xs text-muted-foreground">Estructura 2D</span>
            </div>

            <div className="flex-1 space-y-6">
              <div>
                {(() => {
                  const commonEs = getCommonNameEs(compound.name, compound.synonyms);
                  const iupacEs = compound.name
                    ? translateIupacToEs(compound.name)
                    : null;
                  const showIupacEs =
                    iupacEs && iupacEs.toLowerCase() !== (compound.name || "").toLowerCase();
                  const showEnglish =
                    commonEs &&
                    compound.name &&
                    commonEs.toLowerCase() !== compound.name.toLowerCase();

                  return (
                    <>
                      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {commonEs || compound.name || `Compuesto CID ${cid}`}
                      </h1>
                      {showIupacEs && (
                        <p className="mt-1 text-base text-muted-foreground">
                          <Globe className="mr-1 inline size-3.5" />
                          {iupacEs}
                        </p>
                      )}
                      {showEnglish && (
                        <p className="mt-0.5 text-sm text-muted-foreground/70">
                          ({compound.name})
                        </p>
                      )}
                      {compound.molecularFormula && (
                        <p className="mt-1 font-mono text-lg text-muted-foreground">
                          {compound.molecularFormula}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              <dl className="grid gap-3 sm:grid-cols-2">
                {mainProps.map((prop) => (
                  <div key={prop.label} className="rounded-lg bg-muted/50 p-3">
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <prop.icon className="size-3" />
                      {prop.label}
                    </dt>
                    <dd className="font-mono text-sm break-all">{prop.value}</dd>
                  </div>
                ))}
              </dl>

              {compound.synonyms.length > 0 && (
                <div>
                  <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sinónimos</h2>
                  <div className="flex flex-wrap gap-2">
                    {compound.synonyms.map((syn) => (
                      <span
                        key={syn}
                        className="inline-block rounded-md border bg-muted/50 px-2.5 py-1 font-mono text-xs"
                      >
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <ListOrdered className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-sm">Nomenclatura IUPAC</CardTitle>
              </CardHeader>
              <CardContent>
                {naming?.name ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                      <span className="font-semibold">{naming.name}</span>
                    </div>
                    {naming.steps.length > 0 && (
                      <ol className="space-y-2">
                        {naming.steps.map((step, i) => (
                          <li key={i} className="flex gap-2.5">
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-500">
                              {i + 1}
                            </span>
                            <p className="text-xs leading-relaxed text-muted-foreground pt-0.5">
                              {step}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      {naming?.error || "No se pudo generar el nombre IUPAC para esta estructura."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Atom className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-sm">Grupos Funcionales</CardTitle>
              </CardHeader>
              <CardContent>
                {functionalGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {functionalGroups.map((g) => (
                      <Badge
                        key={g.type}
                        variant={g.isPrincipal ? "default" : "secondary"}
                        className={g.isPrincipal ? "bg-emerald-500 text-white" : undefined}
                      >
                        {g.nameEs}
                        {g.isPrincipal && (
                          <span className="text-[10px] font-normal opacity-80">principal</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Hidrocarburo (sin grupos funcionales prioritarios)
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Beaker className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-sm">Tipo de Compuesto</CardTitle>
              </CardHeader>
              <CardContent>
                {naming?.name ? (
                  <div className="rounded-lg bg-emerald-500/5 px-3 py-2.5">
                    <span className="text-sm font-semibold">{compoundType}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No disponible sin estructura molecular.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <BookOpen className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-sm">Explicación Educativa</CardTitle>
              </CardHeader>
              <CardContent>
                {naming?.name ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {educationalSummary}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No disponible sin estructura molecular.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-xl border-dashed opacity-60">
              <CardHeader>
                <CardTitle className="text-sm">Reacciones Relacionadas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  PubChem no dispone de un endpoint REST simple para listar reacciones
                  asociadas a un compuesto individual. Los datos de reactividad se
                  encuentran en BioAssay/Patents, que requieren análisis adicional.
                </p>
                <p className="mt-2 text-xs font-medium text-emerald-500 dark:text-emerald-400">Próximamente</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                  <FlaskRound className="size-4 text-emerald-500" />
                </div>
                <CardTitle className="text-sm">Propiedades Fisicoquímicas</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const computed: Array<{ label: string; value: string | number | null; unit?: string }> = [
                    { label: "LogP (XLogP3)", value: compound.xlogp },
                    { label: "TPSA", value: compound.tpsa, unit: "Å²" },
                    { label: "Donadores de H", value: compound.hbondDonors },
                    { label: "Aceptores de H", value: compound.hbondAcceptors },
                    { label: "Complejidad", value: compound.complexity },
                  ].filter((p) => p.value !== null && p.value !== undefined);

                  const hasExperimental = compound.experimental.length > 0;

                  if (computed.length === 0 && !hasExperimental) {
                    return (
                      <p className="text-xs text-muted-foreground">
                        No hay datos fisicoquímicos disponibles en PubChem para este compuesto.
                      </p>
                    );
                  }

                  return (
                    <>
                      {hasExperimental && (
                        <div className="space-y-1.5 mb-4">
                          {compound.experimental.map((prop) => (
                            <div
                              key={prop.heading}
                              className="flex items-center justify-between rounded-lg bg-emerald-500/5 px-3 py-2"
                            >
                              <span className="text-xs font-medium">{prop.heading}</span>
                              <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                {prop.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {computed.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {computed.map((prop) => (
                            <div key={prop.label} className="rounded-lg bg-emerald-500/5 px-2.5 py-2 text-center">
                              <p className="text-[10px] font-medium text-muted-foreground">{prop.label}</p>
                              <p className="font-mono text-xs font-semibold">
                                {prop.value}{prop.unit ? ` ${prop.unit}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
