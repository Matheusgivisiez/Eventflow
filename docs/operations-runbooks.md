# Operations Runbooks

## Failed payment webhook

Symptoms:

- orders remain `PENDING`
- buyers report paid tickets missing
- provider dashboard shows approved payments

Actions:

1. Check provider webhook logs.
2. Check `/api/webhooks/<provider>` API errors.
3. Validate provider signature configuration.
4. Find payment by provider reference.
5. Reprocess webhook or manually reconcile payment through admin-only tooling.
6. Confirm ticket issuance and notification.
7. Add audit note.

## Oversold ticket inventory

Symptoms:

- ticket type sold count exceeds quantity
- checkout errors increase
- support receives duplicate purchase reports

Actions:

1. Pause affected ticket type.
2. Inspect recent checkout transactions.
3. Compare `TicketType.sold`, paid orders and issued tickets.
4. Refund or reassign impacted buyers.
5. Enable Redis lock or stricter SQL row lock for the ticket type.
6. Add regression concurrency test.

## Check-in outage

Symptoms:

- gate staff cannot validate tickets online
- API latency or network unavailable at venue

Actions:

1. Switch staff to mobile offline mode.
2. Confirm local event and device setup.
3. Queue scans locally.
4. Restore API/network.
5. Sync batches and review conflicts.
6. Export conflict report for event operations.

## Database migration incident

Symptoms:

- API errors after deploy
- migration hangs or locks tables
- Prisma client mismatch

Actions:

1. Stop further deploys.
2. Identify migration version.
3. Check DB locks and slow queries.
4. Roll forward if possible; avoid destructive rollback unless approved.
5. Restore from backup only if data corruption is confirmed.
6. Run postmortem and split future migrations into expand/backfill/contract.

## Backup restore drill

Frequency: monthly.

Steps:

1. Create isolated restore database.
2. Restore latest backup plus WAL/PITR if available.
3. Run migration status check.
4. Run smoke queries for tenants, events, orders and tickets.
5. Record restore time objective.
6. Destroy isolated environment.

## High-risk fraud spike

Symptoms:

- many `FraudSignal` rows with `HIGH` or `CRITICAL`
- payment failures or chargeback warnings

Actions:

1. Temporarily increase manual review threshold.
2. Rate-limit suspicious IP/device/document patterns.
3. Pause coupon or campaign if abused.
4. Review provider fraud metadata.
5. Notify affected organizer if ticket delivery is delayed.

## White-label domain issue

Symptoms:

- custom domain does not resolve
- SSL certificate warning
- organizer logo/theme not loading

Actions:

1. Verify `WhiteLabelSetting.customDomain`.
2. Check DNS CNAME/TXT instructions.
3. Check CloudFront distribution and ACM certificate.
4. Invalidate CDN cache if assets changed.
5. Confirm fallback domain still serves the event page.
