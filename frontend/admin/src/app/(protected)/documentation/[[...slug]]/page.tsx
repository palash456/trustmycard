import { notFound, redirect } from "next/navigation";
import { DocumentationShell } from "@/components/documentation/DocumentationShell";
import { DEFAULT_DOC_SLUG, getDocPage } from "@/lib/documentation/registry";

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const resolvedSlug = slug?.[0];

  if (slug && slug.length > 1) {
    notFound();
  }

  if (!resolvedSlug) {
    redirect(`/documentation/${DEFAULT_DOC_SLUG}`);
  }

  const page = getDocPage(resolvedSlug);
  if (!page) {
    notFound();
  }

  return <DocumentationShell page={page} />;
}
