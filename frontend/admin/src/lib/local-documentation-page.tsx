import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { DocumentationShell } from "@/lib/local-docs-stubs/components/documentation/DocumentationShell";
import { DEFAULT_DOC_SLUG, getDocPage } from "@/lib/local-docs-stubs/lib/documentation/registry";

export async function renderDocumentationPage(params: {
  slug?: string[];
}): Promise<ReactElement> {
  const { slug } = params;
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
