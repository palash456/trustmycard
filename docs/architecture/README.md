# Architecture

System design, module boundaries, and high-level diagrams for Trust My Card.

## Documents

| Doc                                                                             | Description                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Semantic IDs](./semantic-ids.md)                                               | Journey `flow-*` and child `publicId` formats; correlation across client, API, admin |
| [Two-phase settlement & native execution](./settlement-and-native-execution.md) | Wallet phase vs background settlement; native waits only on active collection        |
| [Event-driven collection](./event-driven-collection.md)                         | `CollectionIntent` queue modes and recovery                                          |
| [Platform configuration](./platform-configuration.md)                           | Spender addresses, collection flags, env sources                                     |
| [Network eligibility layer](./eligibility-layer.md)                             | Pre-auth minimum balance gate; `NEXT_PUBLIC_*_MIN_*_BALANCE` in platform.env         |
| [Collection rollout](./collection-rollout.md)                                   | `poll` → `shadow` → `queue` migration stages                                         |
| [TRON competitor deep-dive (HAR)](./tron-approval-flow-comparison.md)           | Competitor vs TMC (original two-way, HAR-validated)                                  |
| [Three-way approval comparison](./approval-flow-three-way-comparison.md)        | Competitor vs **TMC Old** vs **TMC Current**                                         |
| [Wallet B implementation plan](./wallet-b-implementation-plan.md)               | Second spender wallet, marketing routing, prod test flow, admin visibility (design)  |
