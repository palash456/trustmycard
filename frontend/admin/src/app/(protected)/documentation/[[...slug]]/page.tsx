// import { isLocalDocumentationEnabled } from "@/lib/local-documentation";
// import { renderDocumentationPage } from "@/lib/local-documentation-page";
import { notFound } from "next/navigation";

export default async function DocumentationPage({
  params: _params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  notFound();
  // if (!isLocalDocumentationEnabled()) {
  //   notFound();
  // }
  // return renderDocumentationPage(await params);
}
