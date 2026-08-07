import type { LegalSection } from "@/components/site/LegalPageLayout";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance of Terms",
    paragraphs: [
      "These Terms & Conditions govern your access to and use of Trust Card services, including our website, wallet connection flows, and associated payment card programs.",
      "By using our services, you confirm that you have read, understood, and agree to be bound by these terms.",
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    paragraphs: [
      "You must be at least 18 years old and legally capable of entering into binding agreements. Service availability varies by jurisdiction and card program rules.",
      "We may refuse or terminate access where required by law, card network policy, or risk assessment.",
    ],
  },
  {
    id: "services",
    title: "Services Description",
    paragraphs: [
      "Trust Card enables users to connect supported crypto wallets and issue payment cards for spending at participating merchants. Card features, tiers, and rewards depend on program eligibility and issuer terms.",
      "We may modify, suspend, or discontinue features with reasonable notice where practicable.",
    ],
  },
  {
    id: "wallet-authorization",
    title: "Wallet Authorization",
    paragraphs: [
      "Connecting a wallet requires explicit authorization in your wallet application. You are responsible for safeguarding wallet credentials, private keys, and recovery phrases.",
      "Unauthorized wallet activity resulting from compromised credentials is your responsibility unless caused by our gross negligence.",
    ],
  },
  {
    id: "fees",
    title: "Fees and Charges",
    paragraphs: [
      "Fees may apply for card usage, currency conversion, network operations, and third-party services. Applicable fees are disclosed during onboarding or in your cardholder agreement.",
      "Reward rates, cashback tiers, and promotional benefits may change in accordance with program terms.",
    ],
  },
  {
    id: "prohibited",
    title: "Prohibited Use",
    paragraphs: ["You agree not to use Trust Card services to:"],
    list: [
      "Violate applicable laws, sanctions, or export controls.",
      "Engage in fraud, money laundering, or terrorist financing.",
      "Interfere with platform security or other users' access.",
      "Misrepresent identity or provide false compliance information.",
      "Use services for unlawful gambling, adult content, or other restricted merchant categories where prohibited.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    paragraphs: [
      "Digital assets are volatile and not insured by the FDIC, SIPC, or equivalent schemes. Services are provided on an as-is and as-available basis to the maximum extent permitted by law.",
      "We do not provide investment, tax, or legal advice.",
    ],
  },
  {
    id: "limitation",
    title: "Limitation of Liability",
    paragraphs: [
      "To the fullest extent permitted by law, Trust Card and its partners shall not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the services.",
      "Our aggregate liability for direct damages is limited to the amount of fees paid by you to us in the twelve months preceding the claim, where permitted by law.",
    ],
  },
  {
    id: "termination",
    title: "Termination",
    paragraphs: [
      "We may suspend or terminate access for violations of these terms, suspected fraud, or regulatory requirements. You may stop using services at any time, subject to outstanding obligations under your cardholder agreement.",
    ],
  },
  {
    id: "governing-law",
    title: "Governing Law",
    paragraphs: [
      "These terms are governed by the laws applicable to your card program and issuing jurisdiction, without regard to conflict-of-law principles. Dispute resolution procedures are defined in your cardholder agreement.",
    ],
  },
  {
    id: "changes",
    title: "Changes to Terms",
    paragraphs: [
      "We may update these Terms & Conditions from time to time. Material changes will be posted on this page with an updated effective date. Continued use after changes constitutes acceptance.",
    ],
  },
];
