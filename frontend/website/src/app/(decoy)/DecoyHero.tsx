"use client";

import { useEffect, useRef, useState } from "react";

import { DECOY_MEDIA } from "./media";

const HERO_STATS = [
  { label: "Countries covered", shortLabel: "Countries", value: "80+" },
  { label: "Languages supported", shortLabel: "Languages", value: "12" },
  { label: "Established", shortLabel: "Since", value: "2018" },
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function DecoyHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoadVideo(true);
          observer.disconnect();
        }
      },
      { rootMargin: isMobile ? "50px" : "100px", threshold: 0.05 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion, isMobile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoadVideo || prefersReducedMotion) return;

    video.load();

    const tryPlay = () => {
      void video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    };

    const onPlaying = () => setVideoPlaying(true);
    const onError = () => setVideoPlaying(false);

    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);

    if (video.readyState >= 3) tryPlay();

    return () => {
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
    };
  }, [shouldLoadVideo, prefersReducedMotion]);

  const showVideo = shouldLoadVideo && !prefersReducedMotion;

  return (
    <section ref={sectionRef} className="decoy-hero relative w-full overflow-hidden bg-[#070b14]">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${DECOY_MEDIA.heroPoster})` }}
        aria-hidden
      />

      {showVideo ? (
        <div className="absolute inset-0 z-[1] overflow-hidden" aria-hidden>
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload={isMobile ? "metadata" : "auto"}
            poster={DECOY_MEDIA.heroPoster}
            className={`decoy-hero-video h-full w-full object-cover transition-opacity duration-1000 ${
              videoPlaying ? "opacity-100" : "opacity-0"
            }`}
          >
            <source src={DECOY_MEDIA.heroVideo} type="video/mp4" />
          </video>
        </div>
      ) : null}

      <div className="decoy-hero-grid absolute inset-0 z-[2] opacity-40" aria-hidden />
      <div className="decoy-hero-overlay absolute inset-0 z-[3]" aria-hidden />

      <div className="decoy-hero-inner relative z-10 mx-auto flex max-w-7xl flex-col px-4 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p
            data-aos="fade-down"
            data-aos-duration="600"
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-medium leading-snug text-white/90 backdrop-blur-md sm:gap-2.5 sm:px-4 sm:text-xs"
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0 sm:h-2 sm:w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
              <span className="relative inline-flex h-full w-full rounded-full bg-teal-400" />
            </span>
            <span className="sm:hidden">80+ destinations · Immigration advisory</span>
            <span className="hidden sm:inline">
              Immigration advisory · 80+ destinations · ISO-aligned operations
            </span>
          </p>

          <h1
            data-aos="fade-up"
            data-aos-delay="100"
            className="mt-5 text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:mt-8 sm:text-5xl sm:leading-[1.05] lg:text-[3.5rem]"
          >
            Cross borders with{" "}
            <span className="decoy-gradient-text font-semibold">clarity and confidence.</span>
          </h1>

          <p
            data-aos="fade-up"
            data-aos-delay="200"
            className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-300/95 sm:mt-6 sm:text-lg"
          >
            Travixa helps travelers, students, and families navigate permit requirements,
            appointment timelines, and document checklists — before they book a flight.
          </p>

          <div
            data-aos="fade-up"
            data-aos-delay="300"
            className="mt-7 flex flex-col gap-2.5 sm:mt-10 sm:flex-row sm:items-center sm:gap-3"
          >
            <a
              href="#services"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-lg shadow-black/20 transition hover:bg-slate-100 sm:w-auto sm:px-7"
            >
              Explore service routes
              <svg
                className="h-4 w-4 transition group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
            <a
              href="#timelines"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/[0.06] px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/[0.1] sm:w-auto sm:px-7"
            >
              View timelines
            </a>
          </div>
        </div>

        <dl
          data-aos="fade-up"
          data-aos-delay="400"
          className="decoy-hero-stats mt-8 grid grid-cols-3 gap-2 border-t border-white/10 pt-6 sm:mt-16 sm:max-w-2xl sm:gap-8 sm:pt-10 lg:gap-12"
        >
          {HERO_STATS.map((stat) => (
            <div key={stat.label} className="text-center sm:text-left">
              <dt className="text-[9px] font-medium uppercase leading-tight tracking-[0.1em] text-slate-400 sm:text-[11px] sm:tracking-[0.14em]">
                <span className="sm:hidden">{stat.shortLabel}</span>
                <span className="hidden sm:inline">{stat.label}</span>
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:mt-2 sm:text-3xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <a
        href="#services"
        data-aos="fade"
        data-aos-delay="600"
        className="decoy-scroll-hint absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/50 transition hover:text-white/80 sm:bottom-10 sm:flex"
        aria-label="Scroll to learn more"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Discover</span>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </a>
    </section>
  );
}
