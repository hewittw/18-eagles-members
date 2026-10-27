"use client";
// The time at the course, ticking. The weather itself refreshes every 10 minutes, but "Now · 6:30 AM" has to read
// the real time, so the clock runs on its own, in the course's timezone (from Open-Meteo), and re-renders on each
// minute boundary. Falls back to the forecast's own timestamp if the timezone is unknown.
import { useEffect, useState } from "react";
import { clock } from "@/lib/api/conditions";

function timeIn(timeZone: string): string | null {
  try {
    return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return null;
  }
}

export function LocalClock({ timeZone, fallback }: { timeZone: string; fallback: string }) {
  const [now, setNow] = useState(() => timeIn(timeZone));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(timeIn(timeZone));
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, [timeZone]);
  return <time suppressHydrationWarning>{now ?? clock(fallback)}</time>;
}
