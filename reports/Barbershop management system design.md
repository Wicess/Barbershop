# Build the counter, not the calendar

A barbershop system built for walk-in counter operations should be designed around three fixed ideas. First, a **ticket whose line items each carry their own staff member, section, price snapshot and commission snapshot**. Second, **append-only money records**: sales, payments, voids, refunds, cash movements and pay adjustments are new rows, never edits. Third, **cash drawer sessions that close blind**, where the cashier counts before seeing the expected total. Everything the owner asked for is derived from those records rather than typed in: totals, commission splits, tips, daily cash-up, the separate pedicure and manicure P&Ls, and role enforcement. This matters because the mainstream salon suites (Fresha, Vagaro, Square, Squire, Booksy) are booking marketplaces with a till attached. They hide walk-in queues and commission behind higher tiers or leave them out. They treat cash and mobile money as second-class tenders. They model "nails" as a service category, not a department with its own staff, stations, consumables and profit. The pay engine has to cover about seven models: straight, tiered, greater-of, hourly-plus, salary, booth rent and daily split. It needs explicit settings for discounts, backbar and fees, and it must follow a fixed 16-step calculation order or totals will drift. Roles follow an industry-standard pattern of four editable presets on top of granular permission keys, with inline manager-PIN approval and a daily exception report. The recommended build is an offline-first installable web app (PWA) that syncs immutable events to Postgres with row-level security. It needs no timer-based polling, which keeps hosting cost near zero.

## Incumbents sell booking and leave four counter gaps open

