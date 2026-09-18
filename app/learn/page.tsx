import type { Metadata } from "next";
import Link from "next/link";
import {
  Atom,
  Binary,
  BookOpen,
  Braces,
  CircleCheck,
  Droplets,
  FlaskConical,
  Hexagon,
  ListOrdered,
  Network,
  Orbit,
  Ruler,
  Tags,
  type LucideIcon,
} from "lucide-react";
import { Header } from "../components/header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = {
  title: "Centro de Aprendizaje Químico | Organic Chemistry Lab",
  description:
    "Guía teórica de nomenclatura IUPAC: familias de compuestos, jerarquía de prioridad y cómo funciona el motor de nombres offline.",
};

interface FamilySuffix {
  group: string;
  suffix: string;
}

interface FunctionalFamily {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  suffixes: FamilySuffix[];
  exampleName: string;
  exampleSmiles: string;
}

interface PriorityGroup {
  rank: number;
  name: string;
  structure: string;
  suffix: string;
  priority: number | null;
}

interface PipelineStep {
  id: string;
  icon: LucideIcon;
  title: string;
  heading: string;
  points: string[];
}

const families: FunctionalFamily[] = [
  {
    id: "hidrocarburos",
    icon: Hexagon,
    title: "Hidrocarburos",
    description:
      "Cadenas de carbono e hidrógeno, saturadas o insaturadas, lineales o cíclicas.",
    suffixes: [
      { group: "Alcanos", suffix: "-ano" },
      { group: "Alquenos", suffix: "-eno" },
      { group: "Alquinos", suffix: "-ino" },
      { group: "Anillos", suffix: "ciclo-" },
    ],
    exampleName: "Ciclohexano",
    exampleSmiles: "C1CCCCC1",
  },
  {
    id: "oxigenados",
    icon: Droplets,
    title: "Compuestos Oxigenados",
    description:
      "Familias definidas por el oxígeno: desde alcoholes hasta ácidos carboxílicos.",
    suffixes: [
      { group: "Alcoholes", suffix: "-ol" },
      { group: "Éteres", suffix: "alcoxi-" },
      { group: "Aldehídos", suffix: "-anal" },
      { group: "Cetonas", suffix: "-ona" },
      { group: "Ácidos", suffix: "ácido …-oico" },
      { group: "Ésteres", suffix: "…-oato de alquilo" },
    ],
    exampleName: "Etanol",
    exampleSmiles: "CCO",
  },
  {
    id: "nitrogenados",
    icon: Atom,
    title: "Compuestos Nitrogenados",
    description:
      "Estructuras con nitrógeno, ordenadas según la jerarquía del grupo principal.",
    suffixes: [
      { group: "Aminas", suffix: "-amina" },
      { group: "Amidas", suffix: "-amida" },
      { group: "Nitrilos", suffix: "-nitrilo" },
    ],
    exampleName: "Etanamina",
    exampleSmiles: "CCN",
  },
  {
    id: "aromaticos",
    icon: Orbit,
    title: "Aromáticos",
    description:
      "Anillos de benceno detectados como núcleo padre; los sustituyentes se nombran como prefijos.",
    suffixes: [{ group: "Núcleo padre", suffix: "benceno" }],
    exampleName: "Benceno",
    exampleSmiles: "c1ccccc1",
  },
];

const priorityGroups: PriorityGroup[] = [
  { rank: 1, name: "Ácido carboxílico", structure: "-COOH", suffix: "ácido …-oico", priority: 8 },
  { rank: 2, name: "Éster", structure: "-COOR", suffix: "…-oato de alquilo", priority: 7 },
  { rank: 3, name: "Amida", structure: "-CONH₂", suffix: "-amida", priority: 6 },
  { rank: 4, name: "Nitrilo", structure: "-C≡N", suffix: "-nitrilo", priority: 5 },
  { rank: 5, name: "Aldehído", structure: "-CHO", suffix: "-anal", priority: 4 },
  { rank: 6, name: "Cetona", structure: "C=O", suffix: "-ona", priority: 3 },
  { rank: 7, name: "Alcohol", structure: "-OH", suffix: "-ol", priority: 2 },
  { rank: 8, name: "Amina", structure: "-NH₂", suffix: "-amina", priority: 1 },
  { rank: 9, name: "Alquenos / Alquinos", structure: "C=C / C≡C", suffix: "-eno / -ino", priority: null },
];

