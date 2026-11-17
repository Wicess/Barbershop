# Transaction Recording, Payment Handling and Cash Control for a Walk-in Barbershop + Manicure/Pedicure Business

Scope: walk-in only (no online booking), no country assumed, extra attention to cash- and mobile-money-heavy markets. Researched October 2026. Vendor help-center docs (Square, Lightspeed, Toast, Blaze), tax authority and legislation pages, and a ledger engineering article were the main sources. Many design recommendations (state machines, schemas) are **inferences** synthesised from the cited behaviour and are labelled as such.

---

## 1. Ticket / sale model (lifecycle, line items, staff attribution, discounts, tax, rounding)

### Takeaway
Use a mutable **ticket** (open order) that becomes an immutable **sale** once paid and closed. Every later change, whether a void, refund or correction, is a new linked record, never an edit. Attribute staff per line, not per ticket. Compute tax per line in integer minor units under one documented rounding rule. Tax rounding rules differ by jurisdiction (UK HMRC lets retailers round per line or per invoice but restricts rounding VAT *down*).

### Cited Findings
- Ledger engineering practice: business objects such as orders are mutable "presentation layers", while accounting entries are the source of truth. Many entries can link to one business object, and their sum should equal the object's amount. Entries are **pending (mutable) → posted (immutable)**, and failed ones are **archived**. "A ledger transaction is mutable while pending and immutable once posted." — [Modern Treasury, Enforcing immutability](https://moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- Late adjustments after settlement should be separate entries and should not alter the earlier settlement, so one order may settle across several entries. — [Modern Treasury](https://moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- Salon-specific fraud: staff record a cheaper service than the one delivered. Recommended controls are mapping durations to fixed SKUs, locking post-billing edits, and reviewing service mix and average ticket by staff. — [MioSalon, 24 salon revenue leaks](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Control: "require a ticket for every service" and compare staff utilisation with billed revenue, to catch no-bill or paper-only service. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- UK VAT rounding: HMRC Notice 700 (paras 17.5–17.6) says a retailer calculating VAT at line or invoice level must not round the VAT figure down, but may round up and down on each calculation. HMRC's acceptable options include rounding to the nearest 1p, or calculating to at least 5 decimal places and rounding to 4, or truncating at no fewer than 6. The round-down concession is for invoice traders and genuinely VAT-exclusive pricing. — [HMRC VATREC12020](https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12020); [HMRC VATREC12040](https://gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12040)
- EU case C-302/07 (J D Wetherspoon) concerned per-line VAT rounding down at a retailer. — [VATupdate flashback](https://www.vatupdate.com/2021/08/25/flashback-on-ecj-cases-c-302-07-j-d-wetherspoon-rules-on-rounding-of-vat-amounts/) (outcome not verified in this research)
- Per-line rounding can make the displayed net amounts and VAT on a receipt not sum exactly to the total. This comes from forum reports and is anecdotal. — [UK Business Forums](https://www.ukbusinessforums.co.uk/threads/vat-rounding-decimal-places-summing.352822/)

### Inferences (design proposals)
**Ticket state machine**
```
OPEN ──add/remove lines, assign staff, apply discounts──► OPEN
OPEN ──"request payment"──► AWAITING_PAYMENT (lines locked; edit = back to OPEN with audit row)
AWAITING_PAYMENT ──payments sum == amount_due──► PAID → CLOSED (immutable, receipt number issued)
AWAITING_PAYMENT ──partial payment──► PARTIALLY_PAID (cannot be abandoned; must complete or refund the tendered part)
OPEN ──cancel before any payment, reason code──► CANCELLED (kept, never deleted; counted in exception report)
CLOSED ──void (same shift, before Z, manager PIN)──► VOIDED (reversal records created)
CLOSED ──refund (full/partial, any time, manager PIN)──► CLOSED + linked REFUND document(s)
```
- Rule: a ticket with any captured payment can never go to CANCELLED. It must be refunded through a REFUND document, which closes the "void after payment" hole.
- For walk-ins, add a light queue: `WAITING → IN_CHAIR → DONE_UNPAID → PAID`. A `DONE_UNPAID` ticket left open past N minutes raises an alert, since that is a common place for cash to get pocketed.

**Core tables / fields**
- `ticket`: id (UUID), shop_id, register_id, drawer_session_id, ticket_no (per-shop sequence), status, customer_id (nullable, walk-in), opened_by, opened_at, closed_by, closed_at, subtotal_minor, discount_minor, tax_minor, rounding_adj_minor, total_minor, tip_minor, currency, price_mode (`TAX_INCLUSIVE|TAX_EXCLUSIVE`), receipt_no (assigned only at close, gapless), fiscal_ref/QR (nullable), version.
- `ticket_line`: id, ticket_id, line_no, item_type (`SERVICE|PRODUCT|PACKAGE_SALE|GIFT_CARD_SALE|DEPOSIT`), catalog_item_id, name_snapshot, unit_price_minor_snapshot, qty, section (`BARBER|MANICURE|PEDICURE|RETAIL`), **staff_id (performer)**, assistant_staff_id (optional), commission_rule_snapshot, line_discount_minor, discount_reason_code, discount_approved_by, allocated_ticket_discount_minor, tax_code, tax_rate_bp (basis points), tax_minor, line_total_minor, status (`ACTIVE|REMOVED`; removal before payment is logged, not deleted).
- Snapshot price, name, tax rate and commission rule on the line so that later catalog edits never rewrite history.
- **Discounts:** line-level discounts (e.g. "student cut −20%") and ticket-level discounts (e.g. "KES 100 off") are stored separately. A ticket-level discount is **allocated pro-rata across lines** in minor units using a largest-remainder allocation, so the allocated amounts sum exactly. Commission and tax are then computed on post-discount line values. Every discount carries a reason code. Any discount above a role cap needs a manager PIN, which is recorded.
- **Tax-inclusive** pricing is typical for walk-in consumer sales: `tax = round(gross × r / (1 + r))`, `net = gross − tax`. **Tax-exclusive** pricing: `tax = round(net × r)`. Pick per-line or per-ticket calculation as a jurisdiction setting. Default to per-line, rounding half-up (never always-down, per HMRC). Store the rate in basis points and compute in integers or decimals, never floats.
- **Cash rounding** (for markets without small coins, or where coins are impractical): only the cash tender is rounded to the nearest usable unit (e.g. 5 or 10). The difference goes in `rounding_adj_minor` and posts to a "cash rounding" account. Card and mobile money payments pay the exact amount.

### Gaps
- No primary source on salon POS ticket state machines. The model above is synthesised from ledger and POS patterns.
- The final ruling in Wetherspoon (C-302/07) was not verified here.

---

## 2. Payment methods, split tender, change due, tips

### Takeaway
Model a **payment** as its own row: one ticket has many payments (split tender), each with method, amount and external reference. Cash payments record *tendered* and *change* separately. Mobile money must be **verified against the provider's records, not the customer's SMS**. Card tips are a liability to staff and are best paid via payroll, not out of the cash drawer, because paying them from the drawer breaks drawer reconciliation.

### Cited Findings
- Square's cash drawer sessions track starting cash, cash sales, cash refunds, cash paid in/out and expected cash. Only cash affects the drawer. — [Square: start/end a cash drawer session](https://squareup.com/help/us/en/article/8344-start-and-end-a-cash-drawer-session)
- Manual methods such as cash must be counted and entered at close, while card and gift card payments are reconciled automatically by the system. — [item.com register reconciliation](https://www.item.com/bookkeeper/register-operations-drawer-reconciliation)
- Safaricom M-PESA: genuine confirmation SMS come from "MPESA" and never from a phone number. Some customers show edited SMS or old screenshots. "When you haven't received the SMS on your notification number, do not accept the customer SMS on their phone as proof of payment… log into your statement to confirm receipt of funds… before releasing goods or offering services." — [Safaricom, Emerging M-PESA fraud tactics](https://safaricom.co.ke/PartnerNewsletter/highlights/emerging-m-pesa-fraud-tactics)
- Merchants can request an M-PESA reversal via the M-PESA Business App or by dialling *234# → Merchant Services. Fraud is reported via *234# or SMS to 333. — [Safaricom, Secure M-PESA](https://safaricom.co.ke/main-mpesa/m-pesa-for-you/m-pesa-tips/secure-m-pesa)
- The M-PESA Business Portal shows credits within seconds, and searching by transaction code gives a present/absent answer. Reversals are reportedly limited to about 7 days. This is a third-party claim and is unconfirmed by Safaricom. — [paybillke.com chargeback guide](https://paybillke.com/guides/mpesa-chargeback-customer-disputes-2026)
- Paying card tips out of the cash drawer at close "broke" the cash drawer report and hid who received what, forcing back-office adjustments at payroll (user report). — [Square Community, paying out credit card tips](https://community.squareup.com/t5/Archived-Discussions-Read-Only/paying-out-credit-card-tips/m-p/347123)
- In Square Payroll, tips can be imported as Cash Tips (already paid, not in the pay run) or paycheck tips (paid through payroll). Employers must still record and withhold tax on tips, at least in the US. — [Square Community, reporting tips](https://community.squareup.com/t5/Orders-Menu-Items-Catalog/Reporting-tips-for-employees/m-p/202047)
- Salon fraud involving prepaid instruments: redeeming other clients' prepaid balances, package sessions, gift vouchers or reward points. Controls are an OTP to the account holder's phone on each redemption, client notification on every use, and reports of redemptions by staff. Blocking deletion of packages while credits are active and capping bonus ratios on custom prepaid were also recommended. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)

### Inferences (design proposals)
- `payment`: id, ticket_id, method (`CASH|CARD|MOBILE_MONEY|BANK_TRANSFER|GIFT_CARD|PACKAGE_CREDIT|STORE_CREDIT|VOUCHER`), provider (`MPESA|MTN_MOMO|AIRTEL|…`), amount_minor (applied to the ticket), tendered_minor (cash only), change_minor (cash only; `change = tendered − amount`, must be ≥ 0 and is only allowed on cash), tip_minor, external_ref (M-PESA code, card auth code, bank ref; **unique per provider** to block reuse of one SMS for two tickets), payer_phone (masked), verification_status (`PENDING|VERIFIED|FAILED|MANUAL_OVERRIDE`), verified_by/at, drawer_session_id (cash only), status (`CAPTURED|REVERSED`), created_by.
- Split-tender rule: `Σ payment.amount_minor = ticket.total_minor`. The ticket closes only when that equality holds and every payment is VERIFIED, or overridden with a manager PIN and reason.
- Mobile money verification, in order of strength:
  1. Provider API callback (e.g. Daraja C2B/STK push, MTN MoMo Collections API), which auto-matches the code.
  2. Cashier enters the transaction code, and the system checks it against an imported till statement at end of day.
  3. Manual "seen on till phone" with a PIN. Any mobile money still unmatched at the Z close becomes an exception.
- Overpayment by mobile money (customer sends 550 for a 500 bill): either record change given in cash, which is a cash-out from the drawer linked to the payment, or put the excess on store credit. Never silently absorb it.
- Tips: store per payment and attribute to staff (`tip_allocation`: payment_id, staff_id, amount). Cash tips handed directly to staff are optional to record. Card and mobile money tips are a **liability** (tips payable) settled by payroll or a separate recorded payout, never a drawer pay-out with no attribution. Changing a tip after close needs a manager PIN and an audit row, to counter tip manipulation.
- Gift cards, packages and store credit are **liabilities**. Selling one creates a liability, not revenue. Redeeming one is a tender that draws the liability down. Keep a balance ledger per instrument (`instrument_txn`: instrument_id, delta_minor, ticket_id, reason), so balances are always a sum, never a stored editable number.

### Gaps
- No official MTN MoMo or Airtel merchant verification guidance was retrieved, and the official Safaricom reversal time limit was not confirmed.
- Tip tax treatment varies by country and was not researched beyond the US-centric Square community posts.

---

## 3. Voids vs refunds vs returns vs corrections; immutability

### Takeaway
Never delete or edit a closed sale. A **void** is a full reversal of a sale in the same shift, before the Z close. A **refund** is a new linked document with negative amounts, possibly partial and possibly days later. A **return** is a refund of a product that also restocks inventory. A **correction** is a reversal plus a re-entry, or a delta entry. All of these need a reason code, approval, and an appearance on exception reports.

### Cited Findings
- To correct a mistake, either reverse the original entry with an opposite-amount entry and post a new correct one, or post a single delta entry. Mutating data in place means "the data is irreversibly destroyed". — [Modern Treasury](https://moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)
- Every change in the ledger generates an audit log so that the responsible actor can be traced. — [Modern Treasury Ledgers](https://www.moderntreasury.com/ledgers)
- EU VAT: a document that amends an invoice must carry a "specific and unambiguous reference to that initial invoice". — [Directive 2006/112/EC Art. 226b](https://www.legislation.gov.uk/eudr/2006/112/article/226b)
- Salon frauds 2, 3, 19, 20 and 22 are editing bills after cash is collected, cancelling bills after cash is collected, turning off notifications and then editing or cancelling, printing duplicate bills, and creating backdated bills then cancelling them. The controls are disabling edits by default, owner OTP approval, a reason code, client notification of changes, cancellation reports by staff and time, and blocking backdated cancellation. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Refunds and voided sales should be witnessed by a manager or owner. POS exception reports flag unusual voids, refunds and discounts by employee. — [OneHub POS fraud prevention](https://www.onehubpos.com/blog/pos-fraud-prevention-how-to-stop-employee-theft-before-profits-disappear); [DTiQ types of employee theft](https://www.dtiq.com/blog/loss-prevention/types-of-employee-theft)

### Inferences (design proposals)
| Action | When allowed | What is written | Drawer effect | Approval |
|---|---|---|---|---|
| Remove line (pre-payment) | OPEN ticket | line.status=REMOVED + audit row | none | role cap; flag high counts |
| Cancel ticket | no payment captured | status=CANCELLED + reason | none | reason code |
| Void | CLOSED, same drawer session, before Z | `reversal` document mirroring every line and payment negatively; original → VOIDED | cash out = original cash | manager PIN |
| Refund (partial/full) | any time after close | `refund` document referencing original ticket and lines; refund tender chosen (default = original method) | cash out if cash | manager PIN; cap on refund > original |
| Return (product) | as refund | refund + inventory movement (restock or write-off) | as refund | manager PIN |
| Correction (wrong staff/price) | after close | reversal + new corrected sale linked by `corrects_id` | net zero if same tender | manager PIN |
- Technical enforcement: the DB role used by the app has no UPDATE or DELETE on `ticket` and `payment` once `status=CLOSED`, enforced by a trigger. All writes are append-only. Use an idempotency key on payment creation, so a retried network request cannot double-post.
- Refunds must not exceed `original paid − already refunded` per line and per tender. A cash refund on a card or mobile money sale needs extra approval, because it is a classic cash extraction route.
- Use an append-only `audit_log`: id, at, actor_id, device_id, action, entity, entity_id, before_json, after_json, reason, approved_by. Optionally chain hashes (`hash = H(prev_hash || row)`) for tamper evidence, which also matches the style of fiscal regimes.

### Gaps
- No single authoritative POS standard defining void vs refund was found. The definitions above follow common POS usage.

---

## 4. Cash drawer management: float, pay-in/out, drops, blind close, over/short, X vs Z, handover

### Takeaway
Run cash as **drawer sessions** with a fixed formula: `expected = opening float + cash sales − cash refunds + pay-ins − pay-outs − drops`. Close **blind**, meaning the cashier counts, ideally by denomination, before seeing the expected figure. Store the variance, require a note when it exceeds a threshold, and trend it per cashier. An X report is a read-only mid-shift snapshot. A Z report closes the session and is immutable.

### Cited Findings
- Lightspeed (S-Series) expected drawer = opening amount + cash sales − cash returns + pay-ins − drops − payouts − purchases. The "Short" figure is counted minus expected and is 0 until the shift closes. X reports cover from shift open to the moment the report is run. Z reports cover the whole shift from open to close and are run after closing for the end-of-day summary per register. — [Lightspeed (ShopKeep) X and Z reports](https://shopkeep-support.lightspeedhq.com/support/reporting/z-and-x-reports)
- In general POS usage an X report changes nothing (read-only), while a Z report closes the period and resets the totals. — [Erply wiki, X-report](https://wiki.erply.com/article/77-x-report); [Lightspeed Restaurant](https://resto-support.lightspeedhq.com/hc/articles/360007460293)
- Square: a session starts with a starting cash amount, which is entered in the POS app and cannot be set from the dashboard. Pay In/Out records cash movements outside sales, with an amount and a description. **Closing** records the actual counted cash, while **ending** just clicks End Drawer. Ending remotely from the dashboard prevents later Pay In/Out adjustments. Drawers open more than 30 days with 7 days of inactivity auto-end. Viewing reports needs a reports permission. — [Square 8344](https://squareup.com/help/us/en/article/8344-start-and-end-a-cash-drawer-session)
- One Square Community user reports that each day starts from the default starting cash, not from last night's close (anecdotal). — [Square Community](https://community.squareup.com/t5/Questions-How-To/Expected-Cash-in-Drawer-is-Out/m-p/51694)
- Blind count: staff count the drawer without seeing the expected total, and the POS then compares the count with logged sales, which removes any reason to fudge the count. — [PlumPOS glossary](https://plumpos.com/glossary/blind-cash-count.html)
- Blaze has an "Enforce Blind Cash Drawer Counts" setting, where the expected amount appears only in the manager's Closing Report. Blaze also offers per-denomination counting. — [Blaze denomination counter](https://support.blaze.me/hc/en-us/articles/retail-cash-drawer-denomination-counter)
- Toast permission "Cash Drawers (Blind)" hides expected amounts from that employee. — [Toast cash drawer states](https://doc.toasttab.com/doc/platformguide/adminCashDrawerStates.html) (page returned 403 on fetch; detail is from the search snippet)
- Limits of blind close: it does not catch sales that were never rung up ("sandbagging"). Bepoz recommends forcing the drawer to be closed between every transaction. — [Bepoz POS security](https://bepoz.com/feature/point-of-sale-security)
- Shopify pairs blind closing with documenting paid-ins and paid-outs and securing the drawer until the next shift. — [Shopify, balancing a cash drawer](https://www.shopify.com/in/blog/balancing-a-cash-drawer)
- Closing a register both reconciles the drawer and locks the register from further sales. — [Oracle Xstore cash drawers](https://docs.oracle.com/en/industries/retail/retail-xstore-point-of-service/21.0/rpxmg/cash-drawers.htm)
- Warning signs of theft include frequent gaps between recorded and actual cash, and unauthorised drawer access. Surprise audits are recommended. — [DTiQ](https://www.dtiq.com/blog/loss-prevention/types-of-employee-theft)

### Inferences (design proposals)
**Drawer session state machine**
```
(none) ──open: count float by denomination, cashier PIN──► OPEN
OPEN ──X report (any time, read-only)──► OPEN
OPEN ──handover: outgoing blind count → incoming recount/accept──► CLOSED(outgoing) + OPEN(incoming, float = accepted count)
OPEN ──start close──► COUNTING (sales blocked on this drawer; expected hidden)
COUNTING ──submit blind count──► PENDING_REVIEW (variance computed; if |variance| > threshold → note + manager)
PENDING_REVIEW ──manager accepts──► CLOSED (Z number assigned, immutable)
CLOSED ──bank deposit recorded──► RECONCILED
```
- `drawer_session`: id, register_id, z_no (gapless per register), opened_by, opened_at, opening_float_minor, opening_count_json (denominations), closed_by, closed_at, counted_minor, counted_json, expected_minor (frozen at close), variance_minor, variance_note, reviewed_by, status, prev_session_id, carried_float_minor (float left in the drawer for the next day), deposit_minor.
- `cash_movement`: id, drawer_session_id, type (`PAY_IN|PAY_OUT_EXPENSE|PAY_OUT_TIP|DROP_TO_SAFE|CHANGE_FUND_TOP_UP|MOBILE_MONEY_CASHOUT_CHANGE|NO_SALE_OPEN`), amount_minor, category, description, receipt_photo_url, payee, created_by, approved_by.
- **Formulas**
  - `expected_cash = opening_float + Σcash_sale_payments(amount, i.e. tendered − change) − Σcash_refunds − Σcash_voids + Σpay_ins − Σpay_outs − Σdrops ± cash_rounding_adj`
  - `variance = counted − expected` (positive = over, negative = short)
  - `deposit = counted − carried_float_next_day`
  - Card and mobile money expected values (`Σ payments by method`) are reconciled separately against the processor or till statement: `method_variance = statement_total − system_total`.
- Policy defaults to put in settings: variance tolerance, e.g. ±0.5% of cash sales or a fixed small amount. Above it, a note is mandatory. Repeated shorts by one cashier, e.g. 3 in 14 days, raise an alert. Note that *overages* are also suspicious, since they can indicate unrung sales that were not removed in time.
- Log every "no sale" drawer open with the actor, and alert on high counts.
- One cashier per drawer at a time gives accountability. Shared drawers make variances unattributable.

### Gaps
- Square does not publish an exact expected-cash formula. Lightspeed's formula is used as the reference.
- No published industry benchmark for an "acceptable" over/short tolerance was found.

---

## 5. Daily expenses and their effect on cash-up

### Takeaway
Expenses paid from the till are **pay-outs** that reduce expected cash. They must carry a category, a description and ideally a receipt photo, and they must be locked to the open session, with no back-dating into closed days. Expenses paid from elsewhere (owner's mobile money, bank) are recorded in an expense ledger but do not touch the drawer.

### Cited Findings
- Paid-outs reduce the expected drawer amount ("minus … payouts and purchases"). — [Lightspeed X/Z reports](https://shopkeep-support.lightspeedhq.com/support/reporting/z-and-x-reports)
- Square pay-outs require an amount and a description and appear in drawer history. — [Square 8344](https://squareup.com/help/us/en/article/8344-start-and-end-a-cash-drawer-session)
- Salon fraud #21: "adding fake expenses to already-audited past dates". — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Fraud #14: retail products sold but logged as internal (service) use. The control is auto-deducting service consumption and reconciling internal use against completed services. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Kenya: since 1 Jan 2024, business expense claims must be supported by eTIMS invoices. Secondary sources say expenses without a valid eTIMS invoice carrying the buyer's PIN are disallowed when 2025 returns are filed in 2026. — [FaidiHR](https://www.faidihr.com/blog/kra-etims-the-no-invoice-no-deduction-era); [Beancount guide](https://beancount.io/blog/2026/07/22/kenya-kra-etims-income-expense-validation-guide)

### Inferences
- `expense`: id, date, category (supplies: clippers blades, nail polish, acetone, towels; utilities; staff lunch; transport; repairs), amount_minor, paid_from (`DRAWER|SAFE|MOBILE_MONEY|BANK|OWNER`), drawer_session_id (if DRAWER, mandatory), supplier, supplier_tax_id, supplier_invoice_ref / eTIMS invoice no., receipt_photo, created_by, approved_by.
- Expenses are not allowed on CLOSED sessions or past days. Corrections are made as new reversing expense rows, with approval.
- Daily P&L view: `net_cash_flow = cash_takings − drawer_expenses`. Show expenses lacking a receipt photo as a separate warning count.

### Gaps
- No vendor documentation specific to salon expense modules was retrieved.

---

## 6. Employee theft and fraud patterns, and the software controls against them

### Takeaway
In service businesses the dominant leak is **unrecorded or under-recorded services paid in cash**, since there is no inventory to count. Controls must link *work done* (queue or chair time, consumables used) to *money recorded*. Add approval and audit for discounts, voids and refunds, plus customer-facing receipts.

### Cited Findings
- Salon/spa-specific schemes (24 listed): no-bill or paper-only billing; recording a cheaper service; deep discounts on cash bills with the difference pocketed; editing or cancelling bills after collecting cash; redeeming other clients' prepaid, package, voucher or points balances; fake memberships; under-priced custom packages; under-recording duration-based services; duplicate bills; backdated bills; fake expenses; client data exports for poaching. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Recommended controls include: a ticket for every service; utilisation vs billed revenue checks; digital itemised invoices to the client; a "no bill, free service" customer policy; OTP owner approval for edits and cancellations; discount caps by role; flags on late or high-value edits; restricted backdating; and restricted exports. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Commission-driven hair and nail salons carry higher risk, and owners often notice only when shortages or stock variance are already large (vendor claim). — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Vendor-cited statistics (treat with caution): businesses lose ~20% of revenue to workplace theft and fraud; ~60% of retail shrink comes from employees; average shrink is ~1.6%. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)
- Sweethearting, meaning free or discounted service to friends, and misuse of staff discounts are common. Manager sign-off on refunds and voids helps, and theft is more likely with one employee alone at the register. — [OneHub POS](https://www.onehubpos.com/blog/pos-fraud-prevention-how-to-stop-employee-theft-before-profits-disappear); [Groomer to Groomer](https://www.groomertogroomer.com/employee-theft-in-your-shop/)
- Sandbagging (not ringing a sale and pocketing the cash) defeats blind close. The suggested mitigation is forcing the drawer closed between transactions. — [Bepoz](https://bepoz.com/feature/point-of-sale-security)
- Mobile money: fake or edited confirmation SMS and old screenshots shown as proof of payment. — [Safaricom](https://safaricom.co.ke/PartnerNewsletter/highlights/emerging-m-pesa-fraud-tactics)

### Inferences — fraud → control matrix
| Pattern | Control in software |
|---|---|
| Unrecorded cash cut (no ticket) | Walk-in queue/check-in creates the ticket *before* service; chair-time vs billed reconciliation per staff; consumable usage per service; daily "services per staff vs tickets" report; customer receipt by SMS/WhatsApp (customer becomes auditor); signage "If you didn't get a receipt, your service is free" |
| Under-ringing (cheaper service) | Fixed price catalog, price override needs PIN; avg ticket by staff and service-mix anomalies |
| Fake discounts / sweethearting | Reason codes, role caps, manager PIN, discount % per staff report, discounts on cash-paid tickets flagged separately |
| Void/refund after payment | No cancel once paid; voids same-session only + PIN; refunds linked to original; cash-refund-of-noncash flagged; customer notified of refund |
| Tip manipulation | Tip locked at payment; post-close edits PIN + audit; tips attributed per payment |
| Fake mobile money proof | Provider API/statement matching; unique transaction code constraint; unmatched list at close |
| Prepaid/package misuse | OTP/SMS to holder on redemption; balance = ledger sum; redemption-by-staff report |
| Fake expenses | Receipt photo; no backdating; approval above threshold |
| Drawer skimming | Blind close, denomination count, variance trend per cashier, no-sale logs, surprise X-report counts |
| Record tampering | Append-only tables, gapless receipt/Z numbers, hash-chained audit log, role-based permissions, owner remote alerts |
- Owner alerts (push or WhatsApp) for: a void or refund above X; a discount above Y%; a variance outside tolerance; a drawer opened with no sale; a ticket left DONE_UNPAID more than N minutes; unmatched mobile money; a receipt-number gap (should be impossible); an expense on a past date.

### Gaps
- No independent (non-vendor) academic study of theft rates specifically in barbershops or nail salons was found. Industry statistics come from vendor blogs.

---

## 7. Receipts and fiscal / e-receipt requirements

### Takeaway
At minimum a receipt needs the business identity (and tax ID if registered), a sequential number, date and time, itemised lines, tax breakdown, total, tender(s), change and the staff member. Fiscal regimes increasingly require **real-time or near-real-time validation by the tax authority** with a QR code (Kenya eTIMS, Ghana E-VAT, Nigeria NRS e-invoicing), so the receipt pipeline should support a pluggable fiscal adapter and offline queueing.

### Cited Findings
- **EU (simplified invoice, ≤ €100 generally):** issue date; supplier identity; description of goods or services; VAT amount or the data needed to compute it. A document that amends an invoice must clearly reference the original. Member states may extend the simplified invoice to €100–€400 after consulting the VAT Committee. — [Directive 2006/112 Art. 226b](https://www.legislation.gov.uk/eudr/2006/112/article/226b); [Art. 238](https://www.legislation.gov.uk/eudr/2006/112/article/238)
- EU fiscal printer and TSE regimes are national (e.g. Germany, Italy) and add their own rules. — [VATupdate briefing](https://www.vatupdate.com/2025/06/09/briefing-document-eu-vat-directive-2006-112-ec-invoicing/) (national specifics not researched)
- **South Africa (SARS):** no tax invoice is needed for consideration ≤ R50. An abridged tax invoice is allowed for ≤ R5,000, and a full one is needed above R5,000, the full one adding the recipient's name, address and VAT number. Required fields are the words "Tax Invoice"/"VAT Invoice"/"Invoice", the supplier's name, address and VAT number, a serial number, the issue date, a description, the quantity, and the value, tax and consideration. It must be issued within 21 days. — [SARS Tax Invoices](https://www.sars.gov.za/businesses-and-employers/tax-invoices/); [Tax Faculty](https://www.taxfaculty.ac.za/news/read/vat-invoice-requirements) (third parties differ on whether exactly R5,000 counts as abridged)
- **Kenya (KRA eTIMS):** a valid eTIMS receipt shows the supplier's PIN, a QR code and the total amount paid. The system applies to businesses of all sizes, including those not registered for VAT. Small non-VAT businesses can use eTIMS Lite. — [People Daily, July 2026](https://peopledaily.digital/business/kra-outlines-three-features-of-a-valid-etims-receipt/amp); [Beancount guide](https://beancount.io/blog/2026/07/22/kenya-kra-etims-income-expense-validation-guide)
- **Ghana (GRA E-VAT):** reported as mandatory for VAT-registered businesses, including flat-rate scheme members. Invoices are validated by the GRA's VSDC, which returns a signature and QR code. Offline POS can stamp locally and must transmit within 24h of reconnecting. VAT reforms from January 2026 lower the effective rate from ~21.9% to 20%. — [Fonoa Ghana E-VAT 2026](https://www.fonoa.com/resources/blog/ghana-e-vat-e-invoicing-2026); [VATCalc Ghana](https://www.vatcalc.com/ghana/ghana-e-vat-electronic-invoicing-rollout/) (vendor sources; not verified against GRA)
- **Nigeria (NRS, formerly FIRS):** large taxpayers had to adopt e-invoicing by 31 July 2026. Validated invoices carry an Invoice Reference Number and a cryptographic stamp. A second wave of mid-size taxpayers (₦1bn–₦5bn) is reported, with dates that conflict across sources. — [Nairametrics, July 2026](https://nairametrics.com/2026/07/19/nrs-sets-july-31-deadline-for-large-taxpayers-e-invoicing-adoption/); [Gazette NGR](https://gazettengr.com/firs-begins-e-invoicing-electronic-fiscal-system-for-large-taxpayers/)
- Salon controls: send digital itemised invoices to the client, and notify clients of edits, cancellations and redemptions. — [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)

### Inferences
- Receipt fields (universal superset): business legal and trading name, address, tax ID (PIN/TIN/VAT no.), branch; receipt no. (gapless, assigned at close) and ticket no.; date and time with timezone; cashier and staff per line; each line's name, qty, unit price, line discount and line total; ticket discount; subtotal; tax per rate (net, rate, tax); rounding; total; each tender with its reference (last 4 card digits, masked M-PESA code); tendered, change and tip; refund/void reference to the original receipt; fiscal fields (fiscal ID, QR, signature, CU/VSDC serial) when enabled; and a "no receipt, free service" line.
- Delivery: print on 58/80 mm thermal paper, or send by SMS or WhatsApp link to a hosted receipt. In cash-heavy, phone-first markets, the WhatsApp/SMS receipt doubles as a fraud control and builds a customer phone list. Capture consent and mask the number on reports.
- Fiscal adapter pattern: `fiscal_submission`: receipt_id, provider (`KRA_ETIMS|GRA_EVAT|NRS|TSE|NONE`), request, response, status (`QUEUED|SENT|ACCEPTED|REJECTED`), retries. Close the sale locally first, queue the fiscal submission, and retry while offline (Ghana's reported 24h window). Never block the walk-in queue on connectivity, unless the jurisdiction requires validation before issuing the receipt.

### Gaps
- Official KRA, GRA and NRS technical specifications were not retrieved, and vendor and press sources were used instead.
- Fiscal requirements for Uganda (EFRIS), Tanzania (TRA EFD/VFD), Rwanda (EBM) and EU national TSE/fiscal printers were not researched. They should be checked per target market.

---

## 8. Money handling in software (minor units, rounding, currency)

### Takeaway
Store all amounts as **integers in the currency's minor unit**, together with an ISO 4217 currency code. Know each currency's exponent, which can be 0 or 2, and watch for special cases like UGX. Round only at defined points, using a documented mode, and allocate splits with a remainder distribution so that totals always reconcile.

### Cited Findings
- Stripe takes amounts as integers in the smallest currency unit: 1000 = USD 10.00, while for zero-decimal JPY 10 = ¥10. — [Stripe currencies](https://docs.stripe.com/currencies)
- Special case: UGX became zero-decimal, but Stripe still represents it as two-decimal for backward compatibility (5 UGX sent as 500). This shows that the exponent is a per-system convention, so the app must store its own. — [Stripe currencies](https://docs.stripe.com/currencies)
- Stripe rounds fractional invoice amounts resulting from prorations, coupons or tax. — [Stripe currencies](https://docs.stripe.com/currencies)
- HMRC's acceptable intermediate precision: calculate to at least 5 decimal places and round to 4, or truncate at no fewer than 6 decimal places, before final rounding. Rounding to the nearest 1p is acceptable. — [HMRC VATREC12020](https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12020)

### Inferences
- Types: `BIGINT amount_minor` plus `CHAR(3) currency`. Never use float. In TypeScript, use integers or bigint, or a decimal library (e.g. dinero.js / decimal.js) for intermediate tax maths. Percentages are stored in basis points (16% VAT = 1600 bp).
- Single-currency shop by default (KES, GHS, NGN, ZAR, UGX, TZS…). If foreign cash is accepted, record it as a tender with `foreign_amount`, `fx_rate` and `base_amount_minor`. Count it separately in the drawer, by denomination per currency.
- Rounding: half-up (or half-even, if the jurisdiction or accountant prefers) applied once per line tax and once for cash rounding. Allocation uses the largest-remainder method for ticket discounts, split commissions and split tips.
- Invariants checked by tests and DB constraints:
  - `Σ lines − discounts + tax(if exclusive) + rounding = total`
  - `Σ payments = total`
  - `change ≥ 0`, and change only on cash
  - a closed ticket is immutable
  - receipt and Z numbers are gapless per shop/register (allocated in the same transaction as close)
  - instrument balances = Σ ledger rows ≥ 0
- Optional double-entry layer: post each sale as Dr Cash/Card clearing/MoMo clearing/Liability (gift, package) and Cr Service revenue/Product revenue/VAT payable/Tips payable. A refund is the mirror entry. This gives the accountant a trial balance and makes the drawer, the till statement and the bank all reconcile mechanically.

### Gaps
- No primary source was fetched for Martin Fowler's Money pattern or the ISO 4217 exponent table. Developers should consult ISO 4217 and each payment provider's docs for exponents (e.g. KES, GHS, NGN, ZAR = 2; UGX = 0 per ISO, but see the Stripe caveat).
