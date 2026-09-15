# SaaS phase checklist

- [x] Phase 1: plan, entitlements, usage ledger, cost estimates, budget policy, mocked tests and builds (review pending)
- [ ] Phase 2: shared workflow, durable checkpoints, enforceable budgets
- [ ] Phase 3: Story and List workflows
- [ ] Phase 4: paid creation features
- [ ] Phase 5: subscriptions and allowances
- [ ] Phase 6: launch validation

Phase 1 is code-only. The migrations have been reviewed and are not applied to a live database. `costUsd` is a known estimated subtotal; `costEstimateIncomplete` flags missing prices or pending usage. No customer-credit ledger or paid access checks are active. Phase 2 must enforce budgets before claiming a spending cap, including concurrent in-flight requests.
