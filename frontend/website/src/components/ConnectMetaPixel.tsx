import { headers } from "next/headers";

import { MetaPixel } from "@/components/MetaPixel";

export async function ConnectMetaPixel() {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  if (!pathname.startsWith("/connect")) {
    return null;
  }

  return <MetaPixel />;
}