const pipelineSteps: PipelineStep[] = [
  {
    id: "smiles",
    icon: Braces,
    title: "SMILES",
    heading: "Parseo de la notación SMILES",
    points: [
      "El texto SMILES se convierte en un grafo molecular: átomos (elemento, aromaticidad) y enlaces (orden simple, doble o triple).",
      "Se validan los elementos soportados: C, H, O, N y halógenos (F, Cl, Br, I). Si hay otros elementos, el motor lo indica antes de continuar.",
    ],
  },
  {
    id: "grafo",
    icon: Network,
    title: "Grafo",
    heading: "Detección de grupos funcionales",
    points: [
      "Cada átomo se analiza con sus vecinos para clasificar patrones locales: C=O con -OH → ácido, C=O con -OR → éster, C≡N → nitrilo, etc.",
      "Los anillos se registran para el prefijo ciclo-, y un hexágono de carbonos alternando enlaces se marca como benceno aromático.",
    ],
  },
  {
    id: "cadena",
    icon: ListOrdered,
    title: "Cadena principal",
    heading: "Búsqueda exhaustiva de la cadena principal",
    points: [
      "Un DFS explora todas las rutas posibles entre carbonos sin repetir nodos.",
      "Cada cadena candidata se puntúa con tres criterios en orden: contiene el grupo funcional de mayor jerarquía → mayor longitud → mayor número de insaturaciones.",
      "Si existe un anillo de benceno, este se adopta como estructura padre preferente.",
    ],
  },
  {
    id: "numeracion",
    icon: Ruler,
    title: "Numeración",
    heading: "Numeración con localizadores mínimos",
    points: [
      "La cadena se numera desde el extremo que asigna el número más bajo al grupo principal.",
      "Luego se priorizan las insaturaciones y por último los sustituyentes (halógenos, alcoxi, alquilo…).",
    ],
  },
  {
    id: "nombre",
    icon: Tags,
    title: "Nombre",
    heading: "Ensamblado del nombre IUPAC",
    points: [
      "Se componen localizadores + sustituyentes en orden alfabético con prefijos di/tri/tetra, y el sufijo del grupo principal (-ol, -ona, -oato de alquilo…).",
      "El resultado incluye el nombre y un arreglo steps[] que explica cada regla aplicada: ideal para aprender mientras usas el Builder.",
    ],
  },
];

const theoryItems: { id: string; title: string; content: string[] }[] = [
  {
    id: "hidrocarburos",
    title: "Hidrocarburos: alcanos, alquenos, alquinos y ciclos",
    content: [
      "La raíz depende del número de carbonos: met- (1), et- (2), prop- (3), but- (4), pent- (5), hex- (6)… y el sufijo indica el tipo de enlace: -ano (solo simples), -eno (al menos un doble) o -ino (al menos un triple).",
      "Los dobles y triples se localizan con el número más bajo posible: pent-2-eno, but-1-ino.",
      "Cuando los carbonos forman un anillo se antepone ciclo-: ciclobutano, ciclohexeno.",
    ],
  },
  {
    id: "oxigenados",
    title: "Compuestos oxigenados: del alcohol al ácido",
    content: [
      "Alcoholes: sustituyen -e por -ol e indican la posición (propan-2-ol). Éteres: el grupo RO- se nombra como prefijo alcoxi- (metoxietano).",
      "Aldehídos: el carbono del -CHO es siempre el C1, por eso el sufijo es -anal sin localizador. Cetonas: el C=O interno usa -ona con su posición (butan-2-ona).",
      "Ácidos carboxílicos: encabezan la jerarquía; se nombran ácido …-oico. Ésteres: dos partes — el alquilo del -OR delante y la cadena del carbonilo como …-oato (etanoato de metilo).",
    ],
  },
  {
    id: "nitrogenados",
    title: "Compuestos nitrogenados: aminas, amidas y nitrilos",
    content: [
      "Aminas: sufijo -amina con localizador (propan-1-amina); son el grupo de menor jerarquía entre los nitrogenados.",
      "Amidas: el carbono del C=O unido a N es siempre C1 y usa el sufijo -amida.",
      "Nitrilos: el carbono del grupo -C≡N cuenta dentro de la cadena principal y añade -nitrilo (etanonitrilo).",
    ],
  },
  {
    id: "aromaticos",
    title: "Aromaticidad: el anillo de benceno",
    content: [
      "El motor reconoce el anillo de benceno tanto en notación aromática (c1ccccc1) como en forma Kekulé con enlaces alternados.",
      "El anillo pasa a ser el nombre padre (benceno) y los grupos restantes se expresan como prefijos sobre él.",
    ],
  },
  {
    id: "cobertura",
    title: "Cobertura del motor y salida educativa",
    content: [
      "Elementos soportados: C, H, O, N y halógenos F, Cl, Br, I. Todo el análisis es local: no requiere conexión ni servicios externos.",
      "Además del nombre, cada análisis devuelve pasos numerados (prioridad aplicada, cadena elegida, criterio de numeración) para reforzar el aprendizaje.",
    ],
  },
];

