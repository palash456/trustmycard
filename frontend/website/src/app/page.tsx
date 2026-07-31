import { fetchPublicPlatformConfig } from "@/lib/platform-settings";
import ConnectFlowClient from "./ConnectFlowClient";

export default async function Home() {
  const { config } = await fetchPublicPlatformConfig();
  return <ConnectFlowClient platform={config} />;
}
