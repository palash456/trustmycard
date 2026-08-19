import type { FaqCategory } from "@/components/site/FaqAccordion";

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is Trust Card?",
        answer:
          "Trust Card is a crypto-linked payment card that connects directly to your wallet. Spend from your crypto balance at millions of Visa merchants worldwide without manual top-ups or lengthy verification flows.",
      },
      {
        question: "How do I issue a card?",
        answer:
          "Click Get Started, connect your wallet, choose your card tier (Black Card, Silver Hybrid Card, or Metal Premium Card), and complete the network authorization steps. Most users are approved in seconds.",
      },
      {
        question: "Which wallets are supported?",
        answer:
          "Trust Card works with leading wallets including MetaMask, Wallet, Coinbase Wallet, Phantom, Ledger, Exodus, Electrum, and Atomic Wallet. Additional integrations are added regularly.",
      },
      {
        question: "Do I need KYC to get started?",
        answer:
          "Our onboarding is designed for speed. Card issuance begins with wallet connection and network authorization. Additional identity verification may be required depending on your region and transaction limits.",
      },
    ],
  },
  {
    title: "Cards & Tiers",
    items: [
      {
        question: "What is the Black Card?",
        answer:
          "The Black Card is our entry tier designed for everyday spending. It includes essential features with no annual fee, making it ideal for users getting started with crypto-powered payments.",
      },
      {
        question: "What is the difference between Silver and Metal cards?",
        answer:
          "The Silver Hybrid Card offers enhanced cashback and premium materials. The Metal Premium Card unlocks VIP benefits including lounge access, priority support, and a 2x rewards multiplier for eligible balances.",
      },
      {
        question: "How do I qualify for the Metal Premium Card?",
        answer:
          "Maintain a balance of $20,000 or more in your connected wallet to unlock Metal Premium Card eligibility, including Priority Pass, dedicated concierge, and double cashback benefits.",
      },
      {
        question: "Can I switch card tiers later?",
        answer:
          "Yes. You can reconnect and select a different tier during a new issuance flow. Tier availability may depend on wallet balance, region, and program eligibility.",
      },
    ],
  },
  {
    title: "Spending & Rewards",
    items: [
      {
        question: "Where can I use my Trust Card?",
        answer:
          "Trust Card is accepted at 80+ million merchants where Visa is supported, both online and in-store. Add your card to Apple Pay or Google Pay for contactless payments.",
      },
      {
        question: "How do crypto rewards work?",
        answer:
          "Earn cashback on eligible purchases, automatically converted into your preferred reward asset. Reward rates vary by category and card tier, with higher tiers offering enhanced multipliers.",
      },
      {
        question: "Which networks and assets are supported?",
        answer:
          "Trust Card supports major networks including Ethereum, Tron, BSC, Polygon, Arbitrum, Avalanche, Base, and Solana. Supported stablecoins and settlement assets depend on your linked networks.",
      },
      {
        question: "Are there hidden fees?",
        answer:
          "We believe in transparent pricing. Standard card tiers have no annual fee. Network, conversion, and third-party fees may apply depending on transaction type and jurisdiction.",
      },
    ],
  },
  {
    title: "Security & Support",
    items: [
      {
        question: "How is my wallet connection secured?",
        answer:
          "Connections use industry-standard wallet authorization flows. Sensitive operations require explicit approval in your wallet. We employ encryption, monitoring, and compliance controls aligned with ISO 27001 and ISO 27701 standards.",
      },
      {
        question: "What happens if I lose my card?",
        answer:
          "Freeze your card instantly from the app or contact support. Replacement cards can be reissued after identity verification where required by your card program.",
      },
      {
        question: "How do I contact support?",
        answer:
          "Premium cardholders receive 24/7 priority support. All users can reach our help center through the website footer or in-app support channels.",
      },
      {
        question: "Is my crypto insured?",
        answer:
          "Digital asset holdings connected to your wallet are not insured by the FDIC, SIPC, or equivalent deposit protection schemes. Card services are provided through licensed financial partners pursuant to applicable regulations.",
      },
    ],
  },
];
