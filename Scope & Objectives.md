Scope & Objectives
Deliver a minimal in-house accounting app: wallet-aware bookkeeping, reconciliations, reporting (BS/IS/CF + treasury), and integrations with banks/CEX/wallets/smart contracts.
Keep GL lightweight (self-built subledger + exports to CSV for auditors); optional sync to QuickBooks/Xero later.
Architecture & Hosting
Hybrid: managed DB + object storage (cloud) with self-hosted app/API; option to run fully local via Docker for small teams.
Components: ingestion workers (on-chain/CEX/bank), processing/classification engine, API + admin UI, reporting layer, file export store.
Security: RBAC + MFA/SSO; JWT sessions; HMAC-SHA256 for webhooks; multisig/wallet-auth for sensitive actions; audit log on all mutations.
Data Model & COA
Entities: companies/entities, wallets, accounts (COA), vendors/customers, tokens, tx entries (double-entry), price ticks, FX rates.
Crypto-specific COA: treasury vs ops wallets, token sale liabilities, deferred revenue, gas fees, protocol fees, impairments, realized/unrealized P/L tracked in subledger tables.
Ingestion & Pricing
Sources: EVM RPC/Alchemy/Infura; CEX APIs; bank/credit card CSV/API; manual journal UI.
Normalization: parse tx -> journal entries (debits/credits), tag wallet purpose, compute USD (and local) using price oracle (CoinGecko/Coinbase) at tx time.
Deduplicate and queue errors; reconciliation support (bank/CEX/wallet balances vs ledger).
Processing & Controls
Approval workflow: draft -> reviewed -> posted; separation of duties.
Impairment marking for intangible crypto; realized gain/loss on disposals; gas to expense.
Monthly close checklist templates; variance notes; lock periods after close.
Treasury policy enforcement: spending limits, signer quorum checks (recorded), alerts on large tx.
Reporting & Exports
Reports: Balance Sheet, Income Statement, Cash Flow, Treasury rollforward, Token issuance/distribution report.
Exports: CSV/JSON for auditors and optional GL sync; reconciliation reports with unmatched items.
Security & Ops
Secrets via vault/env; least-privilege access; encrypted DB at rest; HTTPS everywhere.
Backup/restore plan; logging/monitoring; audit trail of user actions and data changes.
Delivery Plan
Week 1-2: finalize COA and data model; pick hosting (cloud/local); scaffold API/UI; set up DB schema.
Week 3-4: build ingestion for wallets + price feeds; manual journal UI; basic double-entry posting; reports v1 (BS/IS/treasury).
Week 5-6: add CEX/bank ingestion; reconciliations; approvals and period locks; audit log.
Week 7-8: impairment/gain-loss handling; token distribution reporting; alerts; exports; harden security.
Ongoing: monthly close runbook, tuning, and add statutory adjustments per jurisdiction.
Implementation Todos
arch-design: Lock architecture/hosting choice and security posture.
schema-coa: Define schema + crypto-aware chart of accounts.
ingest-core: Build wallet + price feed ingestion and normalization.
ledger-core: Implement double-entry engine, approvals, period locks.
reporting-v1: Produce BS/IS/treasury reports and CSV/JSON exports.
controls-audit: Add audit log, RBAC, alerts, and treasury policy checks.
recon-close: Build reconciliation UI and monthly close checklist.
token-report: Implement token issuance/distribution and impairment/gain-loss flows.