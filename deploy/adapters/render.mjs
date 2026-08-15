export const renderAdapter = {
  name: "render",
  async provision() {
    throw new Error(
      "Render adapter is not implemented yet. Use --provider local or --provider docker-vps.",
    );
  },
  async release() {
    throw new Error("Render adapter is not implemented yet.");
  },
};
