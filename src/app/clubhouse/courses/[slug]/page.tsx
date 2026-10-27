import type { Metadata } from "next";
import { Suspense } from "react";
import { BUILT_IN, builtInBySlug } from "@/lib/courses";
import { Placeholder } from "../../_components/Placeholder";
import { CourseView } from "./CourseView";

export function generateStaticParams() {
  return BUILT_IN.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/clubhouse/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = builtInBySlug.get(slug);
  // Custom courses load with the golfer's journal (Supabase); the page sets their title once they have.
  if (!c) return { title: slug.startsWith("custom-") ? "Your course" : "Course not found" };
  return { title: c.name, description: c.blurb };
}

export default function CoursePage({ params }: PageProps<"/clubhouse/courses/[slug]">) {
  return (
    <Suspense fallback={<Placeholder label="Opening the course book" />}>
      {params.then(({ slug }) => <CourseView slug={slug} />)}
    </Suspense>
  );
}
