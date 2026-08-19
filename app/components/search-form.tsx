"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type FormEvent } from "react";

interface SearchFormProps {
  defaultValue?: string;
}

export function SearchForm({ defaultValue = "" }: SearchFormProps) {
  const router = useRouter();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q")?.toString().trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder="Busca una molécula... (ej. aspirin, caffeine)"
        className="h-11 flex-1 text-base"
      />
      <Button type="submit" size="lg" className="h-11 px-6">
        <Search className="mr-1 size-4" />
        Buscar
      </Button>
    </form>
  );
}