The market splits into four groups. General salon suites include Fresha, Vagaro, Square Appointments, Mangomint and Phorest. Enterprise quote-only suites include Zenoti and Meevo. Barber apps include Squire, theCut and Booksy. Regional products are built on local payment rails: Spark, Kinara and dPOS in Kenya use M-Pesa, and Trinks in Brazil uses Pix. Basic walk-in checkout is solved. **Fresha's "quick pay"** handles a sale without an appointment, split tender with "part-paid" balances, and tips split **proportionally to each team member's service value** ([Fresha: quick pay](https://www.fresha.com/help-center/knowledge-base/sales/112-collect-payments-using-quick-pay); [Fresha: split payments](https://www.fresha.com/help-center/knowledge-base/sales/114-collect-split-payments); [Fresha: tips](https://www.fresha.com/help-center/knowledge-base/sales/set-up-and-manage-tips)). Fresha computes commission automatically at checkout, splits it by service value on multi-staff work, and adds tips to pay runs ([Fresha: commissions](https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members); [Fresha: pay your team](https://www.fresha.com/help-center/knowledge-base/team/587-paying-your-team-overview)). That is the baseline to match. It is not the differentiator.

The weaknesses cluster in four places, and each is a design brief.

**First, cash and mobile money are second-class.** Fresha's quick pay **requires Fresha's own payment processing to be switched on**, and the shop pays a processing fee on each sale ([Fresha: quick pay](https://www.fresha.com/help-center/knowledge-base/sales/112-collect-payments-using-quick-pay)). Regional products win on exactly this point. Kinara pushes an M-Pesa STK prompt at checkout, auto-generates the receipt, and claims offline operation for KSh 1,900/month ([Kinara](https://gokinara.com/home/)). Trinks splits commission at its card machine and pays professionals by Pix ([Trinks finanças](https://negocios.trinks.com/solucoes/simplificar-financas/)).

**Second, the walk-in queue is missing or paywalled.** A barbershop-focused review says Square has **no walk-in queue and no native commission** ([Razored](https://razoredtech.com/resources/best-barbershop-software/), competitor-authored). Squire's waitlist, commission and rent collection sit behind its **$150/month Executive tier** ([Razored vs Squire](https://razoredtech.com/compare/razored-vs-squire/)). Zenoti's own comparison lists walk-in turn management as absent in Square, Booksy, GlossGenius, Mangomint and Fresha ([Zenoti comparison](https://www.zenoti.com/thecheckin/nail-salon-software-comparison), vendor-published). A whole category of separate queue apps has grown up to fill the gap: WaitQ from $27/month, Waitwhile from $31/month, QueueAway from £14.99 ([WaitQ comparison](https://waitq.app/blog/best-barbershop-queue-apps)). Because the queue and the POS are separate products, wait times and walk-outs never reach the sales or commission data.

**Third, departments are only categories.** Mangomint groups services under admin-created categories ([Mangomint: categories](https://www.mangomint.com/learn/add-categories-and-services/)). No vendor documentation I found describes a true department with its own staff pool, stations, queue, section-scoped manager and P&L. Meevo has granular security roles, but its reporting is described as "quite limited", lacking detail and hard to customise ([Capterra Meevo](https://www.capterra.com/p/172058/Meevo-2/)).

**Fourth, fees pile up and pricing is distrusted.** Square Payroll is a **separate $35/month + $6 per employee** product ([SchedulingKit](https://schedulingkit.com/reviews/square-appointments-review)). Vagaro charges $30/month plus **$10 per bookable calendar**, and payroll is another add-on ([SchedulingKit Vagaro](https://schedulingkit.com/pricing-guides/vagaro-pricing)). Fresha has moved from free to roughly **$14.95 per team member per month** and takes a **20% new-client marketplace fee** ([Pabau](https://pabau.com/blog/fresha-pricing/), competitor-authored). A reviewer alleges Fresha walked back "free forever" ([ProductReview.com.au](https://www.productreview.com.au/listings/fresha)). Booksy reviewers complain of slow payment processing and verification that took over two months ([Capterra Booksy](https://capterra.com/p/142741/Booksy/)).

| Capability | Fresha | Square Appts | Squire | Vagaro | Regional (Kinara/Spark/Trinks) |
|---|---|---|---|---|---|
| Walk-in sale without appointment | Yes, needs Fresha payments | Yes | Kiosk check-in | Yes | Yes |
| Live walk-in queue / turns | Not native (per Zenoti) | No | Waitlist at $150 tier | Partial | Not documented |
| Cash / mobile money as first-class tenders | Custom payment types | Cash yes | Card-centric | Card-centric | M-Pesa STK / Pix native |
| Automatic commission | Yes | Disputed across sources | $150 tier | Yes | Yes (Spark, Trinks) |
| Payroll | Pay runs | $35 + $6/employee add-on | — | ~$34 + $5/employee add-on | Trinks pays via Pix |
| Department P&L (hair vs nails) | Category reports only | Category | — | Category | Not documented |
| Offline | Not documented | Queued card payments, many exclusions | Not documented | Not documented | Kinara claims offline sync |

The offline row deserves a note. Square has the best-documented offline mode, but it must be **enabled before the outage**. It excludes contactless, gift cards, Tap to Pay and keyed cards, and queued payments settle within 24 to 72 hours ([Square offline mode](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode); [Square offline guide](https://squareup.com/ca/en/payments/offline-payments-guide)). For a cash- or mobile-money-heavy shop with unreliable power, the design target is clear. Never block the counter. Record a cash sale, or a mobile-money sale with its reference code, locally, and reconcile later.

The competitive opening is a **payment-agnostic, flat-fee system** that does four things the incumbents do not do together:

1. It records cash, mobile money and any card terminal as equal tenders with reconciliation.
2. It runs an integrated queue → ticket → checkout flow with a separate lane for each section.
3. It treats manicure and pedicure as departments.
4. It ships commission, payroll and cash control in the base product.

On price, a single shop pays roughly $50–150/month for a US/EU incumbent stack. In Kenya the price point is about KES 2,000–3,000/month ([Spark](https://spark.co.ke/); [Kinara](https://gokinara.com/home/)). A weak point in this evidence: no Reddit or owner-community sentiment surfaced in the research. Several "gap" claims also come from competitor-authored comparison pages. The gap pattern is consistent across sources, but each individual claim deserves a check before it goes into marketing copy.

## Cash control rests on immutable tickets and blind drawer sessions

In a service business there is no inventory to count against sales. The dominant leak is therefore **a service delivered and paid in cash but never rung up, or rung up as something cheaper**. MioSalon's catalogue of 24 salon frauds includes:

- no-bill and paper-only billing;
- recording a cheaper service than the one performed;
- deep discounts on cash bills, with the difference pocketed;
- editing or cancelling bills after the cash is collected;
- redeeming other clients' prepaid balances;
- duplicate and backdated bills;
- fake expenses on already-audited dates.

The source is [MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/). It is vendor-authored, and its "20% of revenue lost" statistic should not be quoted as fact. The list of fraud schemes, though, is concrete and maps one-to-one onto software controls. The whole transaction design below exists to close those holes.

### The ticket lifecycle: mutable until paid, then frozen forever

Ledger engineering draws a clean line. Business objects are mutable presentation layers, accounting entries are the source of truth, and "a ledger transaction is mutable while pending and immutable once posted". Late changes are new entries, never edits ([Modern Treasury](https://moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)). Applied to a walk-in counter, that gives this state machine:

```
WAITING → IN_CHAIR → DONE_UNPAID → (ticket) OPEN → AWAITING_PAYMENT → PARTIALLY_PAID → PAID/CLOSED
OPEN → CANCELLED            (only if no payment captured; reason code; kept, never deleted)
CLOSED → VOIDED             (same drawer session, before Z close, manager PIN; reversal rows written)
CLOSED → + REFUND document  (any time, full/partial, manager PIN, references original lines)
```

The two hard rules close the commonest frauds. **A ticket with any captured payment can never be cancelled**; it can only be refunded through a linked document. **The queue creates the ticket before service starts**, so a client who sat in the chair always leaves a record. A ticket that sits at `DONE_UNPAID` longer than N minutes raises an alert, because that window is where cash disappears. EU VAT law already requires an amending document to carry "a specific and unambiguous reference" to the original ([Directive 2006/112 Art. 226b](https://www.legislation.gov.uk/eudr/2006/112/article/226b)). Linked refund and void documents therefore satisfy the tax rule and the fraud control at the same time.

Each `ticket_line` snapshots the following at the moment of sale:

- name, unit price, tax rate and commission rule;
- section (`BARBER | MANICURE | PEDICURE | RETAIL`);
- performer, plus an optional assistant;
- line discount with reason code and approver;
- its share of any ticket-level discount.

Because these are snapshots, later catalogue edits never rewrite history. Staff are attributed per line, not per ticket, which is what makes one haircut-plus-pedicure ticket pay two people and land in two departments.

Discounts come in two kinds. A line discount is something like "student cut −20%". A ticket discount is something like "100 off", and it is **allocated pro-rata across lines by largest remainder**, so the allocated amounts sum to the exact minor unit. Tax and commission are then computed on the post-discount line values.

For tax, inclusive pricing is the norm at a walk-in counter:

- tax-inclusive: `tax = round(gross × r / (1 + r))`
- tax-exclusive: `tax = round(net × r)`

Rates are stored in basis points (16% = 1600). Rounding is half-up per line by default. Always rounding down is not acceptable: HMRC lets retailers round per line or per invoice but forbids rounding VAT down at retail ([HMRC VATREC12020](https://www.gov.uk/hmrc-internal-manuals/vat-trader-records/vatrec12020)).

Where small coins are impractical, **only the cash tender is rounded** to the nearest usable unit, and the difference posts to a cash-rounding account. Card and mobile money pay the exact amount.

### Payments: one row per tender, mobile money verified against the provider

A ticket has many `payment` rows, and it closes only when `Σ payment.amount = ticket.total` and every payment is verified. Each payment row records method, provider, amount and an external reference. Cash payments also record **tendered** and **change** separately, with `change = tendered − amount ≥ 0` and change allowed only on cash.

Mobile money needs a specific defence. Safaricom warns that fraudsters show **edited SMS messages or old screenshots**. Its guidance: "do not accept the customer SMS on their phone as proof of payment… log into your statement to confirm receipt of funds… before releasing goods or offering services" ([Safaricom](https://safaricom.co.ke/PartnerNewsletter/highlights/emerging-m-pesa-fraud-tactics)). The design consequence is a three-level verification ladder, strongest first:

1. A provider API callback, such as Daraja STK push or C2B, auto-matches the payment.
2. The cashier types in the transaction code, and it is matched against the imported till statement at close.
3. Manual "seen on till phone", authorised with a PIN.

A **unique constraint on (provider, external_ref)** stops one SMS from paying two tickets. Any mobile money still unmatched at the Z close becomes an exception.

Overpayment needs a rule too. If a customer sends 550 against a 500 bill, the excess is either given back as change from the drawer, recorded as a linked cash-out, or placed on store credit. It is never silently absorbed.

Gift cards, packages and store credit are **liabilities**, not revenue. Selling one creates the liability, and redeeming it is a tender that draws the liability down. Balances are always the sum of an `instrument_txn` ledger, never an editable number. Redemptions trigger an OTP or notification to the holder, which closes the "redeem another client's package" scam ([MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)).

Card and mobile-money tips are a **liability to staff** and should be settled through payroll or a recorded, attributed payout. One Square user found that paying card tips out of the cash drawer at close "broke" the drawer report and hid who received what ([Square Community](https://community.squareup.com/t5/Archived-Discussions-Read-Only/paying-out-credit-card-tips/m-p/347123)).

### Voids, refunds, returns and corrections are different documents

| Action | When allowed | What is written | Drawer effect | Approval |
|---|---|---|---|---|
| Remove line | Open ticket, before payment | line → REMOVED + audit row | none | role cap, high counts flagged |
| Cancel ticket | No payment captured | status CANCELLED + reason | none | reason code |
| Void | Closed, same drawer session, before Z | reversal document mirroring every line and payment | cash out = original cash | manager PIN |
| Refund (full/partial) | Any time after close | refund document referencing the original lines; tender defaults to original method | cash out if cash | manager PIN; cannot exceed paid − already refunded |
| Return (product) | As refund | refund + inventory movement (restock or write-off) | as refund | manager PIN |
| Correction (wrong staff or price) | After close | reversal + new sale linked by `corrects_id` | net zero if same tender | manager PIN |

Corrections follow the ledger rule. Either reverse and re-post, or post a delta. Never mutate in place, because then "the data is irreversibly destroyed" ([Modern Treasury](https://moderntreasury.com/journal/enforcing-immutability-in-your-double-entry-ledger)).

A **cash refund of a card or mobile-money sale needs extra approval**, since it is a textbook cash-extraction route. Enforce immutability in the database itself, not only the UI. The app's database role should have no UPDATE or DELETE on closed tickets and payments, enforced by trigger. Payment creation should carry an idempotency key, so a retried request cannot post twice.

### The drawer formula, blind close and a worked cash-up

Lightspeed documents the reference formula ([Lightspeed X/Z reports](https://shopkeep-support.lightspeedhq.com/support/reporting/z-and-x-reports)):

> expected cash = opening float + cash sales − cash refunds + pay-ins − drops − pay-outs

An **X report** is a read-only snapshot mid-shift. A **Z report** closes the session and is immutable.

Close **blind**. The cashier counts, ideally by denomination, without seeing the expected figure, "which removes any reason to fudge the count" ([PlumPOS](https://plumpos.com/glossary/blind-cash-count.html)). Blaze ships an "Enforce Blind Cash Drawer Counts" setting with a denomination counter ([Blaze](https://support.blaze.me/hc/en-us/articles/retail-cash-drawer-denomination-counter)). Loyverse lets owners hide expected cash from cashiers and track "cash inaccuracy" per shift ([Loyverse](https://loyverse.com/employee-management)).

Blind close has a known blind spot. It cannot catch a sale that was never rung up ("sandbagging") ([Bepoz](https://bepoz.com/feature/point-of-sale-security)). That is why the queue-creates-ticket rule above carries so much weight.

The session state machine:

```
OPEN → COUNTING → PENDING_REVIEW → CLOSED → RECONCILED
```

| Stage | What happens |
|---|---|
| OPEN | Float counted by denomination; cashier PIN |
| COUNTING | Sales blocked on this drawer; expected figure hidden |
| PENDING_REVIEW | Variance computed; a note is required above tolerance |
| CLOSED | Manager accepts; gapless Z number assigned |
| RECONCILED | Bank deposit recorded |

A shift handover is a blind count by the outgoing cashier and an accept or recount by the incoming one. **One cashier per drawer** keeps variances attributable to a person.

Every "no sale" drawer open is logged with its actor. Over-counts are suspicious as well as shortages, because they can signal unrung sales that were not removed in time.

The worked example below is illustrative; the arithmetic is mine and the formula is Lightspeed's.

| Line | Amount |
|---|---|
| Opening float (counted) | 5,000 |
| + Cash sales (tendered − change) | 42,000 |
| − Cash refund (approved, ticket #1042) | 1,500 |
| + Pay-in (owner top-up of change fund) | 0 |
| − Pay-out: expense, acetone + towels (receipt photo) | 2,000 |
| − Drop to safe mid-shift | 30,000 |
| **= Expected cash in drawer** | **13,500** |
| Counted (blind, by denomination) | 13,200 |
| **Variance (counted − expected)** | **−300 (short)** |
| Float carried to tomorrow | 5,000 |
| **Deposit from drawer (counted − carried float)** | **8,200** (plus the 30,000 safe drop) |

Card and mobile-money totals are reconciled separately against the processor or till statement (`method variance = statement − system`). They never enter the drawer figure.

Neither vendors nor the research publish an acceptable tolerance. Make it a setting, for example ±0.5% of cash sales. Above it a note is mandatory, and a pattern such as three shorts in 14 days triggers an owner alert.

Expenses paid from the till are **pay-outs inside the open session**. Each needs a category, a description and a receipt photo. Expenses can **never be back-dated into a closed day**, which blocks the "fake expense on an audited date" fraud ([MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)). Expenses paid from elsewhere, such as the bank or the owner's mobile money, go in the expense ledger without touching the drawer. In Kenya, expense claims must be backed by eTIMS invoices from 2024, so the expense record should carry the supplier's tax ID and invoice number ([FaidiHR](https://www.faidihr.com/blog/kra-etims-the-no-invoice-no-deduction-era)).

### Receipts are a fraud control and, increasingly, a fiscal document

A receipt sent to the customer by SMS or WhatsApp turns the customer into an auditor. Pair it with signage reading "no receipt, your service is free" ([MioSalon](https://blog.miosalon.com/salon-theft-exposed-24-revenue-leaks-every-owner-must-fix/)).

Fiscal regimes now require real-time validation in several target markets:

- **Kenya.** eTIMS receipts must show the supplier PIN, a QR code and the total. The system applies to businesses of all sizes, including non-VAT ones ([People Daily](https://peopledaily.digital/business/kra-outlines-three-features-of-a-valid-etims-receipt/amp)).
- **Ghana.** E-VAT validates invoices through the GRA's VSDC, which returns a signature and QR code. Offline stamps must transmit within 24 hours of reconnection ([Fonoa](https://www.fonoa.com/resources/blog/ghana-e-vat-e-invoicing-2026)).
- **Nigeria.** Large taxpayers had to adopt e-invoicing by 31 July 2026 ([Nairametrics](https://nairametrics.com/2026/07/19/nrs-sets-july-31-deadline-for-large-taxpayers-e-invoicing-adoption/)).
- **South Africa.** No tax invoice is needed for sales of R50 or less, and an abridged one is allowed up to R5,000 ([SARS](https://www.sars.gov.za/businesses-and-employers/tax-invoices/)).

The right pattern is a pluggable `fiscal_submission` adapter with the statuses QUEUED, SENT, ACCEPTED and REJECTED. Close the sale locally first, queue the submission, and retry while offline. The ticket queue is never blocked unless the jurisdiction demands validation before issue. The official KRA, GRA and NRS technical specs were not retrieved, so check them per market.

Store money as **integers in minor units plus an ISO currency code**. Never use floats. Keep the currency exponent in your own settings: Stripe still represents UGX as two-decimal for backward compatibility even though UGX is zero-decimal ([Stripe currencies](https://docs.stripe.com/currencies)).

The invariants the database and tests must enforce:

- `Σ lines − discounts + tax (if exclusive) + rounding = total`
- `Σ payments = total`
- `change ≥ 0`, and change appears only on cash
- receipt and Z numbers are gapless, allocated in the same transaction as the close
- instrument balance = sum of its ledger rows, and never below zero

## Seven pay models, one calculation order

Pay is where owners and staff fight, and where software most often hides the arithmetic. The research found no authoritative industry survey of split percentages. The ranges below come from vendor guides and should be treated as benchmarks, not standards.

Barbers on commission usually split **50/50 to 60/40 in the barber's favour**, reaching 70/30 or 80/20 for top performers ([Yocale](https://www.yocale.com/blog/barbershop-commission-agreement); [Beancount](https://beancount.io/blog/2026/07/26/booth-rental-vs-commission-barbershop-bookkeeping-guide)). Nail techs sit at **40–60%**, and **who supplies product moves the rate by about 10–15 points**: apprentices 30–40% when the salon supplies everything, senior techs 55–65%, techs supplying their own product 60–70% ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)). Retail commission is a separate **10–15%**.

US booth rent runs **$100–600/week for barbers**, averaging about $220 ([Beancount](https://beancount.io/blog/2026/07/26/booth-rental-vs-commission-barbershop-bookkeeping-guide)), and **$150–400/week for nail techs** ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)).

In Nigeria, barbers are paid by monthly wage (₦60k–₦263k depending on seniority), by commission per cut, or by chair rent (₦70k–₦200k/month). Apprentices are often unpaid ([Profolio.ng](https://www.profolio.ng/barber/salary-guide)).

Brazil's **Lei 13.352/2016** formalises the "house collects everything, then pays out the professional's share" partnership for barbers, manicures and pedicurists. The salon keeps its *cota-parte* and withholds the professional's taxes. The professional's share is not salon revenue, and no employment relationship exists ([Lei 13.352/2016](https://legis.senado.leg.br/norma/602577/publicacao/15652949)). That law proves the daily or periodic percentage split is a formal model, not merely informal practice. Notably, no reliable source documents typical daily split ratios in African or Asian shops. Shops will enter their own.

| Model | Formula (per period) | Where it is common |
|---|---|---|
| Straight commission | `Σ base × rate` | Barbers 50–60%, nails 40–60% |
| Tiered, incremental | each bracket's slice × its rate | Phorest default |
| Tiered, retroactive | `total base × rate of highest bracket reached` | Phorest "apply to full amount" option |
| Greater-of guarantee | `max(hours × floor rate, commission)`, top-up = difference | Nails: "$15/hr vs 45%" |
| Hourly + commission | `hours × rate + base × lower %` | Nails $10–15/hr + 20–35% |
| Salary / monthly wage | fixed, optionally + bonus | Nigerian employed barbers |
| Booth/chair rent | renter keeps 100%; owes rent (− any retail commission offset) | US/UK renters, Nigerian chair rent |
| Daily / percentage split | `day's base × staff share`, paid at close ± advances | Brazil partnership, daily-pay shops |

Tiered commission needs two settings, which Phorest exposes:

- **incremental** (marginal) brackets, the default;
- **"higher brackets apply to full amount"** (retroactive).

On a 10%/20% scale with 1,500 in sales, the incremental method pays 200 and the retroactive method pays 300 ([Phorest](https://phorest.helpjuice.com/337692-higher-commission-brackets-apply-to-full-amount)). Tiers also need a defined period (day, week, pay period or month) and a defined basis (gross, net of discount, or net of backbar). Vagaro even ties nail tiers to rebooking rate (45/50/55%), a KPI that matters little for a walk-in shop ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)).

### The commission base needs explicit settings

Every disputed payslip traces back to an undisclosed choice about what comes off before the split. These vendors expose the choices:

- **Fresha** lets owners deduct discounts, taxes or service costs before commission, per team member ([Fresha](https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members)).
- **Square** has settings for discounts, taxes and processing fees ([Square community](https://community.squareup.com/t5/Staff-Payroll/Is-there-an-option-to-have-discount-on-services-deducted-before/m-p/710217)).
- **Mangomint** supports a **backbar deduction, flat or %, applied pre- or post-commission** ([Mangomint](https://www.mangomint.com/learn/deducting-backbar-fees/)).

Nail techs complain that owners promise a split and then quietly deduct supplies, rent or card fees ([SalonGeek](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570)).

The design answer is a set of named settings with defaults:

- deduct discounts? (default yes)
- deduct tax? (always excluded from the base)
- deduct the card or mobile-money fee? (default no)
- deduct backbar? (flat, %, or actual recipe cost; pre or post)
- deduct third-party fees?

Every deduction then appears line by line on the statement.

Refunds should **claw back commission by default**. Aura Salonware's "Return Commission" flag removes commission on refunded work ([Aura](https://support.aurasalonware.com/hc/en-us/articles/360052074453-Refunds-and-Payroll)). A Square user found that commission computed on gross kept paying on refunded services ([Square community](https://community.squareup.com/t5/Staff-Payroll/Commission-Based-on-Gross-sales-not-Net-Sales/m-p/790929/highlight/true)). Post the clawback as a negative adjustment in the period the refund happens, and never reopen a paid period. Comps and redos are zero-value tickets that earn zero commission unless a flag says otherwise. The research found no vendor documentation on redo handling, so those defaults are design choices.

### Tips are separate, attributed and never part of the base

Under the US FLSA, **tips belong to the employee**. Pools are limited to customarily tipped staff. An employer may deduct only the actual card fee on a card tip, and never below minimum wage ([DOL Fact Sheet #15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa)). Card tips are due by the next regular payday ([DOL 1983 letter](https://dol.gov/sites/dolgov/files/WHD/opinion-letters/legacy/ol_1983-02-23_a.pdf); the letter is old, so confirm it is current).

Nail clients tip **15–25%** ([Zenoti](https://www.zenoti.com/thecheckin/how-do-nail-salons-pay-their-employees)). In Nigeria the typical tip is ₦500–₦1,000 per visit ([Profolio.ng](https://www.profolio.ng/barber/salary-guide)).

On a multi-staff ticket, tips are allocated in one of three ways: as the client directs, pro-rata by service value (Fresha's default), or equally. The "deduct card fee from tips" switch defaults to OFF. Non-US tip law, such as the UK's 2023 Allocation of Tips Act, was not researched and must be set per jurisdiction.

### Worked examples, which double as unit-test fixtures

| # | Scenario | Calculation | Result |
|---|---|---|---|
| 1 | Backbar pre vs post ([Mangomint](https://www.mangomint.com/learn/deducting-backbar-fees/)) | $100 service, 50%, $5 deduction: pre = (100−5)×0.5; post = 100×0.5−5 | **$47.50** vs **$45.00** |
| 2 | Tiers ([Phorest](https://phorest.helpjuice.com/337692-higher-commission-brackets-apply-to-full-amount)) | 5% to 1,000, 10% above; sales 2,000 incremental = 50 + 100 | **150** |
| 2b | Nail tiers 50/55/65% at 500/1,000 ([SalonGeek](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570)), $1,400 week | incremental 250 + 275 + 260; retroactive 1,400 × 0.65 | **$785** vs **$910** |
| 3 | Greater-of ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)) | 38 h × $15 = $570 floor; sales $1,100 × 45% = $495 → top-up $75; sales $1,500 → $675 | **$570** / **$675** |
| 4 | Rent vs commission, salon view ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)) | $1,800 revenue: 50% split → 900 − 180 product − 40 card fees; rent $275 − 40 | salon nets **$680** vs **$235** |
| 5 | Daily split with advance (illustrative) | 12 cuts × 2,500 = 30,000; 40% staff = 12,000; + 2,000 cash tips; − 1,000 advance repayment | payout **13,000**; house 18,000; advance balance 4,000 |
| 6 | Shared ticket (illustrative) | Manicure 30 (A) + pedicure 45 (B), 10% ticket discount 7.50 split 3.00/4.50; bases 27.00/40.50 at 50%; card tip 15 split pro-rata 6/9 | A **13.50** + 6.00 tip; B **20.25** + 9.00 tip |
| 7 | Refund clawback ([Aura](https://support.aurasalonware.com/hc/en-us/articles/360052074453-Refunds-and-Payroll) pattern) | Period 1: $60 at 40% = $24; Period 2 refund posts −$24 | Period 1 untouched |
| 8 | Hybrid (illustrative) | $12 × 40 h = 480; services 2,000 × 25% = 500; retail 300 × 10% = 30; + card tips 180 − 3% fee (where legal) 5.40; − advance 100 | net **$1,084.60** |
| 9 | Renter retail offset ([Vagaro](https://www.vagaro.com/learn/the-quickstart-guide-to-vagaro) pattern) | Rent 250 − (400 retail × 15%) | rent due **$190** |

The engine must apply one fixed order, or the same inputs produce different pay:

1. Take the line price.
2. Subtract the line discount and the allocated ticket discount (if "after discount" is on).
3. Subtract tax (if prices are tax-inclusive).
4. Subtract pre-commission deductions: backbar, third-party fees, and the card fee if configured.
5. The result is the commission base.
6. Allocate the base to performers by share, which must total 100%.
7. Aggregate by period.
8. Apply tiers, incremental or retroactive.
9. Add retail commission.
10. Subtract post-commission deductions.
11. Compare with the guarantee and add any top-up.
12. Add hourly or salary components, where they are additive.
13. Add net tips.
14. Apply staff-ledger items: advances, loan instalments, fines, bonuses, clawbacks.
15. Subtract statutory withholding.
16. The result is net pay.

Everything is computed in minor units, with one documented rounding point.

### Payroll legality is a jurisdiction profile, not a feature

Classification matters. The employment type (employee, renter, partner or apprentice) decides which rules run.

California treats salon commission as real "commission" only if hourly base pay clears a minimum-wage-linked threshold for *all* hours. Otherwise the pay falls under piece-rate rules that require separate pay for rest and non-productive time, and averaging does not cure it ([Ogletree](https://ogletree.com/insights/a-new-look-for-salon-employee-commission-arrangements-in-california); [Behind the Chair](https://behindthechair.com/articles/this-california-law-could-have-a-huge-effect-on-your-salon)). Clock-in data therefore has pay consequences, not just HR ones. On a 50/50 split, US employer payroll taxes push labour cost to about 60–61% of a $100 service ([Booksy](https://biz.booksy.com/blog/salon-commission-split-models)).

Advances, loans and fines have no reliable published practice data. Model them as a signed `staff_ledger` with these entry types:

- advance;
- loan disbursement and loan repayment, with a cap per payout;
- fine, with reason and approver;
- bonus;
- adjustment, with a mandatory note;
- clawback.

Fines and attendance deductions carry a jurisdiction warning flag, because many labour laws restrict them. Lock each period once it is paid, and post later corrections into the next period.

A commission statement must make every number traceable, in this order:

1. ticket-by-ticket sales, with list price, discount, deductions, base, rate and commission;
2. tier bands;
3. retail;
4. clawbacks;
5. hours and the guarantee comparison;
6. tips by method, with any fee;
7. rent or offset;
8. ledger items;
9. net pay;
10. acknowledgement.

## Manicure and pedicure must be departments with stations, recipes and logs

Treating nails as a category in the barber menu fails in five specific ways. The nail catalogue has a different shape. Nail work needs two resources at once. Its consumable cost is an order of magnitude higher. It carries hygiene-logging obligations. And the owner wants its profit separately.

**The catalogue is base service plus modifiers, some priced per nail.** US ranges run roughly as follows ([Zenoti](https://www.zenoti.com/thecheckin/nail-salon-prices); [ThePricer](https://www.thepricer.org/cost-of-manicures-and-pedicures/)):

| Service | Typical US price |
|---|---|
| Basic manicure | $15–45 |
| Basic pedicure | $30–60 |
| Gel manicure | $25–70 |
| Acrylic fill | $25–40 |
| Repair | $5–10 each |
| Nail art | from **$2 per nail**, $5–8 for 3D or acrylic flowers |

Inside barbershops, men's nail services sit at the premium end. Manhattan Barbershop charges **$65 for a 40-minute men's manicure** and $135 for a 95-minute mani-pedi ([Booksy listing](https://booksy.com/en-us/399886_manhattan-barbershop-nyc-midtown-east_barber-shop_30067_new-york-city)). No reliable non-US price data was found, so prices must be fully configurable and currency-agnostic.

The data model needs four modifier types:

- **fixed add-ons**, such as paraffin or callus treatment, which add price, minutes and a recipe;
- **per-unit add-ons**, such as art or repairs, priced as quantity × unit price;
- **replacement variants**, such as gel instead of regular polish, each with its own price, duration and recipe;
- **conditional surcharges**, such as removing another salon's work.

Packages ("Haircut + Men's Pedicure") are a parent line with child lines. **The package price is apportioned to the children pro-rata by list price**, so each child carries revenue into its own department and to its own staff member. Bundles are typically discounted 10–15% ([Zenoti](https://www.zenoti.com/thecheckin/nail-salon-prices)). Price can vary by tech level (junior, senior, master), which Zenoti supports per item, employee or job level ([Zenoti Commission Management](https://www.zenoti.com/platform/commission-management)). In a walk-in shop that price must be **resolved at assignment time and shown to the client before work starts**.

**Nail capacity is the minimum of free qualified techs and free clean stations.** A pedicure needs a nail tech *and* a pedicure chair, and the chair has mandatory downtime. California requires the following after every client:

1. drain, scrub, rinse and refill;
2. circulate EPA-registered disinfectant for **at least 10 minutes**;
3. drain, rinse and dry;
4. **log the date, time, initials and "after a client"**.

End-of-day and weekly cycles are added on top. The log must be shown to clients or inspectors on request ([CA BBC 980.2](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)). Disposable liners must be discarded after each use ([16 CCR 980.4](https://regulations.justia.com/states/california/title-16/division-9/article-12/section-980-4/)).

Model each station as a `Resource` with:

- a type: `BARBER_CHAIR`, `MANI_TABLE`, `PEDI_CHAIR_WHIRLPOOL`, `PEDI_CHAIR_PIPELESS` or `FOOTBATH`;
- a department;
- a status: `AVAILABLE`, `IN_USE`, `CLEANING` or `OUT_OF_SERVICE`.

Closing a pedicure ticket moves the tub to `CLEANING` with a timer. It returns to `AVAILABLE` **only when a tech signs the cleaning entry**, so the compliance log is produced as a by-product of operations.

The walk-in queue then matches the first eligible (tech, station) pair. Eligible means clocked in, not on break, holding the required skill, and in the right section. Ties are broken by fewest weighted turns today, then longest idle. Weighted turns might count a pedicure as 1 and a polish change as 0.5. Requested-tech clients are counted separately from turns. Manager overrides are logged with a reason. Zenoti confirms most nail clients walk in and that the software must track whose turn it is, what each tech has done and how long clients wait ([Zenoti nail guide](https://www.zenoti.com/thecheckin/nail-salon-software-guide)). Half-turn conventions, however, were not confirmed by any source. Show the nail queue separately from the barber queue, because a shop with a single pedicure chair has a very different wait from its four barber chairs.

**Consumables decide nail margin.** Nail product cost is about **8–15% of ticket price** ([Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure); [Zenoti](https://www.zenoti.com/thecheckin/nail-salon-prices)). Barbers carry "zero to minimal" product deductions ([Booksy](https://biz.booksy.com/blog/how-to-run-a-commission-based-salon)).

Software handles this in three ways:

- **MyTime** auto-deducts a per-service recipe, including fractional quantities, only when the service is completed, and returns the stock on cancel ([MyTime](https://help.mytime.com/support/solutions/articles/31000174902)).
- **Phorest** relies on manual "professional use" deductions ([Phorest](https://phorest.helpjuice.com/44079-stock-inventory/305520-how-to-put-through-professional-stock)).
- **Zenoti** compares **projected vs actual consumption**, and refuses to report if no stock audit has happened in three months ([Zenoti consumption](https://help.zenoti.com/en/reports/inventory/consumption/consumption-reports--v1-.html)).

The correct design is hybrid. Recipes give the *theoretical* cost. A gel manicure, for example, is base coat + colour + top coat in ml, cleanser, wipes, **one single-use file and buffer**, an orange stick and cuticle oil. A pedicure adds a liner, pumice, separators, slippers, scrub, lotion and a disinfectant dose. Periodic counts give the *actual* figure: opening + received − closing − retail sold. Variance = actual − theoretical, reported by department and by tech.

Snapshot the recipe cost onto each line at completion so historical margins never move. Keep retail and backbar as **separate stock locations of the same SKU**, for products like cuticle oil that are both sold and used. Disposables are legally single-use in many places. Georgia mandates discarding buffers, files and wooden sticks after one use ([Ga. Comp. R. & Regs. 240-4-.04](https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-240-4-.04)). Low disposable stock is therefore a compliance alert, not just a reorder prompt. No source gives per-application quantities, so the shop must calibrate them itself, for example by weighing bottles over N services.

**Hygiene logs belong in the system, append-only and printable for inspectors:**

- the footspa cleaning log (after-client entries auto-prompted at ticket close; end-of-day and weekly entries as overdue-alerting tasks);
- the immersion disinfection log for metal implements;
- the autoclave cycle and spore-test logs, where used.

Minnesota requires lab spore testing, blocks a device after a positive result, and requires **36 months** of retention ([MN Rule 2105.0377](https://www.revisor.mn.gov/rules/2105.0377/version/2017-11-22%2009:24:51+00:00)). Boston requires a daily sterilizer log kept for a year ([Boston.gov](https://www.boston.gov/node/14772191)). Rules vary by place, so ship a **jurisdiction profile** covering frequencies, retention period and required fields, with retention defaulting to about three years.

### Departmental profit: contribution first, allocated net second

Report each department at three levels. **Gross margin** is service revenue minus recipe consumables minus commission or wages. **Contribution** is gross margin minus directly attributable costs: disposables, laundry, and the department's own equipment. **Net after allocation** subtracts a share of shared overhead.

The allocation basis matters. Occupancy costs (rent, insurance, repairs) follow **floor area**. Supplies follow headcount, shared salaries follow time, and card fees follow sales, which they genuinely track. Allocating everything by sales is explicitly warned against, because expenses rarely follow sales ([NAMM](https://www.namm.org/nammu/finance/plan-profit-one-department-time)). Whatever basis is chosen must be documented and applied consistently ([Tally](https://tallysolutions.com/accounting/departmental-accounting-practical-guide-for-business-success/)).

A sharper alternative is a **station-hour cost rate**, as in Booksy's example of $9,000 overhead ÷ (6 chairs × 200 hours) = $7.50/chair-hour ([Booksy](https://biz.booksy.com/blog/salon-commission-split-models)). Each service is then charged its occupied minutes, *including* tub-cleaning downtime. That exposes the true cost of a 60-minute pedicure against a 25-minute fade.

Here is an illustrative month (my construction, generic currency):

| | Barber | Nails (mani + pedi) |
|---|---|---|
| Service revenue (excl. tax, tips) | 600,000 | 300,000 |
| − Consumables (recipe) | 12,000 (2%) | 36,000 (12%) |
| − Commission (barber 50% of revenue; nails 45% of revenue net of backbar) | 300,000 | 118,800 |
| **= Contribution** | **288,000** | **145,200** |
| − Rent 120,000 by floor area 70/30 | 84,000 | 36,000 |
| **= Net after allocation** | **204,000** | **109,200** |
| Contribution margin | 48% | 48% |

On these numbers the two departments earn the same margin per unit of revenue. The pedicure section's water, heating and chair downtime would show up only under a utility sub-allocation or a station-hour rate. That is exactly why the system should show contribution as the primary decision metric and allocated net as secondary. No published benchmark exists for nail-department gross margin.

Two special cases need explicit handling. Booth-renting techs turn department revenue into **rent income**, not service revenue. Tips are always a pass-through liability, excluded from department revenue.

## Four roles, granular keys, and approval at the moment of risk

Vendors converge on the same model. Loyverse ships **Owner, Administrator, Manager and Cashier** presets. The Owner's rights cannot be changed, every other role is editable, and the rights split into **14 POS rights and 16 Back Office rights**, such as "open cash drawer without making a sale", "view cost of items" and "cancel receipts" ([Loyverse](https://help.loyverse.com/help/how-manage-access-rights-employees)). Square uses Standard, Enhanced and Full permission sets ([Square](https://squareup.com/help/ie/en/article/5822-employee-permissions)). Fresha gates reports at four levels: Full, Can edit, View only and No access ([Fresha](https://www.fresha.com/help-center/knowledge-base/reports/192-manage-report-access-for-team-members)).

**No vendor publishes a default per-role matrix**, so the one below is a synthesis. Store permissions as atomic keys (`sale.void.sameday`, `discount.apply.above_threshold`). A role is a bundle of keys with optional limit values. An assignment is a `(user, role, branch)` row. When a user holds several roles, take the union of their permissions and document that rule. Zenoti's own docs contradict each other on this point ([Zenoti](https://help.zenoti.com/en/configuration/security-configurations/what-permission-would-apply-to-an-employee-assigned-to-multiple-roles-.html)).

Key: Y = allowed; A = needs Manager/Owner PIN; T = allowed up to a threshold; N = not allowed.

| Capability | Owner | Manager | Cashier | Staff (self) |
|---|---|---|---|---|
| Ring up sale, take payment, assign provider | Y | Y | Y | N |
| Discount up to cap (e.g. ≤10%) | Y | Y | T | N |
| Discount above cap / custom / comp | Y | Y (logged) | A | N |
| Price override | Y | Y | A | N |
| Void paid ticket, same session | Y | Y | A | N |
| Void previous-day ticket | Y | Dual control | N | N |
| Refund (full/partial) | Y | Y (reason) | A | N |
| Edit tip after payment | Y | A | N | N |
| No-sale drawer open | Y | Y (logged) | A | N |
| Open/close drawer session | Y | Y | Y (blind) | N |
| See expected cash before counting | Y | Y | N | N |
| Pay-in / pay-out | Y | Y to limit | A | N |
| Record expense | Y | Y | T (with photo) | N |
| Create staff, set roles/PINs | Y | Below Manager only | N | N |
| Edit commission rules / pay rates | Y | Propose only | N | N |
| Payroll report | Y | View, own branch | N | Own earnings |
| Approve pay period / mark paid | Y | A (Owner confirms) | N | N |
| Cash-up report | Y | Y | Own shift | N |
| Profit, cost prices, cross-branch | Y | Own branch, optional | N | N |
| Inventory adjust / write-off | Y | Y (reason) | N | N |
| Settings, payment types, taxes | Y | Printer/device only | N | N |
| Audit log | Y | Own branch, read-only | N | N |
| Hard delete | No one | N | N | N |

Section-scoped supervisors fit naturally: grant Manager rights with a `section_id` scope as well as a branch scope. This is the "section manager" no incumbent documents.

**Approval happens inline, at the moment of risk.** In Loyverse, when an employee attempts a blocked function, a PIN pad opens. An authorised colleague's PIN grants **one-time access** to that single action ([Loyverse](https://help.loyverse.com/help/how-manage-access-rights-employees)). Toast sets a permission level per discount ("Any User" or "Manager") and surfaces voids in a Sales Exception report ([Toast discounts](https://doc.toasttab.com/doc/platformguide/adminDiscountsRequireManager.html); [Toast exceptions](https://support.toasttab.com/en/article/Using-the-Sales-Exception-Report-to-Identify-Voided-Payments-and-Items-for-Re-Opened-Checks?lang=en_US)).

Neither Toast nor the other vendors searched offers **amount-based thresholds**, which makes those a differentiator. Thresholds should be configurable per branch:

- cashier discount, as a % and as an amount;
- refund limit without approval;
- pay-out and expense limits;
- the void window.

The approval modal states the action and amount ("Void KSh 1,500 ticket #1042"). It requires a reason code and writes one `approval` row recording requester, approver, device and timestamp. **No one approves their own request.** A Manager working the till needs the Owner or a second manager above threshold.

When no manager is present, the request goes to the Owner's phone for remote approval. Offline, the ticket stays pending and the cash is not released. **Dual control** applies to these back-office actions:

- voiding a previous-day sale;
- editing a closed cash session;
- changing commission rules mid-period;
- deactivating staff who still have unpaid commission;
- bulk price changes.

A sealed, one-time Owner **break-glass** code covers lockouts. Using it raises a high-severity alert and requires rotation afterwards.

Square's own community shows why **permissions must be enforced on the server, not just by hiding buttons**. Sellers reported staff issuing refunds or discounts with the permission switched off, and Square said an engineer was investigating ([Square community](https://community.squareup.com/t5/Square-for-Retail/Discounts-that-only-Manager-can-apply/td-p/796004)).

**Every action belongs to a person, so there is no shared login.** Square concedes that its shared "team passcode" **does not track sales, time or activity per team member** ([Square](https://squareup.com/help/ie/en/article/5822-employee-permissions)). That destroys commission attribution and the audit trail. The right model has two layers:

1. The Owner or Manager registers the counter device once with a full account. The server issues a branch-bound device credential.
2. Staff switch in with a personal **4–6 digit PIN that works only on registered devices**.

Around that core:

- Lock out after about five failures and log every one.
- Return to the "Who's serving?" PIN pad after each sale or 60–120 seconds idle.
- Re-prompt for a PIN on sensitive actions even when someone is already logged in.
- The Owner signs in with email plus password or passkey and **TOTP 2FA**, and can revoke devices remotely.
- Cached offline permissions expire after 24–72 hours without a sync, so a fired employee cannot keep working offline indefinitely.

**The audit log follows OWASP's who, what, when and where.** Log authentication successes and failures, access-control failures, and use of high-risk functions. Never log secrets. "Build in tamper detection" ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)). In practice that means:

- an append-only `audit_log` with before/after JSON, actor, approver, device and per-device sequence;
- client and server timestamps stored separately, because device clocks drift;
- a hash chain, where each row includes the previous row's hash, recomputed nightly ([DEV Community](https://dev.to/137foundry/how-to-add-tamper-evidence-to-an-existing-audit-table-17f1));
- triggers that block UPDATE and DELETE.

A gap in a device's sequence numbers is itself an alert. Owners do not read raw logs. They read the daily **exception report**: every void, refund, over-threshold discount, price override, no-sale open and approval, grouped by requester and approver. Alongside it they read **cash variance by cashier over time**.

### Reports by role, and KPIs adapted to walk-ins

| Role | What they see |
|---|---|
| Cashier | Own shift cash-up: float, cash sales, paid-in/out, blind count, card and mobile-money totals, ticket count. Variance shown only after they submit. |
| Staff | Own services by section, attributed revenue, commission, tips, retail commission, advances, payout history. Never other staff. |
| Manager | Daily summary; sales by section, staff and payment method; cash-up per session; exception report; expenses; payroll preview; low stock and consumable variance; walk-ins per hour; queue wait and walk-outs. |
| Owner | All branches: profit (revenue − COGS − commission − expenses), department P&L, branch comparison, trends, outstanding commission and tip liability, variance and discount/void totals per person, export. |

The KPI definitions, adapted for walk-ins:

- **Average ticket** = net sales ÷ tickets ([Sola](https://www.solasalonstudios.com/blog/understanding-your-sola-business1)).
- **Clients per day** = tickets per day.
- **Revenue per staff hour** = attributed service revenue ÷ clocked hours.
- **Utilisation** = service minutes ÷ clocked minutes.
- **Retail attach rate** = tickets containing a product and a service ÷ tickets containing a service ([Boulevard](https://www.joinblvd.com/blog/salon-analytics-software)).
- **Discount rate**, **void/refund rate**, and **tips as a % of service**.
- **Queue wait time** and **walk-out rate**, which only an integrated queue can measure.

Zenoti's utilisation benchmark is **76–79% for top salons against a 47–49% median** ([Zenoti](https://www.zenoti.com/thecheckin/salon-revenue-management-guide)). It is appointment-based and vendor-published, so treat it as directional for walk-in shops. Rebooking KPIs drop out entirely, because booking is out of scope.

## An offline-first PWA over append-only Postgres

**Platform: an installable PWA.** One codebase serves the counter tablet or mini-PC, the Manager's laptop and the Owner's phone, with no app store involved. The local database is the primary read/write copy. Options are IndexedDB via Dexie, or SQLite-WASM on OPFS when offline reports need relational queries ([LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/); [OpenReplay](https://blog.openreplay.com/local-first-pwa-architecture/)). Writes go to a **durable, idempotent outbox**, replayed in order with backoff ([OneUptime](https://oneuptime.com/blog/post/2026-01-30-offline-capabilities/markdown)).

Call `navigator.storage.persist()` so the browser does not evict unsynced sales. Safari lacks Background Sync, so also sync on the `online` event.

Printing is the PWA's weak spot. Chrome and Edge on Android or Windows can drive a USB ESC/POS printer through **WebUSB**. iOS Safari cannot, so use a LAN printer through a small print bridge or cloud-polled printing (Star CloudPRNT). A Capacitor or Tauri wrapper comes later, only if native Bluetooth printing becomes essential ([LaunchMyStore](https://launchmystore.help.center/article/1117-pos-hardware-receipt-printer-barcode-scanner-cash-drawer)). The cash drawer plugs into the printer's RJ11 port and **opens on an ESC/POS pulse command** ([unified_esc_pos_printer](https://pub.dev/documentation/unified_esc_pos_printer/3.4.0/)). Fire that pulse after a cash payment, and on a permitted no-sale. Barcode scanners in HID keyboard mode need no driver.

**Sync model: money is events, configuration is documents.** Sales, payments, voids, refunds, cash movements, stock movements, staff-ledger entries and hygiene-log entries are **immutable rows**. They carry client-generated UUIDv7 IDs and per-device human-readable numbers (`B1-T2-000123`). They are pushed with idempotency keys and **only ever appended**, so there are no conflicts to resolve. The server validates each row and re-derives totals. Catalogue, prices, staff, pay plans and settings are server-authoritative and edited online by the Owner or Manager, with version or last-write-wins checks. Field-level LWW suffices for those, while "semantic conflicts need server-side validation" ([OpenReplay](https://blog.openreplay.com/local-first-pwa-architecture/)). Stock going negative offline is accepted and flagged, not blocked.

**Tenancy and security.** Use one Postgres for all tenants, with a NOT NULL `tenant_id` and **row-level security on every table**. Set the tenant context per request. The app must never connect as the table owner, because owners bypass RLS unless FORCE is set ([AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)). Branch and section scopes are enforced by permission checks on every mutation.

Dashboards read **materialised daily summary tables** (`daily_branch_summary`, `daily_staff_summary`, `daily_section_summary`), written when a cash session closes or on sync. They do not run heavy queries on every open.

**Hosting cost: keep the database asleep.** Neon suspends compute after five idle minutes, and suspended compute accrues no CU-hours; the Launch plan is $0.106/CU-hour ([Neon plans](https://neon.com/docs/introduction/plans); [Neon FAQ](https://neon.com/faqs/databases-automatically-scale-serverless-environments)). The owner's own cost playbook (`~/.claude/cost-reduction-playbook.md`) records that open admin dashboards auto-refreshing on timers drove the bills across about 12 similar projects. The rules that follow:

- Sync on outbox write (debounced), `online`, focus/visibility and PIN switch.
- **Never poll from dashboards on a timer.** Refresh on open, focus or pull-to-refresh, and pause when the tab is hidden or idle for about three minutes.
- For a "live" feel, push a cheap change signal and query Postgres only when something changed.
- Cap autoscale at 0.25–1 CU and use the pooled connection string.

Nightly `pg_dump` to object storage, plus an Owner "export all my data" ZIP, complete the backup story. The device database is a cache, not a backup, and unsynced items older than X hours raise a warning.

**Privacy.** Walk-in customers can stay anonymous. Phone capture, used for receipts or the repeat-client rate, carries a separate marketing-consent flag. Card data is never stored; terminals keep the system out of PCI scope. Employee national IDs and bank or mobile-money numbers are encrypted at column level and visible only to the Owner and the person concerned.

Breach rules set the floor. Kenya's DPA requires regulator notice **within 72 hours** ([Bowmans](https://bowmanslaw.com/insights/kenya-a-few-insights-on-navigating-data-breaches-in-kenya-under-the-kenyan-data-protection-law/)), as does Nigeria's NDPA. POPIA requires notice "as soon as reasonably possible" ([Polity](https://www.polity.org.za/article/when-the-clock-starts-ticking-why-cross-border-data-breach-response-demands-more-than-good-intentions-2026-09-18)). A 72-hour runbook and a breach register are therefore the baseline. Financial records are anonymised rather than deleted, because tax retention duties override erasure. Per-country retention periods were not verified.

### Core data model

```
tenant(id, name, currency, currency_exponent, timezone, jurisdiction_profile, settings)
branch(id, tenant_id, name, address, tax_id, receipt_footer)
section(id, branch_id, name, kind[BARBER|MANICURE|PEDICURE|RETAIL])
resource(id, section_id, type, status)                       -- chairs, mani tables, pedi tubs
app_user(id, pin_hash, email?, password_hash?, mfa_secret?)   -- logins
staff(id, user_id?, employment_type, primary_section_id, skills[], licences[], pay_plan_id, payout_details_enc)
role / permission(key) / role_permission(role, key, limit) / user_role(user, role, branch?, section?)
device(id, branch_id, credential_hash, revoked_at)
attendance(staff_id, clock_in, clock_out, breaks)
service(id, section_id) → service_variant(price, duration, recipe_id) → price_override(staff_level|staff)
modifier(id, kind[FIXED|PER_UNIT|SURCHARGE], price, minutes, recipe_id)
inventory_item(sku, type[RETAIL|BACKBAR|DISPOSABLE], use_unit, cost_per_use_unit)
recipe(id) / recipe_line(recipe_id, item_id, qty)
queue_entry(id, section_id, requested_staff_id?, status[WAITING|IN_CHAIR|DONE_UNPAID|PAID|WALKED_OUT], ticket_id)
ticket(id, branch_id, device_id, number, drawer_session_id, status, totals…, receipt_no, fiscal_ref)
ticket_line(id, ticket_id, parent_line_id?, section_id, resource_id?, variant_id, qty,
            name/price/tax/commission_rule SNAPSHOTS, line_discount, alloc_ticket_discount,
            recipe_cost_snapshot, commission_base)
line_performer(line_id, staff_id, role[LEAD|ASSISTANT], share_pct, commission_amount)
payment(id, ticket_id, method, provider, amount, tendered, change, external_ref UNIQUE(provider),
        verification_status, idempotency_key)
tip_allocation(payment_id, staff_id, amount, fee_deducted)
refund / reversal(id, original_ticket_id, lines, tenders, reason_code, approval_id)
instrument(id, kind[GIFT|PACKAGE|CREDIT]) / instrument_txn(instrument_id, delta, ticket_id)
drawer_session(id, register_id, z_no, opening_float, opening_count_json, counted, counted_json,
               expected_frozen, variance, variance_note, reviewed_by, status, carried_float, deposit)
cash_movement(id, session_id, type[PAY_IN|PAY_OUT_EXPENSE|DROP|NO_SALE|…], amount, approval_id)
expense(id, branch_id, category, amount, paid_from, session_id?, supplier_tax_id, invoice_ref, receipt_url)
pay_plan(id, base, service_commission{flat|per_service|tiered_incremental|tiered_retroactive},
         retail_rate, rent, guarantee, deduction_settings)
pay_period(id, status[OPEN|LOCKED|PAID]) / payout(period, staff, components…, net)
staff_ledger(staff_id, kind[ADVANCE|LOAN|REPAYMENT|FINE|BONUS|ADJUSTMENT|CLAWBACK], amount, ref, approver)
stock_movement(item_id, location[RETAIL|BACKBAR], delta, type, ref)
hygiene_log(resource_id, kind[AFTER_CLIENT|END_OF_DAY|WEEKLY|NOT_IN_SERVICE|STERILIZE|SPORE_TEST],
            ticket_id?, product, contact_minutes, staff_id, result?)
approval(id, action, amount, requested_by, approved_by, reason_code, device_id)
fiscal_submission(receipt_id, provider, status, retries)
audit_log(id, device_id, device_seq, actor, approver, action, entity, before, after, client_ts, server_ts, prev_hash, hash)
daily_branch_summary / daily_section_summary / daily_staff_summary   -- materialised rollups
```

The structural decisions that make everything else work:

- **User and staff are separate.** A cashier may also cut hair, and a nail tech may never log in.
- **Attribution lives on the line**, through `line_performer`. Commission, section revenue and tips all roll up from there without double counting.
- **Balances are always sums.** Drawer, stock, gift card and staff-ledger balances are each the sum of their ledger rows.
- **Nothing is ever hard-deleted.**

## Conclusion

The most important finding is that owner trust depends on **visible arithmetic**, not on any single feature. The commonest complaints all come down to numbers the owner or the staff member could not see or audit:

- hidden fees;
- undisclosed pay deductions;
- commission paid on refunded work;
- tips paid out of the drawer;
- category reports that cannot answer "is my pedicure chair profitable?"

The design here makes those numbers inspectable. Snapshotted lines carry their own performer and cost. Pay settings are explicit, and statements trace each figure line by line. Drawer and stock balances are derived from ledgers, and voids and discounts surface in a daily exception report. That turns the system from a record-keeper into an arbiter both sides accept. It is a stronger position than competing on booking features the shop does not want.

Two implications follow for building it. The walk-in queue is not an add-on. It is the **primary fraud control**, because it creates the ticket before the service and so defeats the unrung-sale leak that blind cash counts cannot catch. It is also the only source of wait-time and walk-out data. Second, three things vary by country: pay legality, tip rules, fiscal receipts and hygiene logging. These belong in a **jurisdiction profile** from the start, not hard-coded. The evidence is thinnest exactly where this shop is most likely to operate: daily split ratios, advance practices, and MTN MoMo or Airtel verification flows. So the first deployment should be treated as calibration. Capture the shop's real split rules, consumable quantities and variance tolerances as settings, then tighten the defaults from real data.
