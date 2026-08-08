"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import "./decoy.css";

export function DecoyAosInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: "ease-out-cubic",
      once: true,
      offset: 48,
      delay: 0,
    });

    const onResize = () => AOS.refresh();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return <>{children}</>;
}
