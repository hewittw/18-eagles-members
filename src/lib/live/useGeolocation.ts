"use client";
// The golfer's position, for the Flights page only, held in React state and nowhere else: never sent to the server,
// never written to localStorage or Supabase. The page turns it into an airport code (suggest.ts) and saves only that.
// It asks only when the golfer presses the button, unless the browser already says permission is "granted" (then it
// reads the position at once, which shows no prompt).
import { useCallback, useEffect, useRef, useState } from "react";

export type GeoState =
  | { kind: "checking" } // reading the permission state
  | { kind: "idle" } // not asked yet: show the button
  | { kind: "asking" } // the browser is asking, or finding the position
  | { kind: "denied" } // the golfer (or a policy) said no
  | { kind: "unavailable"; timedOut: boolean } // no fix (no signal, timed out)
  | { kind: "insecure" } // not https: the browser won't share a position
  | { kind: "unsupported" }
  | { kind: "ready"; lat: number; lon: number; at: number };

const OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 };

export function useGeolocation(): { state: GeoState; request: () => void } {
  const [state, setState] = useState<GeoState>({ kind: "checking" });
  const live = useRef(true);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setState({ kind: "unsupported" }); return; }
    if (!window.isSecureContext) { setState({ kind: "insecure" }); return; }
    setState({ kind: "asking" });
    navigator.geolocation.getCurrentPosition(
      (p) => { if (live.current) setState({ kind: "ready", lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() }); },
      (e) => {
        if (!live.current) return;
        if (e.code === e.PERMISSION_DENIED) setState({ kind: "denied" });
        else setState({ kind: "unavailable", timedOut: e.code === e.TIMEOUT });
      },
      OPTIONS,
    );
  }, []);

  useEffect(() => {
    live.current = true;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!status) return;
      if (status.state === "denied") setState({ kind: "denied" });
      else if (status.state === "granted") request();
    };
    // Decided after mount (never during render), so the server and the first client render agree.
    const t = setTimeout(() => {
      if (!navigator.geolocation) { setState({ kind: "unsupported" }); return; }
      if (!window.isSecureContext) { setState({ kind: "insecure" }); return; }
      if (!navigator.permissions?.query) { setState({ kind: "idle" }); return; }
      navigator.permissions.query({ name: "geolocation" }).then((s) => {
        if (!live.current) return;
        status = s;
        s.addEventListener("change", onChange);
        if (s.state === "granted") request();
        else if (s.state === "denied") setState({ kind: "denied" });
        else setState({ kind: "idle" });
      }, () => { if (live.current) setState({ kind: "idle" }); });
    }, 0);
    return () => { live.current = false; clearTimeout(t); status?.removeEventListener("change", onChange); };
  }, [request]);

  return { state, request };
}
