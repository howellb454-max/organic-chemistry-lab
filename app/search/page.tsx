import { Suspense } from "react";
import { SearchResults } from "./search-results";
import { Header } from "../components/header";
import { SearchForm } from "../components/search-form";

export default function SearchPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pt-10 pb-8 sm:px-6">
          <h1 className="mb-6 text-2xl font-bold tracking-tight">
            Buscar Compuesto
          </h1>
          <Suspense>
            <SearchForm />
          </Suspense>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <Suspense
            fallback={
              <div className="flex flex-col items-center justify-center py-20">
                <div className="mb-4 size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                <p className="text-sm text-muted-foreground">Cargando...</p>
              </div>
            }
          >
            <SearchResults />
          </Suspense>
        </section>
      </main>
    </div>
  );
}
