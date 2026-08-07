import { Reveal } from "./Reveal";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  list?: string[];
};

type LegalPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalPageLayout({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="bg-[#F9FAFB]">
      <section className="relative overflow-hidden border-b border-[#ECECEF] bg-white pb-12 pt-10 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
        <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="inline-flex rounded-full border border-[#ECECEF] bg-white px-4 py-2 text-xs font-semibold text-[#0400FF] sm:text-sm">
              {eyebrow}
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-[#131520] sm:text-4xl lg:text-5xl">
              {title}
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#6A6D81] sm:text-lg">
              {description}
            </p>
            <p className="mt-3 text-xs text-[#9CA3AF] sm:text-sm">Last updated: {lastUpdated}</p>
          </Reveal>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
          {sections.map((section, index) => (
            <Reveal key={section.id} delay={index * 40}>
              <article
                id={section.id}
                className="card-surface rounded-3xl p-6 sm:rounded-[2rem] sm:p-8"
              >
                <h2 className="text-xl font-bold tracking-tight text-[#131520] sm:text-2xl">
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="mt-4 text-sm leading-relaxed text-[#6A6D81] sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.list ? (
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#6A6D81] sm:text-base">
                    {section.list.map((item) => (
                      <li key={item.slice(0, 40)}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
