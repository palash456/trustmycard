export const hostingerStaticAdapter = {
  name: "hostinger-static",
  async provision() {
    console.warn(
      "[adapter:hostinger-static] stub — marketing is deployed via the marketing Docker image / manual FTP upload.",
    );
  },
  async release() {
    console.warn(
      "[adapter:hostinger-static] upload frontend/marketing/out or tmc/marketing image artifact to Hostinger.",
    );
  },
};
