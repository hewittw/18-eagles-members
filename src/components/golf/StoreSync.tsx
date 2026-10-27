"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { hasUnsavedChanges, hydrateFor, retryLoad, retrySave, useLoadError } from "@/lib/store";
import { Button } from "../ui/Button";
import { ErrorIcon } from "../ui/Field";

/**
 * Ties the in-memory journal to the signed-in Clerk account: loads that golfer's rows from Supabase on sign-in,
 * clears them on sign-out (or when someone else signs in), and warns before leaving with a change still saving.
 * If the journal can't be loaded, says so with Try again instead of showing an empty locker.
 */
export function StoreSync() {
  const { isLoaded, userId } = useAuth();
  const error = useLoadError();

  useEffect(() => {
    if (isLoaded) void hydrateFor(userId ?? null);
  }, [isLoaded, userId]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      void retrySave();
      e.preventDefault();
    };
    const hide = () => { if (document.visibilityState === "hidden" && hasUnsavedChanges()) void retrySave(); };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("visibilitychange", hide); };
  }, []);

  return (
    <div role="alert" className="fixed inset-x-0 top-20 z-[95] px-3">
      {error && (
        <div className="mx-auto flex max-w-xl flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border-2 border-error bg-paper-2 px-4 py-3 text-ink shadow-lift">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[0.95rem] leading-snug">
            <span className="text-error"><ErrorIcon /></span>
            <span>{error}</span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => void retryLoad()}>Try again</Button>
        </div>
      )}
    </div>
  );
}
