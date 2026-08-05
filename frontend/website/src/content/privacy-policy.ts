import type { LegalSection } from "@/components/site/LegalPageLayout";

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    paragraphs: [
      "This Privacy Policy describes how Trust Card and its partners collect, use, disclose, and safeguard your information when you use our website, mobile applications, and card services.",
      "By accessing or using our services, you agree to the collection and use of information in accordance with this policy.",
    ],
  },
  {
    id: "information-we-collect",
    title: "Information We Collect",
    paragraphs: ["We may collect the following categories of information:"],
    list: [
      "Wallet connection data, including public wallet addresses and network authorization records.",
      "Account and contact information such as email address when provided.",
      "Transaction and usage data related to card issuance, linking, and spending activity.",
      "Device, browser, and log data including IP address, timestamps, and diagnostic events.",
      "Compliance information required for anti-money laundering and regulatory obligations.",
    ],
  },
  {
    id: "how-we-use-information",
    title: "How We Use Your Information",
    paragraphs: ["We use collected information to:"],
    list: [
      "Provide, operate, and maintain Trust Card services.",
      "Process wallet connections, card issuance, and settlement workflows.",
      "Detect, prevent, and address fraud, abuse, and security incidents.",
      "Comply with legal, regulatory, and card network requirements.",
      "Improve product performance, user experience, and customer support.",
      "Communicate service updates, security notices, and promotional content where permitted.",
    ],
  },
  {
    id: "sharing",
    title: "How We Share Information",
    paragraphs: [
      "We do not sell your personal information. We may share information with licensed card issuers, payment processors, wallet infrastructure providers, analytics vendors, and regulators when necessary to deliver services or meet legal obligations.",
      "All partners are required to handle data under contractual confidentiality and security standards.",
    ],
  },
  {
    id: "retention",
    title: "Data Retention",
    paragraphs: [
      "We retain information for as long as needed to provide services, resolve disputes, enforce agreements, and satisfy legal retention requirements. Retention periods vary based on data type and jurisdiction.",
    ],
  },
  {
    id: "security",
    title: "Security",
    paragraphs: [
      "We implement administrative, technical, and organizational measures designed to protect your information, including encryption, access controls, and continuous monitoring. No method of transmission or storage is completely secure.",
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights",
    paragraphs: [
      "Depending on your location, you may have rights to access, correct, delete, restrict processing, or port your personal data. You may also withdraw consent where processing is consent-based.",
      "To exercise these rights, contact us using the details in the Contact section below.",
    ],
  },
  {
    id: "international",
    title: "International Transfers",
    paragraphs: [
      "Your information may be processed in countries other than your country of residence. Where required, we implement appropriate safeguards for cross-border data transfers.",
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    paragraphs: [
      "If you have questions about this Privacy Policy or our data practices, contact our privacy team through the support channels listed on our website.",
    ],
  },
];