function BuilderLink({ smiles, label }: { smiles: string; label: string }) {
  return (
    <Link
      href={`/builder?smiles=${encodeURIComponent(smiles)}`}
      className={buttonVariants({ variant: "default", size: "sm" })}
    >
      <FlaskConical data-icon="inline-start" className="size-3.5" />
      {label}
    </Link>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <Icon className="size-3" />
        {eyebrow}
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

export default function LearnPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,--theme(--color-emerald-500/12%),transparent_60%)]"
          />
          <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <BookOpen className="size-3" />
              Guía teórica · Manual del motor IUPAC
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Centro de Aprendizaje{" "}
              <span className="text-emerald-500">Químico</span>
            </h1>

            <p className="mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Domina la nomenclatura IUPAC: familias funcionales, jerarquía de
              prioridades y el algoritmo que convierte tus dibujos en nombres
              sistemáticos.
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              {[
                { icon: FlaskConical, label: "8 grupos principales jerarquizados" },
                { icon: CircleCheck, label: "38 tests superados" },
                { icon: Binary, label: "100% offline" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1"
                >
                  <Icon className="size-3 text-emerald-500" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Familias */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            icon={Hexagon}
            eyebrow="Familias funcionales"
            title="Grupos funcionales soportados"
            description="Cada familia tiene su propio sufijo IUPAC. Abre cualquier ejemplo en el Builder y analízalo para ver el razonamiento completo."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {families.map((family) => (
              <Card key={family.id} className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <family.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle>{family.title}</CardTitle>
                  <CardDescription>{family.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="flex flex-wrap gap-1.5">
                    {family.suffixes.map((s) => (
                      <li
                        key={s.suffix}
                        title={s.group}
                        className="rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-300"
                      >
                        {s.suffix}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto space-y-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      Ejemplo:{" "}
                      <span className="font-medium text-foreground">
                        {family.exampleName}
                      </span>{" "}
                      <span className="font-mono text-[11px]">
                        ({family.exampleSmiles})
                      </span>
                    </p>
                    <BuilderLink
                      smiles={family.exampleSmiles}
                      label="Probar en Builder"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Jerarquía de prioridad */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading
              icon={ListOrdered}
              eyebrow="Jerarquía IUPAC"
              title="Orden de prioridad del motor"
              description="Cuando una molécula tiene varios grupos funcionales, solo el de mayor jerarquía define el sufijo; el resto se nombran como prefijos. Este es el orden exacto que aplica el algoritmo."
            />

            <ol className="space-y-2">
              {priorityGroups.map((group) => (
                <li
                  key={group.rank}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 sm:gap-4 sm:p-4"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      group.priority !== null
                        ? "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/40 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground ring-1 ring-border"
                    }`}
                  >
                    {group.rank}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium">{group.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {group.structure}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          group.priority !== null
                            ? "h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                            : "h-full rounded-full bg-muted-foreground/30"
                        }
                        style={{
                          width:
                            group.priority !== null
                              ? `${(group.priority / 8) * 100}%`
                              : "12%",
                        }}
                      />
                    </div>
                  </div>

                  <code className="shrink-0 rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-300">
                    {group.suffix}
                  </code>
                </li>
              ))}
            </ol>

            <p className="mt-4 text-xs text-muted-foreground">
              Los alquenos y alquinos no definen sufijo principal, pero sí
              desempatan la elección de cadena: a igual prioridad y longitud,
              gana la cadena con más insaturaciones.
            </p>
          </div>
        </section>

        {/* Algoritmo */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            icon={Network}
            eyebrow="Bajo el capó"
            title="¿Cómo nombra la app tus moléculas?"
            description="El motor recorre cinco etapas determinísticas, de la notación SMILES al nombre final. Todo ocurre en tu navegador."
          />

          <Tabs defaultValue={pipelineSteps[0]?.id}>
            <TabsList className="h-auto w-full flex-wrap justify-start sm:flex-nowrap sm:justify-center">
              {pipelineSteps.map((step, i) => (
                <TabsTrigger key={step.id} value={step.id}>
                  <span className="mr-1 hidden font-mono text-[10px] text-emerald-600 sm:inline dark:text-emerald-400">
                    {i + 1}.
                  </span>
                  {step.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {pipelineSteps.map((step) => (
              <TabsContent key={step.id} value={step.id} className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                        <step.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <CardTitle className="text-lg">{step.heading}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5">
                      {step.points.map((point) => (
                        <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* Teoría */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading
              icon={BookOpen}
              eyebrow="Teoría esencial"
              title="Reglas de nomenclatura por familia"
              description="Lo mínimo que necesitas saber de cada familia, resumido y verificado contra el motor."
            />

            <Accordion>
              {theoryItems.map((item) => (
                <AccordionItem key={item.id} value={item.id}>
                  <AccordionTrigger className="text-sm sm:text-base">
                    {item.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                      {item.content.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            <div className="mt-8 flex flex-col items-start gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                ¿Listo para practicar? Dibuja una molécula y revisa los pasos
                que sigue el motor.
              </p>
              <BuilderLink smiles="CC(=O)OCC" label="Abrir el Builder" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Organic Chemistry Lab &mdash; Laboratorio Virtual de Química Orgánica
      </footer>
    </div>
  );
}
