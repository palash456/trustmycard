import { notFound } from "next/navigation";
import { isLocalDocumentationEnabled } from "@/lib/local-documentation";
import { renderDocumentationPage } from "@/lib/local-documentation-page";

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  if (!isLocalDocumentationEnabled()) {
    notFound();
  }

  return renderDocumentationPage(await params);
}
