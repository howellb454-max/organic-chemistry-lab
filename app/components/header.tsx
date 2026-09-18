import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const navLinks = [
  { href: "/search", label: "Buscar" },
  { href: "/builder", label: "Builder" },
  { href: "/learn", label: "Aprender" },
  // TODO: reactivar cuando /compounds esté implementado
  // { href: "/compounds", label: "Compuestos" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <FlaskConical className="size-5 text-emerald-500" />
          <span>Organic Chemistry Lab</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
