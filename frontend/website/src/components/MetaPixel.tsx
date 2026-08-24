import { connection } from "next/server";
import { getMetaPixelEnvConfig } from "@/lib/meta-pixel-env";
import { fetchMetaPixelIdFromApi } from "@/lib/meta-pixel-runtime";

function metaPixelScript(pixelId: string) {
  return `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixelId}');
fbq('track', 'PageView');
`;
}

export async function MetaPixel() {
  // Primary: database runtime config via backend API (no container restart).
  await connection();
  const pixelId =
    (await fetchMetaPixelIdFromApi()) ?? getMetaPixelEnvConfig()?.pixelId;
  if (!pixelId) return null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: metaPixelScript(pixelId) }} />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
