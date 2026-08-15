import { spawnSync } from "child_process";

export function transferImagesToHost(creds, imageTags) {
  const tags = [...new Set(imageTags.filter(Boolean))];
  if (tags.length === 0) return;

  const user = creds.VPS_USER || "deploy";
  const host = creds.VPS_HOST;
  if (!host) throw new Error("VPS_HOST is required for image transfer");
  const key = creds.VPS_SSH_KEY ? `-i ${creds.VPS_SSH_KEY}` : "";
  const tagList = tags.join(" ");

  console.log(
    `[image-transfer] streaming ${tags.length} image(s) to ${host}: ${tagList}`,
  );
  const cmd = `docker save ${tagList} | ssh ${key} -o StrictHostKeyChecking=accept-new ${user}@${host} docker load`;
  const result = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error("Image transfer to VPS failed");
  }
}
