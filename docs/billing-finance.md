# Free / Pro and payment integration

Checkout is disabled. Migration 104 resets existing test subscriptions once; subsequent administrator grants are effective on the server, not in local storage.

- Free: five own boards, six simultaneous unique participants (owner seat reserved), five registered students, one group, 250 MiB retained file storage, 25 MiB per file, three personal templates, seven days of available history.
- Pro: 5 GiB retained file storage, 100 latest retained history revisions, no commercial count caps for boards, participants, students, groups or templates. Existing technical safety limits (50 MiB single file and 100 WebSocket connections per board) remain.
- Shared board consumption is billed to its owner. An expired subscription never removes boards or files.

## Connecting a provider
1. Obtain test merchant credentials; store in server secrets only.
2. Implement PaymentAdapter in server/finance.py and assign it to app.state.payment_adapter; authenticated checkout and provider-specific webhook routing are already in place. Use order UUID for provider idempotency and server-side PRICES (29900 / 299000 kopecks). Return only provider-approved hosted checkout URLs.
3. Verify webhook signatures, authoritative payment status, merchant, order identity, exact amount and RUB currency before calling settle_verified_order. Duplicate confirmed events are idempotent; unique provider payment IDs prevent double credit. Store refund transactions and define an entitlement/refund policy before enabling.
4. Test payment success, signature rejection, duplicate delivery, failure, refund and expiry. Enable checkout only after testing and receipt/legal configuration. No credentials currently configured; checkout and webhook are disabled unless an adapter is registered and LEKTRUS_PAYMENTS_ENABLED=true.
5. Switch frontend controls only after approval; checkout-status reflects actual adapter availability.

## Admin finance
The report distinguishes purchases from manual Pro grants and records actual transactions. Amounts are integer kopecks. Finance entries are append-only; correct mistakes with a documented compensating transaction. Amvera top-ups are separate from hosting consumption so they are not counted twice. Amvera balance is a manually recorded snapshot with date; use the provider dashboard until supported authenticated read-only billing integration is selected. CSV is for management accounting, not official tax reports.
