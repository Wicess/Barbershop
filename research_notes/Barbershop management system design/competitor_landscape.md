# Competitor Landscape: In-Shop / Counter-Side Operations for Barbershop + Nail (Manicure/Pedicure) Businesses

Research date: 2026-10-22. Sources were mostly vendor help centers, vendor pricing pages as reported by third-party pricing guides, and review aggregators. Many third-party pricing pages conflict with each other. The conflicts are noted below. Online booking is deliberately out of scope.

Method caveat: the search tool returned summarised results. Where a fact comes from a vendor-competitor's comparison page (Razored, SHIFT, GlossGenius, WaitQ, Pabau), treat it as potentially biased.

## Which products are relevant?

### Takeaway
The field splits into four groups: (1) general salon/spa suites (Fresha, Vagaro, Square Appointments, Mangomint, Phorest, GlossGenius, Boulevard, Timely); (2) enterprise/multi-location suites with quote-only pricing (Zenoti, Meevo, SalonBiz, Shortcuts); (3) barber-specific apps (Squire, theCut, Booksy, Barberly, Razored, SHIFT); and (4) regional products built around mobile money or local payment rails. Examples are Spark, Kinara, dPOS, mumo POS and Veira in Kenya/East Africa, and Trinks and AgendaPro in Brazil and Latin America. Standalone walk-in queue tools (WaitQ, Waitwhile, QueueAway, eWAIT, Slikr) fill a gap that most suites leave.

