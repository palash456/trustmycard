import type { DocPage } from "@/lib/documentation/types";

export function DocumentationContent({ page }: { page: DocPage }) {
  return (
    <article className="min-w-0 flex-1">
      <header className="mb-8 border-b border-border/60 pb-6">
        <h1 className="font-brand text-3xl font-semibold tracking-tight text-foreground">
          {page.title}
        </h1>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
          {page.description}
        </p>
      </header>

      <div className="space-y-10">
        {page.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20 space-y-4">
            <h2 className="font-brand text-xl font-semibold tracking-tight text-foreground">
              {section.title}
            </h2>
            <div className="space-y-4">{section.content}</div>
            {(section.subsections ?? []).map((subsection) => (
              <div key={subsection.id} id={subsection.id} className="scroll-mt-20 space-y-3 pl-0">
                <h3 className="text-base font-semibold text-foreground">{subsection.title}</h3>
                <div className="space-y-3">{subsection.content}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
