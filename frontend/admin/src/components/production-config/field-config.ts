export type ConfigField = "domain" | "pixel";

export const FIELD_CONFIG = {
  domain: {
    label: "Website Domain",
    dialogTitle: "Change Website Domain",
    description: "Enter the production domain you want to deploy.",
    currentLabel: "Current domain",
    inputLabel: "New domain",
    placeholder: "https://example.com",
    action: "Change Domain",
    errorMessage: "Enter a valid HTTPS domain.",
    errorExample: "Example: https://example.com",
    tips: [
      "Include https://",
      "Use a public domain that points to production",
      "Do not include paths such as /login or /app",
    ],
    examples: ["https://example.com", "https://www.example.com"],
  },
  pixel: {
    label: "Meta Pixel ID",
    dialogTitle: "Change Meta Pixel ID",
    description: "Enter the Meta Pixel ID used by the production wallet app.",
    currentLabel: "Current Pixel ID",
    inputLabel: "New Pixel ID",
    placeholder: "123456789012345",
    action: "Change Pixel ID",
    errorMessage: "Enter a valid numeric Meta Pixel ID.",
    errorExample: "Example: 123456789012345",
    tips: [
      "Use the numeric ID from Meta Events Manager",
      "Do not include spaces or special characters",
      "Confirm the ID against the correct Meta Business account",
    ],
    examples: ["123456789012345", "123456789012346"],
  },
} as const;
