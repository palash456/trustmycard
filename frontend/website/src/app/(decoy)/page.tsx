import Image from "next/image";

import { DecoyHero } from "./DecoyHero";
import { DecoyLogo } from "./DecoyLogo";
import { DECOY_MEDIA } from "./media";

const SERVICE_ROUTES = [
  {
    name: "Visitor",
    desc: "Short-stay tourism and business trips. Checklist reviews, appointment scheduling guidance, and embassy fee breakdowns.",
    perks: [
      "Country-specific document lists",
      "Interview preparation notes",
      "Rejection appeal overview",
    ],
    icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064",
  },
  {
    name: "Student",
    desc: "Semester and degree programs abroad. I-20 / CAS alignment, financial proof templates, and biometrics walkthroughs.",
    perks: [
      "University letter review",
      "Parent sponsor guidance",
      "Pre-departure briefing",
    ],
    highlight: true,
    icon: "M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z",
  },
  {
    name: "Family reunion",
    desc: "Spousal, dependent, and long-stay routes. Timeline planning for split households across India and overseas.",
    perks: [
      "Dual-country document sync",
      "Translation vendor referrals",
      "Case-status tracking tips",
    ],
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  },
];

const FEATURES = [
  {
    title: "Requirement snapshots",
    desc: "Plain-language summaries of what each embassy asks for — updated when policy notices change.",
  },
  {
    title: "Appointment routing",
    desc: "Which consulate to book, typical wait weeks, and seasonal backlog patterns we've observed.",
  },
  {
    title: "Document hygiene",
    desc: "Formatting checks for bank statements, employment letters, and invitation sponsors.",
  },
  {
    title: "Identity verification prep",
    desc: "What to bring to biometrics, common photo-spec failures, and name-mismatch fixes.",
  },
];

const FAQ = [
  {
    q: "Is Travixa a government agency?",
    a: "No. We are a private immigration documentation advisory. Permits are issued only by embassies, consulates, and border authorities.",
  },
  {
    q: "Which regions do you cover?",
    a: "Our published guides focus on Schengen, UK, US, Canada, UAE, and Australia routes for applicants based in India and Southeast Asia.",
  },
  {
    q: "Do you submit applications on my behalf?",
    a: "We provide informational checklists and review services. Final submission is completed by you or your authorized representative at the official portal.",
  },
  {
    q: "Can you guarantee approval?",
    a: "No advisory firm can guarantee outcomes. We help reduce preventable errors in paperwork and scheduling.",
  },
];

const PROCESSING_TIMES = [
  ["United States (B1/B2)", "6–10 weeks", "4–6 weeks"],
  ["United Kingdom (Standard)", "3–4 weeks", "5–7 weeks"],
  ["Schengen (Tourism)", "2–3 weeks", "3–5 weeks"],
  ["Canada (Visitor)", "4–8 weeks", "6–9 weeks"],
  ["UAE", "3–5 days", "5–7 days"],
];

