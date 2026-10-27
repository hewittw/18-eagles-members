"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isHoleRoute } from "./CurrentNav";

/**
 * The top bar recedes once you start down a page (instructor feedback: "the header is a little noisy once I start
 * to dig in"). It never leaves: the bar is sticky at a small negative top, so as the page moves its first few pixels
 * tuck under the edge, and this marks it `data-condensed` so the wordmark shrinks, the tab icons fold away and the
 * labels go quiet. Hover or keyboard focus inside the bar brings the labels back (the `recede:` variant).
 * Only transforms, opacity and colour change, so nothing on the page moves. Reduced motion: the same states, no tween.
 * On the hole screen (a focused task) the bar starts condensed.
 */
export function HeaderRecede() {
  const path = usePathname() ?? "";
  const deep = isHoleRoute(path);
  useEffect(() => {
    const bar = document.getElementById("app-header");
    if (!bar) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      bar.toggleAttribute("data-condensed", deep || window.scrollY > 4);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [deep]);
  // Deep screens: the bar's top edge is tucked from the first paint (CSS in globals.css), so the slim bar sits flush.
  return deep ? <span id="hdr-deep" hidden /> : null;
}
