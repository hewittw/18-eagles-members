import type { Metadata } from "next";
import { AppShell, PageHeader } from "@/components/golf";
import { ButtonLink } from "@/components/ui";
import { Page } from "./clubhouse/_components/Placeholder";

export const metadata: Metadata = { title: "Page not found" };

// Any address that doesn't exist (a typo, an old link): the Clubhouse frame and a way back, instead of Next's bare 404.
export default function NotFound() {
  return (
    <AppShell>
      <Page>
        <PageHeader eyebrow="Out of bounds" title="There's no page here" />
        <div className="mt-6 max-w-measure">
          <p className="font-serif text-lede text-ink-2">The address may have a typo, or the page has moved. Your cards and courses are where you left them.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/clubhouse" variant="primary">Back to the clubhouse</ButtonLink>
            <ButtonLink href="/clubhouse/rounds" variant="secondary">All cards</ButtonLink>
          </div>
        </div>
      </Page>
    </AppShell>
  );
}