### Cited Findings
- Fresha markets salon software with POS, team permissions, commissions and pay runs — [Fresha features](https://www.fresha.com/for-business/features)
- Zenoti says it serves 30,000+ beauty and wellness businesses in 50+ countries, from single salons to large brands — [SaaSworthy Zenoti pricing](https://www.saasworthy.com/product/zenoti/pricing)
- Meevo targets single-location shops, multi-location enterprises and franchises. It has 6 quote-only plans (Lite, Essential, Premier, Enterprise, plus two MeevoMD med-spa plans) — [Capterra Meevo pricing](https://www.capterra.com/p/172058/Meevo-2/pricing/)
- Barber-specific options compared in 2026 include Squire, Booksy, theCut and others — [Codersy: best barber booking apps 2026](https://codersyapps.com/blog/best-barber-booking-apps); [Razored: 9 platforms compared](https://razoredtech.com/resources/best-barbershop-software/)
- **Kenya:** Spark is Kenyan salon/spa/barbershop software with M-Pesa checkout, commission tracking and WhatsApp booking. Its Professional tier is listed at KES 2,500/month — [Spark](https://spark.co.ke/)
- **Kenya:** Kinara offers M-Pesa POS with STK push at checkout. The money lands in the shop's till and the receipt is generated automatically. The "Chair" plan is KSh 1,900/month, and Kinara claims the POS works offline and syncs later — [Kinara](https://gokinara.com/home/)
- **Kenya:** dPOS targets salons and barbershops ("kinyozi"), covering appointments, product sales and M-Pesa — [dPOS salon](https://dpos.co.ke/pos-for/salon)
- **East Africa:** mumo POS is an all-in-one system for salons and retail, taking cash, mobile money and card — [mumo POS](https://app.mumopos.com/)
- **Kenya:** Veira sells mobile-money *agent* software to barbershops, a common side business. It tracks M-Pesa sends and cash-outs, issues eTIMS (KRA tax) receipts, and lists free POS hardware from KES 2,999/month — [Veira](https://veirahq.com/solutions/mobile-money-agents-for-barbershops/)
- M-Pesa operates in Kenya, Tanzania, Lesotho, DRC, Ghana, Mozambique, Egypt and Ethiopia — [Wikipedia: M-Pesa](https://en.wikipedia.org/wiki/M-Pesa)
- **Brazil:** Trinks calculates barber commissions automatically. Its "Belezinha" card machine can split and pay commissions, and its Stone-backed account can pay professionals by Pix. Pix is supported as a payment method — [Trinks barbearias](https://negocios.trinks.com/negocios/barbearias/); [Trinks finanças](https://negocios.trinks.com/solucoes/simplificar-financas/)
- **Brazil:** Trinks is listed at R$110/month for 1–2 professionals, with quotes for 3+, and WhatsApp messaging costs extra (third-party guide) — [Barbeiro.app: alternatives to Trinks](https://www.barbeiro.app/alternativas/trinks)
- **Brazil:** Other barbershop tools advertise "agenda 24h, WhatsApp, Pix e comissão" as the standard bundle — [ModoGestor](https://modogestor.com.br/sistema-para-barbearia/)
- **Latin America:** AgendaPro is a modular suite (CRM, inventory, commissions, API) with plans that vary by market. This comes from a competitor's comparison page — [Relinq vs Trinks/AgendaPro](https://relinqbeauty.com.br/comparativo-relinq-trinks-agendapro)

### Inferences
- Regional products compete on **local payment rails** (M-Pesa STK push, Pix), **WhatsApp** messaging and **low flat pricing in local currency**. Global players compete on booking marketplaces and card processing.
- In mobile-money markets, barbershops often run side revenue lines, such as mobile-money agency and product retail. A design that treats "non-service revenue streams" as first-class fits these markets.

### Gaps
- I found no reliable sources on MTN MoMo-integrated salon POS products (Ghana, Uganda, Nigeria, Cameroon), Nigerian products (e.g. Paystack- or Flutterwave-based), South African products, or Asian products (India, SE Asia, Philippines GCash). These need a dedicated search.
- I did not research Phorest, GlossGenius, Boulevard, Timely, Shortcuts, SalonInteractive or Booksy's counter features in depth.

## How does each handle walk-in tickets and checkout (sale creation, staff assignment, multi-staff tickets, split payments, tips, discounts, refunds/voids)?

### Takeaway
Walk-in "quick sale" checkout, split tender, tips and per-line staff assignment are **standard** in mature suites (Fresha documented in detail). The differentiators are **how tips and commission are split across multiple staff on one ticket** (Fresha splits proportionally by service value) and **who may take payments**, which is permission-gated. Refund and void workflows were not well documented in what I found.

### Cited Findings
- **Fresha quick pay** (walk-in sale without an appointment) requires Fresha payment processing to be on. Any team member with the relevant permission can take quick payments, and a standard processing fee plus an authorisation fee applies — [Fresha: quick pay](https://www.fresha.com/help-center/knowledge-base/sales/112-collect-payments-using-quick-pay)
- **Fresha split payment** works like this: add items, add a tip, choose "Split payment", enter the first card's amount, then "Save part-paid". The remaining balance then shows for the next tender — [Fresha: split payments](https://www.fresha.com/help-center/knowledge-base/sales/114-collect-split-payments)
- **Fresha payment types:** custom payment methods can be added. Configuring them requires the Point of sale permission — [Fresha: payment types](https://www.fresha.com/help-center/knowledge-base/sales/126-add-and-manage-payment-types)
- **Fresha tips** can be collected at checkout, on the card terminal, or later via a post-visit message. Tips are split proportionally to the value of each team member's services on the sale. Fresha recommends no more than three preset tip options — [Fresha: tips](https://www.fresha.com/help-center/knowledge-base/sales/set-up-and-manage-tips)
- Fresha also offers client self-checkout — [Fresha: self checkout](https://www.fresha.com/help-center/knowledge-base/payments/110-collect-payments-using-self-checkout)
- **Mangomint** has an "Admin vs Normal" user model with permission categories that include Sales and Cash Drawer. The exact names of the refund, void and discount permissions were in a portion of the page I could not read — [Mangomint: staff permissions](https://www.mangomint.com/learn/staff-member-permissions/)
- **Trinks**' card machine can split payment and commission at the point of sale — [Trinks barbearias](https://negocios.trinks.com/negocios/barbearias/)
- **Kinara:** STK push at checkout, money goes to the till, and the receipt is generated automatically — [Kinara](https://gokinara.com/home/)
- **Square** in-person processing is 2.6% + 15¢ on Free, 2.5% + 15¢ on Plus and 2.4% + 15¢ on Premium (third-party summary of the official page) — [SchedulingKit Square review](https://schedulingkit.com/reviews/square-appointments-review)

### Inferences
- Several platforms tie walk-in checkout to their own processing: Fresha quick pay requires Fresha payments, and theCut's Mobile Pay is in-house. Shops that are cash- or mobile-money-heavy may therefore find "record a cash or M-Pesa sale" second-class or impossible in some global products. A custom build should treat cash and mobile money as first-class tenders with reconciliation.
- The Fresha pattern is a good baseline: ticket line items each carry a staff member, tips are split proportionally by service value, and split tender works with part-paid balances. Allowing a manual tip allocation override is a likely differentiator, because proportional splits are not always what shops want. This is an inference, not sourced.

### Gaps
- Refund/void flows (manager approval, reason codes, partial refunds) for Fresha, Vagaro, Square and Booksy were not retrieved.
- Discount handling (manual vs preset, permission-gated) was not retrieved for any vendor.

## What walk-in queue / waitlist features exist (non-booking)?

### Takeaway
A true **live walk-in queue** (who is next, per barber or "any barber", with estimated wait) is the weakest area of the mainstream suites. Square reportedly lacks one. Squire gates its waitlist behind the $150/month tier, and its waitlist mainly fills cancellations rather than running a live queue. A whole category of add-on queue apps exists to fill this gap, which signals unmet demand.

### Cited Findings
- A barbershop-focused review says Square lacks walk-in queue management and native commission handling, so shops pay for other tools — [Razored: best barbershop software 2026](https://razoredtech.com/resources/best-barbershop-software/) (competitor-authored)
- Square's waitlist feature starts on the Plus plan ($49/location/month) — [SchedulingKit Square review](https://schedulingkit.com/reviews/square-appointments-review)
- **Squire** has a front-desk kiosk for check-in. Its waitlist fills gaps when a barber is fully booked: the first person on the list is notified and has 10 minutes to claim the slot. The reviewer found no live remote walk-in queue in Squire's public docs — [WaitQ: barbershop queue apps](https://waitq.app/blog/best-barbershop-queue-apps) (competitor-authored)
- Squire's waitlist requires the Executive plan at $150/month per shop — [Razored vs Squire](https://razoredtech.com/compare/razored-vs-squire/); [Software Advice Squire](https://www.softwareadvice.com/barbershop/squire-profile/)
- Mangomint has a "Can manage waitlist" staff permission — [Mangomint: staff permissions](https://www.mangomint.com/learn/staff-member-permissions/)
- Standalone queue tools and their pricing (vendor-authored comparison):
  - **WaitQ:** from $27/month, remote QR check-in, WhatsApp; no POS
  - **Barberly:** from $25/month; kiosk check-in, no remote queue
  - **QueueAway:** from £14.99/month; walk-in only, dated UI
  - **Slikr:** free tier or $10/week; charges clients a fee to queue ahead
  - **Waitwhile:** from $31/month with 250 visits per location, and cancellations and no-shows count toward the cap

  Source: [WaitQ comparison](https://waitq.app/blog/best-barbershop-queue-apps)
- **eWAIT:** $9/month digital waitlist. Customers join by phone and choose "Wait In-Shop" or "Text Me When Ready" — [AlternativeTo listing](https://alternativeto.net/software/barber-shop-booking)
- **Setora:** walk-in kiosk support, £39/month per location, SMS billed separately — [G2 Setora](https://www.g2.com/products/setora/discuss)
- Another 2026 roundup of barbershop waitlist apps — [ScanQueue](https://scanqueue.com/blog/best-waitlist-apps-barbershops)

### Inferences
- The common pain is that the queue tool and the POS are separate products. Walk-in data (wait time, which barber was requested, who walked out) never reaches sales or commission reports. An integrated queue → ticket → checkout flow is a clear differentiator for a walk-in-heavy shop.
- A queue with separate lanes per section (barber chairs vs manicure vs pedicure stations), plus "any available" vs "specific staff", appears to be unaddressed in the products I reviewed.

### Gaps
- I found no source quantifying the walk-in share of barbershop traffic.
- theCut's, Booksy's and Fresha's walk-in queue capabilities were not confirmed.

## How do they handle commission, payroll, tip payouts and chair/booth rental?

### Takeaway
Automatic commission at checkout feeding a pay run is standard in Fresha, Mangomint and Trinks. Payroll is often a **paid add-on** (Square, Vagaro). **Booth/chair rent collection** is mainly a barber-specific feature (Squire, gated to the $150 tier). Paying staff directly through the platform (Trinks via Pix) is a regional differentiator.

### Cited Findings
- **Fresha** tracks commission automatically when a sale is checked out. On multi-staff appointments, commission is split by each person's service value — [Fresha: commissions](https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members)
- **Fresha** adds tips to pay runs automatically, whether collected online or at checkout — [Fresha: pay your team](https://www.fresha.com/help-center/knowledge-base/team/587-paying-your-team-overview)
- **Mangomint** has a Payroll report gated by Admin status or the "Can view Payroll app" permission — [Mangomint: payroll report](https://www.mangomint.com/learn/payroll-report/)
- **Square Payroll** is a separate product: $35/month plus $6 per active employee — [SchedulingKit Square review](https://schedulingkit.com/reviews/square-appointments-review)
- Sources conflict on whether Square Appointments includes commission tracking. One review says Premium includes it, another lists it generally, and a barbershop review says it is not native — [SchedulingKit](https://schedulingkit.com/reviews/square-appointments-review); [Razored](https://razoredtech.com/resources/best-barbershop-software/)
- **Vagaro Payroll** is an add-on at about $34/month + $5 per employee. Figures differ across sources — [SchedulingKit Vagaro pricing](https://schedulingkit.com/pricing-guides/vagaro-pricing); [GlossGenius on Vagaro cost](https://glossgenius.com/blog/vagaro-cost)
- **Squire:** commission and rent collection require Executive ($150/month per shop) — [Razored vs Squire](https://razoredtech.com/compare/razored-vs-squire/)
- **Trinks** calculates commission automatically, can split it at the card machine, and can pay professionals via Pix from its Stone account — [Trinks finanças](https://negocios.trinks.com/solucoes/simplificar-financas/)
- **Spark** (Kenya) includes commission tracking — [Spark](https://spark.co.ke/)
- **Zenoti** markets commission management as a core feature (vendor content) — [Zenoti: POS for salon and spa](https://www.zenoti.com/es/thecheckin/pos-system-for-salon-and-spa)

### Inferences
- Shops run mixed staff models: commission staff, chair renters and salaried techs. A system needs per-staff compensation profiles (commission %, flat rent per period, or hybrid) and should handle whether product sales and tips are included in the commission base.
- Products disagree on whether processing fees are deducted before commission is calculated. No source I found clarified this. It matters, and a custom build should make it an explicit setting.

### Gaps
- Tiered/sliding-scale commission, product-vs-service commission rates, and commission on discounted prices were not documented in retrieved sources.
- Vagaro's booth-rent handling and Fresha's rent features were not confirmed.

## How do they model separate departments/sections (hair vs nails), and departmental reporting?

### Takeaway
Most products model "sections" only through **service categories**, not true departments with their own staff pool, stations, queue or P&L. Enterprise suites (Meevo, Zenoti) offer finer-grained structures and roles, but reporting there gets mixed reviews. Little public documentation exists, so this is a likely design gap and differentiator.

### Cited Findings
- **Mangomint:** services sit under categories created by admins or staff with "Can manage service settings". A category can be hidden from general online booking — [Mangomint: categories and services](https://www.mangomint.com/learn/add-categories-and-services/)
- **Meevo** offers highly granular security roles, menu hiding, employee-specific permissions and IP restrictions. Its reporting is often described as lacking detail, hard to customise and hard to navigate — [US Tech Automations: Phorest vs Meevo](https://ustechautomations.com/resources/blog/phorest-vs-meevo-multi-location-salons-2026) (low-authority blog); [Capterra Meevo](https://www.capterra.com/p/172058/Meevo-2/)
- Vagaro prices by "bookable calendar" (a per-resource model), at $30/month base (promo $23.99) plus $10 per additional calendar up to 7. Seven or more calendars cost $83.99/month — [SchedulingKit Vagaro pricing](https://schedulingkit.com/pricing-guides/vagaro-pricing); [Capterra Vagaro pricing](https://www.capterra.com/p/153752/Vagaro/pricing/)

### Inferences
- In a barbershop with separate manicure and pedicure sections, the owner will want revenue, commission, queue and staff utilisation **per section**, and possibly section-specific cashiers or supervisors. Category-level sales reports in generic suites approximate this, but they do not give a section-scoped manager role or section-scoped queue. This is an unsourced inference drawn from the absence of documentation.

### Gaps
- I found no vendor documentation explicitly describing "departments" for Fresha, Vagaro, Square, Phorest, Zenoti or SalonBiz. Zenoti and Meevo likely have "service categories/departments" reports, but this is not confirmed.

## What user roles/permissions do they ship, and how granular?

### Takeaway
The range runs from a simple **Admin vs Normal with per-permission toggles** (Mangomint) to **custom permission sets** (Fresha, Square) to **enterprise security roles with IP restrictions** (Meevo). Point-of-sale, cash drawer, reports and payroll are consistently separate gates.

### Cited Findings
- **Mangomint:** Admin users have all permissions, which cannot be disabled. Normal users get permissions toggled individually. Categories are Calendar, Client, Sales, Phone, Reports, Product, Gift Card, Packages, Memberships, Cash Drawer, Time Clock, Payroll, Forms, Resources, Campaigns, Flows, Offers, Setup & Management, and User Profile. Example calendar permissions are "Can view other people's calendar", "Can book and change other people's appointments" and "Can manage waitlist". Reports need Admin or a company-reports permission — [Mangomint: staff permissions](https://www.mangomint.com/learn/staff-member-permissions/); [Mangomint: payroll report](https://www.mangomint.com/learn/payroll-report/)
- **Fresha:** each team member has their own login, and custom permissions control what they can see and do, including selling products and checking out appointments. Point of sale is a permission — [Fresha features](https://www.fresha.com/for-business/features); [Fresha: payment types](https://www.fresha.com/help-center/knowledge-base/sales/126-add-and-manage-payment-types)
- **Square Appointments:** team permission sets range from "own calendar only" to managing the whole business. One review lists custom permissions as Premium-only, so the tier is unclear — [SchedulingKit Square review](https://schedulingkit.com/reviews/square-appointments-review)
- **Meevo:** granular security roles, menu hiding, employee-specific permissions, IP restrictions and offsite access controls — [US Tech Automations](https://ustechautomations.com/resources/blog/phorest-vs-meevo-multi-location-salons-2026) (low authority)

### Inferences
- The baseline for a new system is role presets (Owner, Manager, Front desk/Cashier, Staff) plus per-permission overrides. The Mangomint category list is a good checklist. Owners of cash-heavy shops will specifically want gates on void, refund, discount, open drawer without sale, and edit closed ticket.

### Gaps
- The exact sales-permission names (refund, void, discount) for Mangomint were not retrieved because of page truncation. Vagaro, Booksy, Phorest and Zenoti role lists were not retrieved.

## Pricing models (per-staff, per-location, % of payments)

### Takeaway
There are four models. **Per location** (Square $0/$49/$149, Squire $30–$250 per shop). **Per bookable calendar or staff** (Vagaro +$10/calendar, Fresha ~$14.95 per team member). **Quote-only enterprise** (Zenoti ~$300+/month, Meevo, SalonBiz). **Local-currency flat plans** in emerging markets (Kinara KSh 1,900, Spark KES 2,500, Trinks R$110). Nearly all of them also earn from card processing (~2.2–3.5% plus a fixed fee), and some add marketplace commissions.

### Cited Findings
- **Square Appointments** (as of September 2026): Free $0, Plus $49, Premium $149 per location per month. One outdated review lists $29/$69 — [SchedulingKit Square review](https://schedulingkit.com/reviews/square-appointments-review); [Capterra Square Appointments](https://www.capterra.com/p/170263/Square-Appointments/)
- **Squire:** Independent $30 (1 barber), Pro $50 per shop, Executive $150 per shop (adds rent collection and marketing), Titan $250 per shop (multi-location, branded app). Processing is reported as 2.5% + 20¢ in person and 2.9% + 30¢ online, though another source says rates are undisclosed. Competitors claim extra add-ons and client booking fees — [Razored vs Squire](https://razoredtech.com/compare/razored-vs-squire/); [WaitQ](https://waitq.app/blog/best-barbershop-queue-apps); [SHIFT vs Squire](https://www.goingshift.com/compare/squire/)
- **Vagaro:** $30/month (promo $23.99) plus $10 per calendar. Processing is 2.6% + 10¢ dip/tap and 3.5% + 19¢ keyed for merchants under $4k/month. Add-ons include text marketing at $20/month and forms at $10/month — [SchedulingKit Vagaro](https://schedulingkit.com/pricing-guides/vagaro-pricing); [Vagaro card processing](https://www.vagaro.com/pro/card-processing)
- **Fresha:** sources conflict. Pabau (July 2026) reports $19.95/month Individual and $14.95 per team member/month Team. Euro sources list ~€12.95 and €8.95 per member. SchedulingKit (April 2026) still says plans start at $0, which reflects the earlier free model. Pabau also reports a 20% new-client marketplace fee (min $6) and processing of ~2.19–3.30% + $0.20 — [Pabau: Fresha pricing](https://pabau.com/blog/fresha-pricing/) (competitor-authored); [CostBench](https://www.costbench.com/software/salon-spa/fresha/); [Toolradar](https://toolradar.com/tools/fresha/pricing)
- **theCut:** free Lite plan; PRO is $20/month per the help center, though a blog says $25. Mobile Pay charges the barber 2.75% and the client a $0.95 fee. Instant payout costs 1.5% — [theCut help: fees](https://help.thecut.co/en/articles/9156628-understanding-thecut-s-pro-subscription-and-transaction-fees); [theCut blog](https://www.thecut.co/blog/why-thecut-is-the-best-app-for-barbers)
- **Zenoti:** custom pricing; one listing shows from $300/month — [SaaSworthy](https://www.saasworthy.com/product/zenoti/pricing)
- **Meevo:** quote-only, though one site lists $139/month — [Capterra Meevo pricing](https://www.capterra.com/p/172058/Meevo-2/pricing/); [G2 Meevo](https://www.g2.com/products/meevo/pricing)
- **SalonBiz:** contact for pricing — [G2 SalonBiz pricing](https://www.g2.com/products/salonbiz/pricing)
- **Regional:** Kinara KSh 1,900/month; Spark KES 2,500/month; Veira from KES 2,999/month with free hardware; Trinks R$110/month for 1–2 pros — [Kinara](https://gokinara.com/home/); [Spark](https://spark.co.ke/); [Veira](https://veirahq.com/solutions/mobile-money-agents-for-barbershops/); [Barbeiro.app](https://www.barbeiro.app/alternativas/trinks)

### Inferences
- For a single shop with ~6 chairs plus nail stations in the US/EU, the subscription alone typically runs ~$50–$150/month before processing and add-ons (payroll, SMS, waitlist tier). A custom build competes against this total cost plus processing margin. In Kenya, the incumbent price point is roughly KES 2,000–3,000/month (≈ US$15–25 at typical rates; the conversion is mine).

### Gaps
- Booksy Biz, Phorest, GlossGenius, Boulevard, Timely and Mangomint current pricing were not retrieved.

## Common user complaints from reviews

### Takeaway
The recurring themes are **fees**: processing fees, marketplace new-client commissions, client booking fees, and add-ons that pile up. Next come **payout delays and onboarding friction**, **feature gating behind expensive tiers** (waitlist, commission), **weak or inflexible reporting** (Meevo), and **trust issues around pricing changes** (Fresha ending free accounts). I found no Reddit threads, so community sentiment is not represented directly.

### Cited Findings
- **Booksy Biz** (Capterra): 479 reviews, 85% positive and 9% negative. The cons cited are slow and confusing payment processing and complicated account verification. One reviewer took more than 2 months to satisfy bank-detail requirements, and another disliked the transaction fees — [Capterra Booksy](https://capterra.com/p/142741/Booksy/)
- **Fresha:** Trustpilot-derived feedback is mostly positive, but concerns about fees and marketplace features appear (report dated December 2024, before the pricing change). A ProductReview.com.au reviewer alleges Fresha backed away from promised "free forever" accounts. PissedConsumer has complaints about delayed payouts and phone-number privacy (anecdotal) — [Kimola Trustpilot report](https://kimola.com/reports/unlock-business-growth-with-freshas-customer-feedback-report-trustpilot-en-gb-151497); [ProductReview.com.au Fresha](https://www.productreview.com.au/listings/fresha); [PissedConsumer](https://www.pissedconsumer.com/fresha/complaints/RT-FP.html)
- **Fresha** has "at least 15 documented hidden costs" according to a comparison site (hard to verify) — [CostBench](https://www.costbench.com/software/salon-spa/fresha/)
- **Meevo:** "quite limited with reporting"; reporting is described as lacking detail and hard to customise — [Capterra Meevo](https://www.capterra.com/p/172058/Meevo-2/)
- **Square:** lacks a walk-in queue and native commission, so shops "end up paying elsewhere" (competitor-authored) — [Razored](https://razoredtech.com/resources/best-barbershop-software/)
- **Squire:** waitlist, commission and rent are gated to the $150 tier. Competitors claim client booking fees and paid add-ons — [Razored vs Squire](https://razoredtech.com/compare/razored-vs-squire/); [SHIFT vs Squire](https://www.goingshift.com/compare/squire/)
- **Waitwhile:** cancellations and no-shows count toward visit caps — [WaitQ](https://waitq.app/blog/best-barbershop-queue-apps)
- **Squire:** limited country coverage (US, CA, IE, UK, possibly AU) and no WhatsApp — [WaitQ](https://waitq.app/blog/best-barbershop-queue-apps)

### Inferences
- Owners distrust platforms that take a cut of every transaction or every new client. A flat-fee or owned system with **payment-agnostic recording** (cash, mobile money, any card terminal) answers the main complaint.
- Global products are unavailable or weak in Africa and parts of Asia and LatAm: limited country coverage, no WhatsApp, no mobile money. That leaves room for regional tools.

### Gaps
- Searches did not surface Reddit (r/barber, r/Barbers, r/Nails, r/smallbusiness) threads, so direct owner and tech sentiment is missing. Nail-tech-specific complaints were not found.
- G2 and Capterra complaint breakdowns for Vagaro, Square, Phorest and GlossGenius were not retrieved.

## Offline capability and hardware

### Takeaway
**Square** has the best-documented offline mode: queued card payments that must be enabled in advance and have many exclusions. Most cloud salon suites document little or nothing about offline use. Kinara (Kenya) explicitly markets offline-first POS with later sync, which matters in markets with unreliable connectivity.

### Cited Findings
- **Square** offline mode covers internet outages and Square service disruptions. Merchants can allow cash only, or cash plus offline card payments. Queued payments process automatically when connectivity returns, normally within 24 hours and at most 72 hours. It must be enabled before going offline — [Square help: offline mode (US)](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode); [Square offline payments guide](https://squareup.com/payments/offline-payments-guide)
- **Square offline exclusions:** physical contactless cards, Square Gift Cards, Tap to Pay, manually keyed cards, and the "Services mode" of the POS app. Interac is not supported offline in Canada. Loyalty points must be added manually afterwards. The Square Appointments POS app supports offline payments — [Square offline payments guide (CA)](https://squareup.com/ca/en/payments/offline-payments-guide); [Square help 5095](https://squareup.com/help/ca/en/article/5095-process-payments-with-offline-mode)
- **Kinara** claims its POS works offline and syncs later — [Kinara](https://gokinara.com/home/)
- **Veira** bundles free POS hardware with plans from KES 2,999/month — [Veira](https://veirahq.com/solutions/mobile-money-agents-for-barbershops/)
- **Trinks** offers its own card machine ("Belezinha") that splits commission — [Trinks barbearias](https://negocios.trinks.com/negocios/barbearias/)
- **Mangomint** has a Cash Drawer permission category, which implies cash drawer session management — [Mangomint: staff permissions](https://www.mangomint.com/learn/staff-member-permissions/)

### Inferences
- Offline-tolerant ticket recording (queue the sale locally and sync later) is a meaningful differentiator in cash- or mobile-money-heavy markets with unreliable power and internet. Mobile-money confirmations (STK push) need connectivity, so offline mode would mean recording a manual reference and reconciling later.
- Hardware support is usually limited to each vendor's own card terminal. Generic ESC/POS receipt printers and cash drawers kicked by the printer are the common low-cost setup for an owned system. This is an inference; I did not verify which vendors support third-party printers.

### Gaps
- Offline behaviour for Fresha, Vagaro, Booksy, Mangomint and Phorest was not found.
- I found no source listing supported receipt printers or cash drawers for the salon suites.
