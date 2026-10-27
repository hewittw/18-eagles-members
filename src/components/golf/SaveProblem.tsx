"use client";
import { useState } from "react";
import { retrySave, useSaveFailed } from "@/lib/store";
import { Button } from "../ui/Button";
import { ErrorIcon } from "../ui/Field";

/**
 * "Couldn't save" with Try again, whenever a change can't be saved to the golfer's account (offline, or the server didn't answer).
 * The change is still on screen (kept in memory), so nothing typed is lost while this tab stays open.
 * An alert, so it's announced the moment it appears; it stays until a save works.
 */
export function SaveProblem() {
  const failed = useSaveFailed();
  const [tried, setTried] = useState(false);
  return (
    <div role="alert" className="fixed inset-x-0 bottom-[calc(var(--tabbar)+env(safe-area-inset-bottom)+0.5rem)] z-[95] px-3 md:bottom-6">
      {failed && (
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-2 border-error bg-paper-2 px-4 py-3 text-ink shadow-lift">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[0.95rem] leading-snug">
            <span className="text-error"><ErrorIcon /></span>
            <span>
              <strong className="font-semibold">Couldn&apos;t save to your account.</strong> Your latest change is kept while this tab stays open.
              {tried ? " Still not saving: check your connection, then try again. You can also export a copy from the Locker." : ""}
            </span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => { setTried(true); void retrySave(); }}>Try again</Button>
        </div>
      )}
    </div>
  );
}
