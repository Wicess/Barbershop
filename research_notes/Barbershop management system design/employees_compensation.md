# Employee Management & Compensation Models for Barbershops, Hair Salons and Nail Businesses

Research date: 2026-10-22. Sources are mostly vendor help docs and vendor blogs (Vagaro, Phorest, Mangomint, Fresha, Booksy, Zenoti), which have a commercial interest. Two legal/primary sources are included: the US DOL fact sheet and Brazil's Lei 13.352/2016. No single authoritative industry survey of split percentages was found. Treat every percentage range as an indicative benchmark, not a standard.

Note on worked examples: the arithmetic in the examples is mine. Where a source supplied the inputs or the rule, it is cited. Where the scenario is illustrative, it is labelled as an inference.

---

## 1. Compensation models: straight, tiered, guaranteed-minimum, hourly+commission, booth rental, hybrid, daily split

### Takeaway
Software has to support about seven base pay models: straight commission, tiered (incremental or retroactive), "greater of" hourly-vs-commission, hourly plus commission, salary, booth/chair rent, and percentage-of-takings partnership or daily split. Each should be configurable per staff member and per service. Barbers usually split around 50/50 to 60/40 in the barber's favour. Nail techs are usually quoted at 40–60%, with the rate driven by who supplies product.

### Cited Findings
**Straight commission ranges**
- Barbers: 60/40 in the barber's favour is described as the usual arrangement for W-2 employees, with 70/30 or 80/20 for top performers. Sliding scales tied to weekly revenue are also common. — [Yocale, 2025](https://www.yocale.com/blog/barbershop-commission-agreement)
- Barbers: typical splits run from 40/60 to 70/30 in the barber's favour, with top performers sometimes reaching 80/20. — [Beancount booth rental vs commission guide, 2026](https://beancount.io/blog/2026/07/26/booth-rental-vs-commission-barbershop-bookkeeping-guide)
- Nail techs: most nail salons in 2026 sit at 40–60% commission. By tier: entry/apprentice 30–40% (salon supplies all product), mid-level 45–55% (salon supplies), senior 55–65% (often supplies own product), tech-supplied product 60–70%. Retail is typically 10–15%, set separately. — [Vagaro, nail salon commission structure](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Nail techs: who supplies product is the biggest driver of the rate and shifts it by about 10–15 percentage points. Product cost per nail service is estimated at 8–15% of the ticket price. — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Nail regional bands (US): Northeast 45–55%, West Coast 50–60%, South 45–55%, Midwest 40–50%, Mountain 45–55%. — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Nail pay overall: commission 40–60%; hourly $10–$18/hr plus tips (the body of the same article cites about $25/hr in NYC, so its figures conflict internally); booth rent $200–$600/week. — [Zenoti](https://www.zenoti.com/thecheckin/how-do-nail-salons-pay-their-employees)
- Forum consensus (UK/US): "50/50 or 60/40 with the larger amount going to the person supplying the products". — [SalonGeek thread](https://www.salongeek.com/threads/salon-owner-wanting-50.106589/)

**Tiered / sliding scale**
- Phorest default is incremental (marginal) brackets: "5% on the first 1,000 and then 10% on the next 1,000 so if you make 2,000 you get 150." An optional setting, "Higher commission brackets apply to full amount", applies the top-reached rate to all sales. Example: a 10%/20% scale with 1,500 in sales gives 300 with the option on, versus 200 under the standard method. — [Phorest help](https://phorest.helpjuice.com/337692-higher-commission-brackets-apply-to-full-amount)
- Mangomint sliding scale example: 20% up to $1,000 in services, 25% on amounts above that. — [Mangomint staff compensation](https://mangomint.com/learn/help-articles/staff-members/staff-compensation)
- Real nail-tech anecdote: 50% on $0–$500 weekly services, 55% on $501–$1,000, 65% above $1,001. The poster said they earned little after the split. This is one anecdote, not a benchmark. — [SalonGeek](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570)
- KPI-based tier example: commission set by rebooking rate, at 45% under 50% rebook, 50% for 50–70%, and 55% over 70%. — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Sliding scale milestones of about $1,000/week (lower tier) and $3,000/week (higher tier), with no tier percentages given. Team-based alternative: fixed hourly wage plus a salon-wide bonus pool unlocked at a monthly revenue goal. Quarterly retention bonus tied to seat utilisation. — [Booksy, salon commission split models](https://biz.booksy.com/blog/salon-commission-split-models)

**Guaranteed minimum / hourly + commission / salary**
- Hybrid nail pay: base wage of about $10–$15/hr plus 20–35% commission, or the greater of a guaranteed hourly wage or commission (example: $15/hr vs 45%). — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Mangomint supports hourly (e.g. $20/hr) and salary (e.g. $60,000/yr) alongside commission. — [Mangomint](https://mangomint.com/learn/help-articles/staff-members/staff-compensation)
- California: salon incentive pay counts as "commission" only if base hourly pay meets a threshold tied to minimum wage, and the hourly rate must be paid for all hours, including non-productive time. Otherwise it may be treated as piece rate under Labor Code 226.2, which requires separate pay for rest/recovery periods (greater of average hourly rate or minimum wage) and for other non-productive time. Averaging piece pay across all hours does not cure this. — [Ogletree](https://ogletree.com/insights/a-new-look-for-salon-employee-commission-arrangements-in-california); [Littler](https://www.littler.com/publication-press/publication/california-governor-signs-ab-1513-severely-limiting-piece-rate); [Fisher Phillips](https://www.fisherphillips.com/en/insights/publication/california-supreme-court-will-have-the-final-word-on-exceptions-to-activity-based-pay-systems)
- Salon examples of non-productive time: sweeping after a haircut, waiting for a client, meetings, restocking. Recommended fix: pay minimum wage hourly for all time worked, with commission on top. — [Behind the Chair](https://behindthechair.com/articles/this-california-law-could-have-a-huge-effect-on-your-salon)
- Employer cost: on a $100 service at a 50/50 split, employer payroll taxes (FICA 6.2% + 1.45%, FUTA, SUTA, workers' comp) push labour cost to about 60–61%, leaving the house about 38–39%. — [Booksy](https://biz.booksy.com/blog/salon-commission-split-models)

**Booth / chair rental and hybrid rental**
- US barber booth rent runs $100–$600/week, averaging about $220–$225/week nationally. — [Beancount](https://beancount.io/blog/2026/07/26/booth-rental-vs-commission-barbershop-bookkeeping-guide)
- Some barbershop owners charge a flat $150–$200/week, while others take a commission split of up to 50% on services. — [Booksy, "Is chair rent actually dying?"](https://biz.booksy.com/blog/is-chair-rent-actually-dying)
- Nail booth rent is $150–$400/week, and the tech keeps 100% of service revenue. Vagaro's comparison at $1,800/week tech revenue: at 50% commission the salon nets $680/week after product ($180) and card fees ($40); at $275/week rent the salon nets $235. — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Vagaro lets owners deduct a booth renter's retail commission from their rent (a hybrid rent + commission offset). — [Vagaro quickstart](https://www.vagaro.com/learn/the-quickstart-guide-to-vagaro)
- Software exists specifically to automate "chair renter commissions", i.e. renters who also pay a percentage. — [Slick](https://www.getslick.com/blog/automating-chair-renter-commissions)
- UK accounting view: when the salon collects all takings and pays the stylist a share, "there is no commission here, it is merely chair rental calculated by dint of turnover". Legal characterisation of a percentage split varies. — [AccountingWEB](https://www.accountingweb.co.uk/node/96485)

**Daily-split / percentage-of-takings models (emerging markets)**
- Nigeria: barbers are paid by monthly wage, commission per cut, chair rent (barber keeps fees and pays for the station), or mobile service. Monthly wages: junior ₦60k–₦100k, experienced ₦100k–₦180k, senior/manager ₦180k–₦263k. Chair rent listings (Sept 2026) were ₦70k–₦200k, with one listing stating ₦200k/month for a furnished station in Abuja. A Sept 2026 Lagos (Yaba) job ad offered "Commission-Based or Monthly Salary — Negotiable". Apprentices are often unpaid or get a token allowance. Tips are about ₦500–₦1,000 per visit. No commission % or daily split ratio was published. — [Profolio.ng barber salary guide](https://www.profolio.ng/barber/salary-guide)
- Brazil formalises a percentage partnership model: Lei 13.352/2016 ("salão-parceiro / profissional-parceiro") covers barbers, hairdressers, manicures and pedicurists. The salon collects all payments, retains its contractual share (cota-parte, for use of space/equipment and admin services), and withholds taxes and social-security contributions due on the professional's share. The professional's share is not part of the salon's gross revenue. There is no employment relationship. — [Lei 13.352/2016, Senado](https://legis.senado.leg.br/norma/602577/publicacao/15652949); [GEN Jurídico](https://blog.grupogen.com.br/juridico/2016/11/03/contrato-de-parceria-em-salao-de-beleza-lei13-3522016/)
- Brazil: per Anabel data cited by Dizer o Direito, payouts to professionals usually run 30–60% of service value. — [Dizer o Direito](https://www.dizerodireito.com.br/2016/10/lei-133522016-permite-contratacao-de.html?m=0)
- US SSA guidance describes the classic "percentage" barber arrangement: the owner supplies the chair and equipment, the barber supplies personal tools, and the owner keeps an agreed share of earnings, excluding tips. — [SSA POMS](https://secure.ssa.gov/POMS.nsf/lnx/0302101092)

### Inferences
- The data model needs a per-staff `pay_plan` that combines components: `base` (none | hourly | salary | daily_wage), `service_commission` (flat % | per-service % | fixed amount per service | tiered incremental | tiered retroactive), `retail_commission`, `rent` (amount + period, or % of takings), `guarantee` (greater-of rule over a period), and `deductions` (pre/post-commission). Model the split as "staff share %" so both 60/40 and 40/60 can be entered unambiguously. Always label which side is which in the UI.
- Tier thresholds need a defined period (day, week, pay period, month) and a defined basis (gross services, net of discounts, net of backbar). Phorest's incremental-vs-full-amount toggle should be replicated, since owners use both.
- Daily-split shops (common across West/East Africa, South Asia and Latin America, per general practice, though no quantitative source was found) need: an end-of-day "close-out" per staff member, cash payout recorded the same day, a running ledger of advances, and optional weekly or monthly reconciliation. Brazil's law shows the "house collects everything, then pays out the professional's share" flow is a legitimate, formalised model, not just informal practice.
- Worker classification (employee vs independent renter/partner) affects whether tips, tax withholding and minimum-wage guarantees apply. Store it per staff member as `employment_type` and let it drive which rules run.

### Gaps
- No reliable published source gives typical daily split ratios (e.g. 50/50, 60/40) for barbershops in Nigeria, Ghana, Kenya, South Africa, India or the Philippines. These arrangements are widely reported anecdotally but were not documented in sources I could find.
- No authoritative (non-vendor) 2025–2026 survey of commission percentages was found.

---

## 2. Product/backbar cost deduction and retail commission

### Takeaway
Most salon platforms let owners take a "backbar"/service-cost deduction off the service price. It can come out before commission (it reduces the commission base) or after commission (it is subtracted from the staff member's earnings). It can be a flat amount or a percentage. Retail commission is a separate rate, usually 10–15%, sometimes tiered, and sometimes calculated on margin rather than retail price.

### Cited Findings
- Mangomint supports a pre-commission or post-commission deduction per service, as a flat amount or a percentage. On a $100 service at 50% with a $5 deduction: pre-commission gives (100−5)×50% = $47.50, and post-commission gives 100×50% − 5 = $45.00. Pre-commission deductions can also strip Groupon/third-party fees before commission is calculated. — [Mangomint, deducting backbar fees](https://www.mangomint.com/learn/deducting-backbar-fees/); [Mangomint Groupon](https://www.mangomint.com/learn/how-can-i-track-services-sold-in-groupon-or-other-online-promos)
- Booksy backbar example: a $200 colour correction with $30 of product consumed leaves $170 for the split. — [Booksy](https://biz.booksy.com/blog/salon-commission-split-models)
- Fresha lets owners deduct discounts, taxes or service costs before commission, as defaults that can be overridden per team member. — [Fresha Academy](https://www.fresha.com/help-center/academy/pay-your-team/track-team-commissions/lessons/100274); [Fresha set up commissions](https://www.fresha.com/help-center/knowledge-base/team/98-set-up-commissions-for-team-members)
- Square's commission "Calculation" settings let owners choose whether discounts, taxes and processing fees are deducted before commission. An older Square community thread shows there was no native product-cost deduction at one point. — [Square community](https://community.squareup.com/t5/Staff-Payroll/Is-there-an-option-to-have-discount-on-services-deducted-before/m-p/710217); [Square community, product cost](https://community.squareup.com/t5/Archived-Discussions-Read-Only/Can-you-take-product-cost-out-before-calculating-commission/m-p/302151)
- Pabau has a "Deduct Product Cost" option, so retail commission can be calculated on retail price minus cost price, or on retail price. — [Pabau](https://support.pabau.com/en/pabau2/how-to-adjust-commission-calculation-settings?hsLang=en)
- Retail commission is 10–15% of the gross product sale, and can be tiered (e.g. a higher % above $700/month in retail). — [Booksy](https://biz.booksy.com/blog/salon-commission-split-models); retail 10–15% — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure); Mangomint example 10% — [Mangomint](https://mangomint.com/learn/help-articles/staff-members/staff-compensation)
- Vagaro's "true cost" split approach: ticket price − product cost − card processing fees − station overhead − marketing cost per client = the pool to split. — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Booksy overhead example: $9,000 monthly overhead ÷ (6 chairs × 200 hours) = $7.50 per chair-hour. — [Booksy](https://biz.booksy.com/blog/salon-commission-split-models)
- Nail techs warn that some owners promise a split, then deduct supplies, rent or card fees, cutting the real take. — [Vagaro / forum summaries via search](https://www.vagaro.com/learn/nail-salon-commission-structure); [SalonGeek](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570)

### Inferences
- Every deduction needs two attributes: `timing` (pre-commission | post-commission) and `type` (flat | % of price), with per-service defaults and per-staff overrides. The payslip must show deductions line by line, so the "hidden deductions" complaint cannot arise.
- Inputs to the commission base should be explicit toggles: deduct discounts? deduct tax (prices are usually tax-exclusive, so commission should normally exclude tax)? deduct card processing fee? deduct backbar? deduct third-party/marketplace fee?

### Gaps
- No standard backbar fee level was found beyond Vagaro's 8–15%-of-ticket estimate for nails and Booksy's single example.

---

## 3. Discounts, comps, refunds, redos (gross vs net, clawbacks)

### Takeaway
Owners must choose whether commission is calculated before or after discounts (Fresha and Square expose this as a setting). Refunds should reverse commission by default (Aura's "Return Commission" flag). Otherwise commission gets paid on revenue the shop never kept. Redos/comps are usually zero-revenue tickets, so they earn zero commission unless a policy says otherwise.

### Cited Findings
- Fresha: commissions can be calculated "before discounts are applied or after discounts are deducted". — [Fresha discounts at checkout](https://www.fresha.com/help-center/knowledge-base/sales/518-apply-a-discount-at-checkout)
- SmartMoving (non-salon) defaults to pre-discount commission with a post-discount option, and shows how the choice changes payout. This is a pattern reference only. — [SmartMoving](https://help.smartmoving.com/en/articles/3935681-customize-how-discounts-affect-sales-commission)
- Aura Salonware: a "Return Commission (RC)" checkbox on a full or partial refund removes the associated commission from the provider. Partial refunds entered as a dollar amount do not affect payroll unless RC is checked. — [Aura, Refunds and Payroll](https://support.aurasalonware.com/hc/en-us/articles/360052074453-Refunds-and-Payroll)
- Square user report: when commission was calculated on gross, refunds for services never performed still generated commission. Square staff said this may not be working as intended. Commission can be set to gross or net sales. — [Square community](https://community.squareup.com/t5/Staff-Payroll/Commission-Based-on-Gross-sales-not-Net-Sales/m-p/790929/highlight/true)

### Inferences
- Recommended defaults:
  - Commission base = price − line discount − allocated ticket discount (pro-rata by line value), excluding tax.
  - Comps (100% discount) earn no commission unless a "commission on comp at list price" flag is set, e.g. for owner-authorised model/training services.
  - Refunds post a negative commission adjustment in the period the refund happens. Do not rewrite a closed period. This is the clawback.
  - Redos: the redo ticket is $0, so $0 commission. Optionally allow "charge the redo to the original performer", either as a clawback of the original commission or a fixed fee, or "pay the redo performer" from house funds.
- Clawbacks against a minimum-wage guarantee must not push pay below the legal floor in jurisdictions with wage protections. This is an inference consistent with DOL tip/minimum-wage principles below; verify locally.

### Gaps
- No vendor documentation was found that explicitly defines redo-commission handling. The redo rules above are design recommendations.

---

## 4. Tips (card vs cash, pooling, card fees, timing, legal)

### Takeaway
Track tips separately from commission. Card tips flow through the system and are paid out with payroll or daily. Cash tips are usually kept directly but should be recordable for tax reporting. Under US federal law tips belong to the employee. Valid pools are limited to customarily tipped employees. An employer may deduct only the actual card processing fee on a card tip, and must pay card tips by the next regular payday.

### Cited Findings
- US FLSA: all tips received belong to the employee, except under a valid tip pool limited to employees who customarily and regularly receive tips. — [DOL Fact Sheet #15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa)
- An employer may reduce card tips by no more than the card company's transaction fee on the tip, and the fee cannot bring wages below minimum wage. Some states forbid passing on the fee at all. — summarised via [DOL Fact Sheet #15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa) and secondary law-firm summaries ([Shouse Law](https://www.shouselaw.com/?p=48364))
- Card tips must be paid no later than the next regular payday, even if the card company has not yet reimbursed the employer. (1983 DOL opinion letter: old, confirm it is current.) — [DOL opinion letter 1983-02-23](https://dol.gov/sites/dolgov/files/WHD/opinion-letters/legacy/ol_1983-02-23_a.pdf)
- Nail salons: tips are typically 15–25% of the service total (15–20% routine manicure, 25–30% nail art) and go directly to the technician. — [Zenoti](https://www.zenoti.com/thecheckin/how-do-nail-salons-pay-their-employees)
- In walk-in nail salons, tips are often split across 5–10 techs per shift, and cash tips, card tips and pooled tips enter payroll differently. — [Zenoti nail software guide](https://www.zenoti.com/thecheckin/nail-salon-software-guide); [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Nigeria: typical tip ₦500–₦1,000 per visit. — [Profolio.ng](https://www.profolio.ng/barber/salary-guide)

### Inferences
- Tip record fields: `ticket_id, staff_id, amount, method (cash|card|mobile money), card_fee_deducted, pooled (bool), pool_id, paid_out_at, payout_batch`. Tips must never enter the commission base.
- Multi-staff tickets need a tip allocation rule: as the client directs, pro-rata by service value, or equal. See worked example 6.
- Make the card-fee-on-tips deduction a jurisdiction toggle that defaults to OFF, which is the safest option.
- Mobile-money tips (M-Pesa, MoMo etc.) behave like card tips: they may carry a fee and must be tracked. Inference: no source.

### Gaps
- Tip law outside the US (UK Employment (Allocation of Tips) Act 2023, EU, African jurisdictions) was not researched in this pass. Flag it as jurisdiction-specific.

---

## 5. Assistants and shared services (multi-performer splits)

### Takeaway
Very little vendor documentation was found on how multi-performer splits are calculated. Practice and software patterns suggest three methods: split by line item (each performer is credited for their own service line), split by percentage of a single service (e.g. 80/20 stylist/assistant), and a fixed fee per assist paid by the house or by the lead.

### Cited Findings
- Mangomint and others allow different commission rates per service and per staff member, which lets a manicure line and a pedicure line on one ticket be credited to different techs. — [Mangomint](https://mangomint.com/learn/help-articles/staff-members/staff-compensation)
- Zenoti's comparison table lists "per-technician tip splitting" as a feature differentiator among nail software (vendor-published). — [Zenoti software comparison](https://www.zenoti.com/thecheckin/nail-salon-software-comparison)
- Nigerian apprentices are often unpaid or receive a token allowance. — [Profolio.ng](https://www.profolio.ng/barber/salary-guide)

### Inferences
- Design: every ticket line has one or more `performers[]` with `{staff_id, role (lead|assistant), share_pct or fixed_amount}`, where shares total 100% of the line's commission base.
- An assistant fee can be (a) carved out of the lead's commission, (b) paid by the house on top, or (c) a fixed per-shampoo amount. Make the source configurable.
- The turn system (section 8) should count a shared service as a partial turn for each tech. Some shops use "half turns" for small services, but this could not be confirmed from sources.

### Gaps
- No primary source describes standard assistant/apprentice split percentages or "half turn" rules.

---

## 6. Advances, loans, deductions, fines, attendance deductions

### Takeaway
No reliable published sources were found on how barbershops track staff advances and fines. This section is design guidance only. In daily-pay shops, advances against the day's or week's takings are common. Fines and attendance deductions are legally restricted in many jurisdictions.

### Cited Findings
- US: deductions (e.g. card fees on tips) may not reduce pay below the minimum wage. — [DOL Fact Sheet #15](https://www.dol.gov/agencies/whd/fact-sheets/15-tipped-employees-flsa)
- Brazil partnership model: the salon withholds taxes and social contributions due on the professional's share before paying out. This is a legally mandated deduction in a percentage-split model. — [Lei 13.352/2016](https://legis.senado.leg.br/norma/602577/publicacao/15652949)

### Inferences
- Ledger design: a `staff_ledger` table holds signed entries: `advance` (−), `loan_disbursement` (−), `loan_repayment` (+, automatic per payout), `fine` (−, reason + approver), `bonus` (+), `adjustment` (±, mandatory note), `clawback` (−, linked refund).
- Loans need: principal, installment amount or %, start period, a cap per payout (e.g. never more than X% of a payout), and outstanding balance.
- Attendance deductions: compute them from shift records (late minutes, unexcused absence) using an owner-defined rule. Give them a jurisdiction warning flag, because many labour laws restrict fines. Every deduction needs an audit trail (who entered it, when, and why).

### Gaps
- No sources found for typical advance or fine practices in African, Asian or Latin American shops.

---

## 7. Pay periods, payslips, commission statements

### Takeaway
Pay frequency ranges from daily (split shops) to weekly, bi-weekly or monthly (Western employees and Nigerian salaried barbers). A commission statement has to make every number traceable: sales per ticket, the base after each deduction, the rate or tier applied, tips by method, guarantee top-up, ledger deductions, and net pay.

### Cited Findings
- Tier thresholds are commonly weekly (weekly service bands in the SalonGeek and Yocale examples) or monthly (Booksy retail threshold). — [SalonGeek](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570); [Yocale](https://www.yocale.com/blog/barbershop-commission-agreement); [Booksy](https://biz.booksy.com/blog/salon-commission-split-models)
- Phorest calculates commission in its payroll report and recommends checking the setup daily for a few days after configuring it. — [Phorest](https://phorest.helpjuice.com/337692-higher-commission-brackets-apply-to-full-amount)
- Nigerian employed barbers are typically on monthly wages. — [Profolio.ng](https://www.profolio.ng/barber/salary-guide)
- Card tips are due by the next regular payday (US). — [DOL 1983 letter](https://dol.gov/sites/dolgov/files/WHD/opinion-letters/legacy/ol_1983-02-23_a.pdf)

### Inferences
- A commission statement should show, in order:
  1. Period, staff, plan name.
  2. A service sales table: date, ticket, service, list price, discount, deductions, commission base, rate, commission.
  3. Tier summary: thresholds, the method (incremental or retroactive), and the amount in each band.
  4. Retail sales and commission.
  5. Refund/clawback lines.
  6. Hourly hours × rate, and the guarantee comparison with any top-up.
  7. Tips: card (gross, fee, net), cash (declared), pooled share.
  8. Rent owed or offset (for renters).
  9. Ledger deductions: advances, loan installment, fines.
  10. Net payable, payment method, and a signature or acknowledgement.
- Lock a period once it is paid. Later corrections post as adjustments to the next period, so the history stays auditable.

### Gaps
- Statutory payslip contents vary by country and were not researched.

---

## 8. Attendance, shifts, walk-in turn/rotation

### Takeaway
Walk-in-heavy barbershops and nail salons need a turn queue: who is clocked in and on the floor, whose turn is next, the services each person has done, and client wait times. Few mainstream booking platforms do this natively.

### Cited Findings
- Most nail salon clients walk in. Techs work on a turn system, and the software must track whose turn it is, what services each tech has done, and how long each client has waited, replacing paper sign-in sheets with digital check-in and automatic turn assignment. — [Zenoti nail software guide](https://www.zenoti.com/thecheckin/nail-salon-software-guide)
- Zenoti's (vendor-published) comparison lists walk-in queue and turn management as native in Zenoti and Zota, partial in Vagaro, and absent in Square, Booksy, GlossGenius, Mangomint and Fresha. — [Zenoti comparison](https://www.zenoti.com/thecheckin/nail-salon-software-comparison)
- Walk-in systems should estimate real wait times from services in progress and let clients step away and return. — [SchedulingKit](https://schedulingkit.com/de/automation/nail-salons)
- Dedicated iPad apps exist for "fair turn rotation" (e.g. Smart Turn Tracker). — [App Store](https://apps.apple.com/us/app/-/id6758108238)
- California: non-productive time (waiting for clients, cleaning, meetings) is compensable, so clock-in/out data has pay consequences. — [Behind the Chair](https://behindthechair.com/articles/this-california-law-could-have-a-huge-effect-on-your-salon)

### Inferences
- Turn queue algorithm:
  - Eligible staff are clocked in, not on break, have the skill for the requested service and the right section (barber or nail), and are not busy.
  - Order by turns taken today (fewest first), then by time since last service finished (longest idle first), then by clock-in time.
  - Weighted turns (e.g. a pedicure = 1, a polish change = 0.5) prevent quick services from skewing fairness.
  - "Requested" clients (a client asks for a specific barber) should not consume a turn, or should be counted separately. This is a common fairness rule but is unsourced.
  - Allow a manager override with a logged reason.
- Clock events: `clock_in, break_start, break_end, clock_out`, with geofence/PIN/QR options. Leave types: annual, sick, unpaid, off-day. Attendance status feeds payroll for hourly/guarantee plans and any attendance deductions.

### Gaps
- "Half turn" conventions and request-vs-turn rules could not be confirmed from a source.

---

## 9. Employee records and performance KPIs

### Takeaway
Staff profiles must capture identity, role and skills (barber, nail tech or both), section assignment, pay plan, employment type, and contacts. Performance should be tracked as revenue per staff, client count, average ticket, rebooking/retention, and retail attachment. Vagaro even ties commission tiers to rebook rate.

### Cited Findings
- Commission tiers can be tied to rebooking rate (45/50/55% at under 50%, 50–70%, over 70% rebook). — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Retention bonuses are tied to seat utilisation and year-over-year growth. — [Booksy](https://biz.booksy.com/blog/salon-commission-split-models)
- Commission rates can vary per staff member and per service. — [Mangomint](https://mangomint.com/learn/help-articles/staff-members/staff-compensation)

### Inferences
- Profile fields:
  - Identity: legal name, display name, photo, staff ID/badge, national ID / tax ID (encrypted), phone, address, date of birth.
  - Emergency contact: name, relation, phone.
  - Employment: start date, employment type (employee / renter / partner / apprentice).
  - Role and placement: roles (barber, nail tech, stylist, assistant, receptionist, manager), skills/services allowed with level, section/station assignment.
  - Pay and payout: pay plan, bank / mobile-money payout details.
  - Documents and status: licence number and expiry (barber/cosmetology licences are regulated in many jurisdictions), documents, status (active/suspended/left), notes.
- KPI formulas:
  - revenue per staff = Σ service net + retail net
  - clients served = distinct clients
  - average ticket = service revenue ÷ tickets
  - rebook rate = clients who booked their next visit before leaving ÷ clients
  - retention = clients returning within N days ÷ clients
  - retail attachment = tickets with a retail item ÷ tickets
  - utilisation = booked minutes ÷ available minutes
  - revenue per hour = revenue ÷ clocked hours

### Gaps
- No industry benchmark values for these KPIs were collected in this pass.

---

## 10. Worked numeric examples (for test cases)

### Takeaway
The examples below double as unit-test fixtures. Each states its rule source. All arithmetic is mine.

### Cited Findings
- **Ex 1: Backbar pre- vs post-commission** (rule and figures from [Mangomint](https://www.mangomint.com/learn/deducting-backbar-fees/)).
  - Service $100, rate 50%, deduction $5.
  - Pre-commission: (100 − 5) × 0.50 = **$47.50**. Post-commission: 100 × 0.50 − 5 = **$45.00**.
- **Ex 2: Tiered incremental vs retroactive** (rules from [Phorest](https://phorest.helpjuice.com/337692-higher-commission-brackets-apply-to-full-amount)).
  - Scale: 5% on 0–1,000, 10% above.
  - Sales 2,000, incremental: 1,000×5% + 1,000×10% = **150**.
  - Scale 10% on 0–1,000, 20% above, sales 1,500: incremental 100 + 100 = **200**; retroactive 1,500 × 20% = **300**.
  - Applied to the SalonGeek nail tiers ([source](https://salongeek.com/threads/am-i-getting-screwed-on-my-pay-checks-usa.325570)): 50% on 0–500, 55% on 500–1,000, 65% above. Weekly services $1,400:
    - Incremental: 250 + 275 + 400×0.65 = 260, giving **$785**.
    - Retroactive: 1,400 × 0.65 = **$910**.
- **Ex 3: Greater of hourly or commission** (rule "$15/hr vs 45%" from [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)).
  - Week of 38 hrs. Hourly floor = 38 × 15 = $570.
  - (a) Services $1,100: commission $495 < $570, so pay **$570** (top-up $75).
  - (b) Services $1,500: commission $675 > $570, so pay **$675** (no top-up).
  - Compare per workweek, not per pay period, where US FLSA applies.
- **Ex 4: Booth rent vs commission, salon view** (figures from [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)).
  - Tech revenue $1,800/week.
  - Commission 50%: salon keeps 900 − product 180 − card fees 40 = **$680**. Tech gets $900.
  - Rent $275: salon keeps 275 − 40 = **$235**. Tech gets 1,800 − 275 = $1,525 before their own product costs.

### Inferences
- **Ex 5: Daily split with advance (illustrative, generic currency units).**
  - Barber on a 40% staff / 60% house split, paid at close of day.
  - Services: 12 cuts × 2,500 = 30,000. Cash tips 2,000. Outstanding advance 5,000, with an agreed repayment of 1,000/day.
  - Staff share = 30,000 × 0.40 = 12,000. Tips 2,000 (100% to barber). Advance repayment −1,000.
  - Payout today = **13,000**. House keeps 18,000. Advance balance falls to 4,000.
  - Optional variant: deduct consumables (e.g. 100/cut = 1,200) before the split, giving (30,000 − 1,200) × 0.40 = 11,520.
- **Ex 6: Shared ticket, two techs, ticket discount, card tip.**
  - Manicure $30 (Tech A, 50%) and pedicure $45 (Tech B, 50%). A 10% ticket discount = $7.50 is allocated pro-rata: A $3.00, B $4.50.
  - Bases: A $27.00, B $40.50. Commission: A **$13.50**, B **$20.25**.
  - Card tip $15 allocated pro-rata by pre-discount value: A $6.00, B $9.00.
  - If a 3% card fee on tips is permitted: A $5.82, B $8.73. If not permitted (default): A $6.00, B $9.00.
- **Ex 7: Refund clawback across periods.**
  - Period 1: $60 colour at 40% pays $24.
  - Period 2: full refund with "return commission" on (pattern from [Aura](https://support.aurasalonware.com/hc/en-us/articles/360052074453-Refunds-and-Payroll)) posts a **−$24** adjustment to period 2. Period 1 is not reopened.
  - Redo: a $0 ticket carries $0 commission.
- **Ex 8: Hourly + commission + retail + tips (hybrid).**
  - $12/hr × 40 = $480. Services $2,000 × 25% = $500. Retail $300 × 10% = $30. Gross wages = **$1,010**.
  - Card tips $180, less 3% fee (where legal) $5.40 = $174.60. Cash tips declared $60.
  - Advance repayment −$100. Net payable (before statutory tax) = 1,010 + 174.60 − 100 = **$1,084.60**. Cash tips are already in hand, recorded for reporting only.
- **Ex 9: Booth renter with retail offset** (offset pattern from [Vagaro quickstart](https://www.vagaro.com/learn/the-quickstart-guide-to-vagaro)).
  - Rent $250/week. The renter sold $400 of house retail at 15% = $60.
  - Rent due = 250 − 60 = **$190**. Service revenue is 100% the renter's and is not part of house payroll.
- Calculation order to implement:
  1. Line price.
  2. Minus line/ticket discount (if the "after discount" setting is on).
  3. Minus tax (if tax-inclusive).
  4. Minus pre-commission deductions (backbar, third-party fees, card fee if configured).
  5. Equals the commission base.
  6. Allocate to performers by share.
  7. Aggregate by period.
  8. Apply tiers (incremental or retroactive).
  9. Plus retail commission.
  10. Minus post-commission deductions.
  11. Compare with the guarantee (greater of) and add any top-up.
  12. Plus hourly/salary components (if additive).
  13. Plus net tips.
  14. ± ledger items (advances, loans, fines, bonuses, clawbacks).
  15. Minus statutory withholding.
  16. Equals net pay.
- Use integer minor units (cents/kobo) and define a rounding rule: round per line or per period. The rule must be consistent, or totals will drift by cents.

### Gaps
- No source gives standard rounding practice. Ex 5–9 scenarios are illustrative constructions, not observed shop data.
