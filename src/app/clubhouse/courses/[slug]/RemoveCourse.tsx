"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ConfirmDialog, useToast } from "@/components/ui";
import { swallowStrayTap, useClub } from "@/lib/hooks";
import { update } from "@/lib/store";

/**
 * Remove a course the golfer added (it deletes their custom_courses row). A course with cards on it stays,
 * because those cards need its pars and ratings: the golfer is told why and what to do instead.
 */
export function RemoveCourse({ slug, name }: { slug: string; name: string }) {
  const { store } = useClub();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const cards = store.rounds.filter((r) => r.courseSlug === slug).length;

  return (
    <section aria-labelledby="remove-course" className="mt-10 max-w-measure">
      <h2 id="remove-course" className="font-serif text-[1.25rem] font-semibold text-ink">Remove this course</h2>
      {cards > 0 ? (
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">
          {cards === 1 ? "One card is" : `${cards} cards are`} played here, and {cards === 1 ? "it needs" : "they need"} this course&apos;s pars and ratings.
          Delete {cards === 1 ? "that card" : "those cards"} first if you want the course gone.
        </p>
      ) : (
        <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-2">You added it, so you can take it out of your course book. Built-in courses stay.</p>
      )}
      <Button className="mt-4" variant="danger" size="sm" disabled={cards > 0} onClick={() => setOpen(true)}>Remove {name}</Button>
      <ConfirmDialog
        open={open}
        danger
        title={`Remove ${name}?`}
        body={<p>It leaves your course book on every device. You can add it again any time from Courses.</p>}
        confirmLabel="Remove the course"
        cancelLabel="Keep it"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          update((s) => ({ ...s, customCourses: s.customCourses.filter((c) => c.slug !== slug) }));
          toast({ message: `Removed ${name}` });
          swallowStrayTap();
          router.push("/clubhouse/courses");
        }}
      />
    </section>
  );
}
