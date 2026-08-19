import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Atom, FlaskConical, Hash, Weight, Binary, Key, Tag, Pencil } from "lucide-react";
import { Header } from "../../components/header";
import { getCompoundByCid, getCompoundImageUrl } from "@/lib/pubchem";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CompoundStructure } from "./compound-structure";

interface Props {
  params: Promise<{ cid: string }>;
}

export default async function CompoundPage({ params }: Props) {
  const { cid: cidStr } = await params;
  const cid = Number(cidStr);

  if (!Number.isInteger(cid) || cid <= 0) {
    notFound();
  }

  const compound = await getCompoundByCid(cid);
  if (!compound) notFound();

  const imageUrl = getCompoundImageUrl(cid);
  const builderUrl = compound.canonicalSMILES
    ? `/builder?smiles=${encodeURIComponent(compound.canonicalSMILES)}`
    : "/builder";

  const mainProps = [
    { icon: Hash, label: "CID", value: String(cid) },
    { icon: FlaskConical, label: "Fórmula Molecular", value: compound.molecularFormula },
    { icon: Weight, label: "Masa Molar", value: compound.molecularWeight ? `${compound.molecularWeight} g/mol` : null },
    { icon: Binary, label: "SMILES", value: compound.canonicalSMILES },
    { icon: Key, label: "InChI", value: compound.inchi },
    { icon: Tag, label: "InChIKey", value: compound.inchikey },
  ].filter((p) => p.value);

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
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {compound.name || `Compuesto CID ${cid}`}
                </h1>
                {compound.molecularFormula && (
                  <p className="mt-1 font-mono text-lg text-muted-foreground">
                    {compound.molecularFormula}
                  </p>
                )}
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
            {[
              { title: "Grupos Funcionales", description: "Identificación automática de grupos funcionales presentes en la molécula." },
              { title: "Tipo de Compuesto", description: "Clasificación del compuesto según su estructura y propiedades." },
              { title: "Nomenclatura", description: "Nombre sistemático IUPAC, común y trivial del compuesto." },
              { title: "Explicación Educativa", description: "Descripción accesible de la molécula, su uso y relevancia." },
              { title: "Reacciones Relacionadas", description: "Reacciones químicas en las que participa este compuesto." },
              { title: "Propiedades", description: "Punto de fusión, ebullición, solubilidad y otras propiedades fisicoquímicas." },
            ].map((section) => (
              <Card key={section.title} className="border-dashed opacity-60">
                <CardHeader>
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                  <p className="mt-2 text-xs font-medium text-emerald-500 dark:text-emerald-400">
                    Próximamente
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
