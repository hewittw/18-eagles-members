import Image from "next/image";
import type { ReactNode } from "react";
import { cx } from "../ui/cx";

export type BandPhoto = { src: string; credit: string };

export type PhotoBandProps = {
  /** A graded photo from public/ (credited in docs/credits.md). Decorative here: the band's words carry the meaning. */
  photo: BandPhoto | null;
  children: ReactNode;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

/**
 * The full-bleed Locker Green band a page leads with (the Clubhouse hero, Tour, Pro Shop): a photograph behind a
 * Masters-green wash, deepest behind the text so every word keeps its contrast, and the photo credit in the corner.
 * Without a photo it's the plain Locker Green band.
 */
export function PhotoBand({ photo, children, className, ...aria }: PhotoBandProps) {
  return (
    <section {...aria} className={cx("tex-locker on-green relative isolate overflow-hidden", className)}>
      {photo && (
        <>
          <Image src={photo.src} alt="" fill loading="eager" fetchPriority="high" sizes="100vw" className="-z-20 object-cover" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_72_50/0.94)_0%,rgb(0_88_61/0.86)_45%,rgb(0_103_71/0.72)_100%)] max-md:bg-[linear-gradient(180deg,rgb(0_72_50/0.9)_0%,rgb(0_88_61/0.92)_100%)]" />
          <p className="absolute bottom-2 right-3 rounded-xs bg-black/55 px-1.5 py-0.5 text-[0.7rem] text-white">Photo: {photo.credit}</p>
        </>
      )}
      {children}
    </section>
  );
}
