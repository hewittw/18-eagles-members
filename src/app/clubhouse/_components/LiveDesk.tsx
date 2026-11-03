"use client";
// The home page's live desk: one card, split in two. On top, this week's PGA TOUR event (HomeTour); below, what's on
// sale in the Pro Shop (HomeShop). It sits under "Other ways to start" and, on wide screens, stretches to end level
// with the conditions card beside it (the parent column is a flex column; this card is flex-1).
import { HomeShop } from "./HomeShop";
import { HomeTour } from "./HomeTour";

export function LiveDesk({ className }: { className?: string }) {
  return (
    <section
      aria-label="Live from the Tour and the Pro Shop"
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl border border-rule/70 bg-paper-2 shadow-card ${className ?? ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
        <HomeTour />
      </div>
      <div className="border-t border-rule/70" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col p-6 sm:p-8">
        <HomeShop />
      </div>
    </section>
  );
}