const TRUST_MARKS = [
  "US State Dept.",
  "UK Home Office",
  "EU Delegation",
  "IRCC Canada",
  "VFS Global",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-900">
      <div className="border-b border-slate-200/80 bg-slate-900">
        <p className="mx-auto max-w-7xl px-5 py-2.5 text-center text-[11px] leading-relaxed text-slate-400 sm:text-xs">
          Travixa Advisory Pvt. Ltd. · CIN U74999MH2018PTC312884 · Information
          only — not legal representation
        </p>
      </div>

      <header className="decoy-glass sticky top-0 z-50 border-b border-slate-200/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <DecoyLogo variant="header" className="rounded-md" />
          <nav className="hidden items-center gap-9 text-[13px] font-medium text-slate-600 lg:flex">
            <a href="#services" className="transition hover:text-slate-900">
              Services
            </a>
            <a href="#platform" className="transition hover:text-slate-900">
              Platform
            </a>
            <a href="#timelines" className="transition hover:text-slate-900">
              Timelines
            </a>
            <a href="#security" className="transition hover:text-slate-900">
              Privacy
            </a>
            <a href="#faq" className="transition hover:text-slate-900">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <a
              href="#contact"
              className="hidden text-[13px] font-medium text-slate-600 transition hover:text-slate-900 md:inline"
            >
              Contact
            </a>
            <a
              href="#contact"
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Get in touch
            </a>
          </div>
        </div>
      </header>

      <DecoyHero />

      <section
        className="border-b border-slate-200/80 bg-white py-10"
        data-aos="fade-up"
      >
        <p className="decoy-section-label text-center text-[11px] font-semibold uppercase text-slate-400">
          Guidance aligned with official embassy portals
        </p>
        <div
          className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-5"
          data-aos="fade-up"
          data-aos-delay="80"
        >
          {TRUST_MARKS.map((label) => (
            <span
              key={label}
              className="text-sm font-semibold tracking-tight text-slate-300 transition hover:text-slate-400"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      <section
        id="services"
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12 lg:py-28"
      >
        <div className="mx-auto max-w-2xl text-center" data-aos="fade-up">
          <p className="decoy-section-label text-[11px] font-semibold uppercase text-teal-700">
            Service routes
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            One advisory desk. Many border pathways.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Whether you&apos;re visiting for two weeks or relocating for a
            degree, start with the route that matches your purpose — not a
            generic checklist from a forum thread.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {SERVICE_ROUTES.map((route, index) => (
            <article
              key={route.name}
              data-aos="fade-up"
              data-aos-delay={index * 100}
              className={`decoy-card group flex flex-col rounded-2xl border p-8 ${
                route.highlight
                  ? "border-slate-900/10 bg-slate-900 text-white shadow-xl shadow-slate-900/10"
                  : "border-slate-200/80 bg-white"
              }`}
            >
              <div
                className={`mb-6 flex h-11 w-11 items-center justify-center rounded-xl ${
                  route.highlight ? "bg-white/10" : "bg-slate-100"
                }`}
              >
                <svg
                  className={`h-5 w-5 ${route.highlight ? "text-teal-300" : "text-slate-700"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={route.icon}
                  />
                </svg>
              </div>
              {route.highlight ? (
                <span className="mb-3 w-fit rounded-full bg-teal-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-200">
                  Most requested
                </span>
              ) : null}
              <h3 className="text-xl font-semibold tracking-tight">
                {route.name}
              </h3>
              <p
                className={`mt-3 flex-1 text-sm leading-relaxed ${
                  route.highlight ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {route.desc}
              </p>
              <ul
                className={`mt-8 space-y-3 border-t pt-6 text-sm ${
                  route.highlight
                    ? "border-white/10 text-slate-200"
                    : "border-slate-100 text-slate-700"
                }`}
              >
                {route.perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5">
                    <span
                      className={
                        route.highlight ? "text-teal-400" : "text-teal-600"
                      }
                    >
                      ✓
                    </span>
                    {perk}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="platform" className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-5 py-24 sm:px-8 lg:grid-cols-2 lg:px-12 lg:py-28">
          <div
            className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-slate-200/80 shadow-2xl shadow-slate-900/8"
            data-aos="fade-right"
          >
            <Image
              src={DECOY_MEDIA.appPreview}
              alt="Travel documentation workspace with passport and forms"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
          </div>
          <div data-aos="fade-left" data-aos-delay="150">
            <p className="decoy-section-label text-[11px] font-semibold uppercase text-teal-700">
              Client platform
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Know what to prepare before you book
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Our client portal tracks checklist progress, embassy notices, and
              appointment slots you&apos;ve saved — so nothing surprises you at
              the counter.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f, index) => (
                <div
                  key={f.title}
                  data-aos="fade-up"
                  data-aos-delay={index * 60}
                  className="decoy-bento decoy-card rounded-xl border border-slate-200/60 p-5"
                >
                  <p className="font-semibold text-slate-900">{f.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="timelines"
        className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12 lg:py-28"
      >
        <div
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          data-aos="zoom-in"
        >
          <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-8 sm:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="decoy-section-label text-[11px] font-semibold uppercase text-slate-400">
                  Processing windows
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Indicative timelines by route
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Typical ranges we observe · Not official embassy estimates
                </p>
              </div>
              <p className="text-xs font-medium text-slate-400">
                Updated quarterly · August 2026
              </p>
            </div>
          </div>
          <div className="overflow-x-auto px-2 sm:px-0">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] uppercase tracking-[0.1em] text-slate-400">
                  <th className="px-6 py-4 font-semibold sm:px-10">Route</th>
                  <th className="px-4 py-4 font-semibold">Low season</th>
                  <th className="px-6 py-4 font-semibold sm:pr-10">
                    Peak season
                  </th>
                </tr>
              </thead>
              <tbody>
                {PROCESSING_TIMES.map(([route, low, peak], i) => (
                  <tr
                    key={route}
                    className={`border-b border-slate-50 transition hover:bg-slate-50/80 ${
                      i === PROCESSING_TIMES.length - 1 ? "border-0" : ""
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 sm:px-10">
                      {route}
                    </td>
                    <td className="px-4 py-4 text-slate-600">{low}</td>
                    <td className="px-6 py-4 text-slate-600 sm:pr-10">
                      {peak}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        id="security"
        className="relative overflow-hidden bg-[#070b14] py-24 text-white sm:py-28"
      >
        <div
          className="decoy-hero-grid absolute inset-0 opacity-30"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-16 px-5 lg:grid-cols-2 lg:items-center lg:px-12">
          <div data-aos="fade-right">
            <p className="decoy-section-label text-[11px] font-semibold uppercase text-teal-400">
              Privacy & data handling
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your documents stay yours
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              We store uploads encrypted at rest, limit staff access by case
              role, and purge inactive files after 90 days unless you request an
              extension. Indian operations follow DPDP-aligned internal
              policies.
            </p>
            <ul className="mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              {[
                "AES-256 at rest",
                "256-bit TLS in transit",
                "2FA for client logins",
                "India DPDP alignment",
                "SOC 2 Type II (in progress)",
                "No document resale",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div
            className="relative aspect-[5/4] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            data-aos="fade-left"
            data-aos-delay="150"
          >
            <Image
              src={DECOY_MEDIA.travel}
              alt="International traveler at airport"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/70 via-[#070b14]/20 to-transparent" />
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="border-b border-slate-200/80 bg-slate-900 py-20"
      >
        <div className="mx-auto max-w-3xl px-5 text-center" data-aos="fade-up">
          <DecoyLogo
            variant="footer"
            href={null}
            className="mx-auto rounded-md"
          />
          <h2 className="mt-8 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Guides & general inquiries
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-slate-400">
            This site publishes immigration documentation information. For
            media, partnerships, or corporate briefing requests, reach out
            below.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <span className="cursor-default rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-slate-900 shadow-lg">
              Download country guide (PDF)
            </span>
            <a
              href="#faq"
              className="text-sm font-medium text-slate-300 underline-offset-4 transition hover:text-white hover:underline"
            >
              Browse frequently asked questions
            </a>
          </div>
          <p className="mt-10 text-sm text-slate-500">
            General inquiries:{" "}
            <span className="font-medium text-slate-300">info@travixa.com</span>
            <span className="mx-2 text-slate-600">·</span>
            Media:{" "}
            <span className="font-medium text-slate-300">
              press@travixa.com
            </span>
          </p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8">
        <div className="text-center" data-aos="fade-up">
          <p className="decoy-section-label text-[11px] font-semibold uppercase text-slate-400">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            Common questions
          </h2>
        </div>
        <dl className="mt-12 space-y-3">
          {FAQ.map((item, index) => (
            <div
              key={item.q}
              className="decoy-card rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm"
              data-aos="fade-up"
              data-aos-delay={index * 60}
            >
              <dt className="font-semibold text-slate-900">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <footer
        className="border-t border-slate-800 bg-[#05080f] py-16 text-slate-500"
        data-aos="fade-up"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          <div className="sm:col-span-2">
            <DecoyLogo variant="footer" />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              International travel and immigration documentation guidance for
              individuals and families. Operated by Travixa Advisory Pvt. Ltd.,
              Mumbai.
            </p>
            <p className="mt-4 text-xs text-slate-600">
              travixa.com · travixa.co · travixa.sg
            </p>
          </div>
          <div>
            <p className="decoy-section-label text-[11px] font-semibold uppercase text-slate-600">
              Support
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>help@travixa.com</li>
              <li>+91 22 4000 8800</li>
              <li>Mon–Sat, 9am–8pm IST</li>
            </ul>
          </div>
          <div>
            <p className="decoy-section-label text-[11px] font-semibold uppercase text-slate-600">
              Offices
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>Mumbai (HQ)</li>
              <li>Bengaluru</li>
              <li>Singapore</li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-14 max-w-7xl border-t border-slate-800/80 px-5 pt-8 text-center text-xs text-slate-600 lg:px-12">
          © 2018–2026 Travixa Advisory Pvt. Ltd. Informational content only —
          not legal advice.
        </p>
      </footer>
    </div>
  );
}
