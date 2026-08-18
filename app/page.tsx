import { Search, FlaskConical, Puzzle, GraduationCap, Library } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Header } from "./components/header";

const features = [
  {
    icon: Search,
    title: "Buscar Compuestos",
    description: "Encuentra moléculas por nombre, fórmula o estructura usando la base de datos de PubChem.",
  },
  {
    icon: Puzzle,
    title: "Constructor de Moléculas",
    description: "Dibuja y ensambla estructuras químicas orgánicas con una interfaz visual interactiva.",
  },
  {
    icon: GraduationCap,
    title: "Modo Educativo",
    description: "Aprende sobre reacciones, mecanismos y propiedades con contenido paso a paso.",
  },
  {
    icon: Library,
    title: "Biblioteca de Compuestos",
    description: "Guarda, organiza y accede a tu colección personal de moléculas favoritas.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28 sm:pb-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <FlaskConical className="size-3" />
            Laboratorio Virtual
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Explora la Química Orgánica
          </h1>

          <p className="mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Busca, visualiza y construye moléculas orgánicas. Herramientas interactivas
            para estudiantes y profesionales de la química.
          </p>

          <form className="flex w-full max-w-md gap-2" action="/search" method="GET">
            <Input
              name="q"
              placeholder="Busca una molécula... (ej. cafeína, aspirina)"
              className="h-11 flex-1 text-base"
            />
            <Button type="submit" size="lg" className="h-11 px-6">
              <Search className="mr-1 size-4" />
              Buscar
            </Button>
          </form>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title} className="transition-colors hover:bg-accent/50">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                    <feature.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Organic Chemistry Lab &mdash; Laboratorio Virtual de Química Orgánica
      </footer>
    </div>
  );
}
