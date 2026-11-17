# Modelling the Manicure & Pedicure (Nail) Sections of a Barbershop/Grooming Business

Scope: how a walk-in-focused barbershop/grooming management system should model nail services separately from barbering, covering the catalogue, pricing, consumables, stations, hygiene logs, departmental P&L, staffing/commission and split tickets. Research date: Oct 2026. Most hard price data is US; non-US pricing was not found in reliable sources (see Gaps).

---

## 1. Service catalogue, durations, price structure, add-ons, combos

### Takeaway
The nail catalogue is a small set of base services (manicure/pedicure in basic, gel, spa/deluxe tiers; enhancements such as acrylic/dip/hard gel with "full set" vs "fill"; removal; repair) plus many cheap add-ons, some priced **per nail** (art, repair). That means the data model needs base service + modifier lines with per-unit quantity, not just a flat menu. US 2024–26 ranges are about $15–45 for a basic manicure, $30–60 for a basic pedicure and $25–70 for gel. Inside barbershops, men's services sit at the premium end ($65 for a men's manicure in Manhattan).

### Cited Findings
**Price benchmarks (US)**
- Nails Magazine 2016 Big Book averages: basic manicure $19.53, basic pedicure $32.09, gel-polish initial $28.04, soak-off gel initial $30.03, hard gel initial $49.22 — [Nails Magazine Big Book 2016](https://nailsmag.epubxp.com/i/753141/51/)
- Nails Magazine data via Statista (2019, US): basic pedicure $35.46, manicure $22.75, full set of gels $51.29 — [Statista pedicure](https://statista.com/statistics/276677/average-price-basic-pedicure-nail-studio); [Statista manicure](https://www.statista.com/statistics/276673/service-prices-nail-studio-services-united-states); [Statista gel full set](https://statista.com/statistics/276816/average-price-gels-full-set-nail-studio). No newer Nails Magazine survey was found.
- Zenoti's nail price guide (dated Oct 2024, retitled for 2026; it cites a 12% price rise in 2024): basic manicure $15–30, gel manicure $25–35, French $30–40 (+$5–10 for complexity), deluxe/spa manicure $30–50, acrylic short $25–40 / long $30–50, acrylic fills $25–40, acrylic repair $5–10 each; basic pedicure $30–40, gel pedicure $40–50, French pedicure $45–55, deluxe pedicure $45–65; add-ons: polish $5–15, paraffin (manicure) $8–15, paraffin pedicure $40–50 total, deep exfoliation $10–15. Its intro gives different ranges (basic manicure $25–45, gel $35–60, acrylic full set $45–75), so the article contradicts itself — [Zenoti, nail salon prices](https://www.zenoti.com/thecheckin/nail-salon-prices)
- ThePricer (2026 consumer guide): basic manicure $25–45, basic pedicure $30–60, gel adds $20–30 when priced as an upgrade, gel manicure $40–70 — [ThePricer](https://www.thepricer.org/cost-of-manicures-and-pedicures/)
- Dip powder full set $35–70, fills $15–30. This comes from a page labelled 2026 that is copied across low-quality domains, so it is weak — [dip cost page](https://selector.kurlon.com/live/average-cost-of-dip-nails-2026-8768.html)
- Nail art is priced **per nail**: from $2/nail depending on complexity, 3D gel art $5/nail, acrylic flowers $8/nail (individual salon booking pages). Removal is $10+ to $30 (one dip-removal listing is $25 for 20 min). Repair is $3–5 per nail, with removal price going up for thickness, length or embellishments — [search summary of salon menus incl. Coppell Nails](https://coppellnails.carrd.co); [HeyGoldie salon checkout pages](https://book.heygoldie.com/Nails-By-Kris/checkout)

**Barbershop / men's nail services**
- Manhattan Barbershop NYC (Booksy): Men's Manicure (no polish) $65 / 40 min; "Russian Smart Pedicure" $85 / 60 min; mani-pedi combo $135 / 1 h 35 min — [Booksy listing](https://booksy.com/en-us/399886_manhattan-barbershop-nyc-midtown-east_barber-shop_30067_new-york-city)
- Men's pedicure typically about 40 min, from $30 (Appleton, WI) — [Fresha](https://fresha.com/lp/en/tt/men's-pedicures/in/us-appleton)
- Men's mani+pedi combo $55 for about 1 h 45 min (Little Neck, NY listings) — [Booksy Little Neck](https://booksy.com/en-us/s/mens-manicure-pedicure/210_little-neck)
- An example barbershop menu: Basic Manicure $25, French $30, Gel $40, Spa $45; Basic Pedicure $35, Gel $50, Spa $55; callus treatment add-on $10. The page's authenticity is unverified — [barbershop pricing page](https://barbershop.wasmer.app/index.php/pricing/)

**Packages**
- Bundles are typically discounted 10–15% against the separate prices, and each component should still be profitable on its own — [Zenoti](https://www.zenoti.com/thecheckin/nail-salon-prices)

### Inferences
- **Suggested catalogue (base services):** Manicure {Basic/Classic, Gentleman's/Men's grooming (no polish, buff), Spa/Deluxe, Gel/Shellac}; Pedicure {Basic, Men's, Spa/Deluxe, Gel}; Enhancements {Acrylic full set, Acrylic fill, Dip full set, Dip fill, Hard-gel/BIAB full set, fill}; Removal {gel soak-off, acrylic/dip removal}; Repair {per nail}; Treatments {paraffin, callus treatment, exfoliation/scrub, mask/massage extension}; Nail art {per nail, by complexity tier}.
- **Durations** (only partly sourced above; the others are typical industry practice and should be confirmed by the shop when it sets up): men's/basic manicure about 25–40 min, basic/men's pedicure about 40–45 min, spa pedicure about 55–75 min, gel manicure about 45–60 min, acrylic/dip full set about 60–90 min, fill about 45–60 min, removal about 15–20 min (one sourced at 20 min), mani+pedi combo about 90–105 min (sourced at 95–105).
- **Modifier types the system needs:** (a) fixed add-on (+price, +minutes, +recipe), e.g. paraffin, callus treatment, French; (b) per-unit add-on (quantity × unit price), e.g. art per nail, repair per nail; (c) replacement variant (gel instead of regular polish) implemented as a variant with its own price/duration/recipe rather than an add-on; (d) conditional surcharge (removal of another salon's work, extra length).
- **Combos/packages:** model a package as a parent line holding child service lines (e.g. Haircut + Men's Pedicure). The package price is apportioned to the children (pro-rata to their list prices) so each child carries revenue into its own department and to its own staff member. This is essential for barber-vs-nail P&L.
- **Walk-in focus:** prices and durations are mainly used for the queue/wait-time estimate and the till, not for booking slots. Durations should therefore feed a "next free station / next free tech" estimator.

### Gaps
- No reliable 2025–26 nail price survey outside the US. UK, EU, Africa and Asia ranges were not found from authoritative sources, so the system must keep prices fully configurable and currency-agnostic.
- No authoritative duration benchmarks (Nails Magazine durations were not retrieved).

---

## 2. How existing software models variants, add-ons, price-by-staff-level

### Takeaway
The leading salon platforms support **price/commission by job level or employee** (Zenoti: per item, per employee or per job level). Clients are commonly offered junior/senior/master price tiers. Add-ons are separate service items that carry their own pay rules.

### Cited Findings
- Zenoti supports flat, percentage and tiered commission structures, configurable per item, per employee or per job level, and handles splits, cost deductions, discounts and no-show commission automatically — [Zenoti Commission Management](https://www.zenoti.com/platform/commission-management)
- Tiered pricing by technician level (junior, senior, master) lets clients choose by budget — [Zenoti nail pricing guide](https://www.zenoti.com/thecheckin/nail-salon-prices)
- Salonello handles daily minimums, different rates for colour versus cuts, add-on services (e.g. a Brazilian blowdry add-on) and per-brand retail splits. This is a vendor claim — [Capterra Salonello](https://www.capterra.com/p/10043686/Salonello/)

### Inferences
- Data model: `Service` → `ServiceVariant` (price, duration, recipe/BOM, department) → optional `PriceOverride(staff_level | staff_id)`. `AddOn` is itself a service item with `parent_service_types[]` and a `per_unit` flag, so it can carry its own commission rate and recipe.
- Walk-in shops usually assign whichever tech is free, so price-by-level should be resolved **at assignment time**, and the client should be told the price before work starts.

### Gaps
- Phorest, Vagaro and Meevo docs on variant/add-on configuration were not retrieved in this pass.

---

## 3. Consumables & inventory: backbar vs retail, recipes/BOM, cost per service, shrinkage

### Takeaway
Nail services carry noticeably higher product cost than barbering, about **8–15% of ticket price**. Software handles this in three ways: (1) automatic per-service backbar deduction via a configured recipe (MyTime, Zenoti "bill of material"), (2) manual "professional use" deductions (Phorest), and (3) a flat or % "backbar fee" deducted from commission (Mangomint). A good system offers recipes for **costing** and periodic stock counts for **truth**, and reports the difference as variance/shrinkage.

### Cited Findings
- Product cost is typically 10–15% of service price — [Zenoti](https://www.zenoti.com/thecheckin/nail-salon-prices). Vagaro estimates 8–15% of ticket price per nail service. Its scenario is $180/week product deduction on $1,800 weekly tech revenue (10%) — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Booksy: barbers typically have zero to minimal product deductions; nail techs have "standard flat product tier deductions" — [Booksy commission guide](https://biz.booksy.com/blog/how-to-run-a-commission-based-salon)
- **MyTime**: on each service you "Set Inventory Deductions", choosing products and the amount to deduct per service. Fractional quantities (e.g. 0.25) are allowed if enabled. Deduction happens only when the appointment is marked Completed. No-show or cancel returns the stock. Discontinued products are not auto-deducted. The Inventory Adjustments report shows the deductions. Stock alerts use combined on-hand (retail + backbar) — [MyTime help](https://help.mytime.com/support/solutions/articles/31000174902)
- **Phorest**: professional (backbar) stock is deducted manually on the Purchase screen ("Professional" → scan/search → Deduct). Usage is reported under Reports > Products > Product usage. No evidence of automatic per-service deduction was found — [Phorest help](https://phorest.helpjuice.com/44079-stock-inventory/305520-how-to-put-through-professional-stock)
- Rosy Salon Software uses a manual "Inventory Use" ticket that deducts on-hand stock — [Rosy support](https://support.rosysalonsoftware.com/knowledge/support/s/article/inventory-use)
- **Zenoti**: the Service Profitability report (v1, legacy, not available to accounts created after April 2022) breaks out consumables cost, cost to center, commission, total cost, profit and margin per service. The v2 Cost of Goods report covers retail COGS and "cost of bill of material" by service. Consumption reports (v1) compare **projected vs actual consumption** and need regular stock audits (the report is unavailable if there has been no audit for more than 3 months) — [Zenoti profitability](https://help.zenoti.com/en/reports/finance/sales/service---profitability-report--v1-.html); [Zenoti COGS v2](https://help.zenoti.com/en/inventory/reports/cost-of-goods-report--v2-.html); [Zenoti consumption](https://help.zenoti.com/en/reports/inventory/consumption/consumption-reports--v1-.html)
- **Mangomint**: per-service commission deduction (flat or %), applied **pre-commission** (reduces the commission base) or **post-commission** (subtracted from the commission earned). It appears in the Payroll report — [Mangomint](https://www.mangomint.com/learn/deducting-backbar-fees/)
- Phorest offers mobile barcode stock-take, shrinkage reports and automated supplier reorder (comparison article) — [Booksy inventory software comparison](https://biz.booksy.com/blog/the-best-salon-inventory-management-software-options)
- Note: "Backbar" (getbackbar.com) is bar/restaurant software, not salon software. Its recipe model (ingredients from inventory items + volume/unit, cost rolls up only if every item has a cost, shows cost % / menu price / profit) is still a useful pattern — [Backbar recipe docs](https://www.getbackbar.com/support/create-recipe)

### Inferences
- **Item master:** `InventoryItem {sku, name, type: RETAIL | BACKBAR | DISPOSABLE | BOTH, unit_of_purchase (bottle 15 ml), unit_of_use (ml / drop-dose / piece / application), conversion factor, cost per purchase unit → cost per use unit (moving average or FIFO), reorder_level, reorder_qty, supplier, department}`. Keep retail and backbar stock as **separate stock locations** of the same SKU when a product (e.g. cuticle oil) is both sold and used.
- **Recipe/BOM per service variant** (nail example, quantities to be calibrated by the shop): gel manicure = base coat x ml + gel colour y ml + top coat z ml + acetone/cleanser ml + lint-free wipes n + **1 single-use file + 1 buffer** (disposable, one per client) + orange stick 1 + cuticle oil drops. Pedicure = **tub liner 1** (if liners are used) + pumice/foot file 1 + toe separators 1 pair + slippers 1 pair + scrub g + lotion ml + disinfectant dose (tub cleaning, see §5) + towels (laundry cost). Add-on recipes are added to the base (paraffin = wax g + liner bags 2).
- **Hybrid accounting is best practice:** (1) theoretical consumption = Σ completed services × recipe; (2) periodic counts (weekly for high-value gels/acrylics, monthly for others) give actual consumption = opening + received − closing − retail sold; (3) **variance = actual − theoretical**, reported as wastage/shrinkage by department and by tech. Allow explicit wastage entries (spilled bottle, expired/thickened gel) with reason codes.
- **Cost per service** = Σ(recipe qty × current unit cost) + disposables + optional laundry/utility allocation for tub water and heating. Snapshot this cost onto each ticket line at completion so historical margins don't change when supplier prices change.
- Disposables are a big part of nail cost and are legally mandated per client (see §5). The recipe should therefore auto-deduct them and alert when stock is low, since running out is a compliance problem, not just a sales problem.
- Commission deduction options to support: none (typical for barbers), flat backbar fee per service, % of service price, or actual recipe cost; each pre- or post-commission.

### Gaps
- No authoritative per-application consumption figures (ml of gel per manicure, etc.) were found. These must be configured from the shop's own calibration (e.g. weigh bottles over N services).
- Meevo and SalonBiz backbar documentation was not retrieved.

---

## 4. Stations / chairs / pedicure tubs as resources; walk-in capacity

### Takeaway
Nail services need two resources at once, a **qualified tech and a compatible station**: manicure table, pedicure chair/tub, or a stand-alone footbath. Pedicure tubs also have **mandatory downtime** between clients (about 10+ min of disinfectant circulation, see §5). Capacity for walk-ins is therefore min(free qualified techs, free *clean* stations of the right type).

### Cited Findings
- California requires, after every client, a drain/scrub/rinse/refill, EPA-registered disinfectant **circulated at least 10 minutes**, then drain/rinse/dry and a log entry. End of day adds a 10-min detergent cycle plus a 10-min disinfectant cycle — [CA BBC "Keep Your Spas Sparkling" 980.2](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)
- California requires a footspa log notation for any whirlpool footspa marked "Not in Service" — [CA CCR 980.2 via Justia](https://regulations.justia.com/states/california/title-16/division-9/article-12/section-980-2/)

### Inferences
- `Resource {id, type: BARBER_CHAIR | MANI_TABLE | PEDI_CHAIR_WHIRLPOOL | PEDI_CHAIR_PIPELESS | FOOTBATH_BASIN | DRYER/LAMP, department, status: AVAILABLE | IN_USE | CLEANING | OUT_OF_SERVICE}`. A pedicure ticket moves the tub through IN_USE → CLEANING (with a timer of at least 10 min plus scrub time) → AVAILABLE, and AVAILABLE is reached only after the tech signs the cleaning-log entry. This naturally creates the compliance log.
- `Service.requires_resource_type[]` and `Staff.skills[]` (nail_basic, gel, acrylic, dip, art, pedicure). A walk-in queue matcher then assigns the first (tech, station) pair satisfying both.
- Some barbershops have one pedicure chair. Wait-time estimates should show the nail queue separately from the barber queue.
- Gel services also use LED/UV lamps. They are rarely a bottleneck but can be modelled as equipment for maintenance tracking.

### Gaps
- No sourced benchmark for typical nail station counts or utilisation in barbershops.

---

## 5. Hygiene & sanitation compliance — what a system can log

### Takeaway
Regulators, with California the most prescriptive, require a **pedicure-cleaning log** per footspa: an entry after every client, at the end of every day and weekly, with date/time, initials and cleaning type, available to clients/inspectors on request. They also require single-use disposal of porous items and liners. Some jurisdictions also require autoclave use and spore-test logs. These map directly onto system logs.

### Cited Findings
**California (16 CCR §980.1 whirlpool, §980.2 pipeless, §980.4 liners)**
- After each client (pipeless): drain → remove footplate/impeller → scrub with brush + liquid soap → rinse → reinsert → refill → add EPA-registered hospital-grade disinfectant (bactericide, fungicide, virucide) per label → **circulate ≥10 min** → drain, rinse → wipe dry with new paper towel → **record in pedicure-cleaning log: date and time, initials, "after a client"**. The log "shall be made available to either a client or a board representative upon request" — [CA BBC 980.2 PDF](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)
- End of each day: detergent circulate ≥10 min → drain/rinse → disinfectant circulate ≥10 min → drain/rinse → dry completely → log as "end of day" — [same](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)
- At least weekly: after end-of-day steps, leave disinfectant undisturbed for an extended period (the PDF text is truncated at "for 6"; the CCR wording is believed to be 6–10 hours but this was not verified), then drain/rinse/dry → log as "weekly" — [same](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)
- Whirlpool units (§980.1): weekly cleaning also logged with date/time, initials and that it was weekly — [CA BBC 980.1](https://barbercosmo.ca.gov/forms_pubs/publications/980_1_whirlpool.pdf)
- §980.2 also covers daily and weekly procedures and requires a log notation for a whirlpool footspa marked "Not in Service". Violations may bring administrative fines and/or disciplinary action — [Justia 16 CCR 980.2](https://regulations.justia.com/states/california/title-16/division-9/article-12/section-980-2/)
- §980.4: single-use disposable tub liners must be disposed of immediately after each use and may not be disinfected or reused. The basin is then scrubbed, rinsed, dried and **logged** — [Justia 16 CCR 980.4](https://regulations.justia.com/states/california/title-16/division-9/article-12/section-980-4/). A Board bulletin (Korean version) says facilities using liners must keep **five liners per basin** on hand at all times. This was not confirmed in the code text — [CA BBC liner bulletin](https://barbercosmo.ca.gov/forms_pubs/footspa_liners_kr.pdf)
- The rules came from AB 1263 (2005), passed after outbreaks of serious infections linked to pedicure equipment — [AB 1263](https://leginfo.ca.gov/pub/05-06/bill/asm/ab_1251-1300/ab_1263_bill_20050908_amended_sen.pdf)

**Single-use items (other jurisdictions)**
- Georgia: buffers, nail files and wooden sticks must be discarded after one use — [Ga. Comp. R. & Regs. 240-4-.04](https://www.law.cornell.edu/regulations/georgia/Ga-Comp-R-Regs-R-240-4-.04)
- Windsor-Essex (Ontario, Canada) health unit: foam/sponge buffers, files, emery boards, orange sticks, pumice stones, wooden pushers, sand bands, toe separators and slippers must be single-use if they can't be disinfected — [WECHU](https://www.wechu.org/node/4215)
- Idaho Barber & Cosmetology Board publishes a single-use item guidance sheet — [Idaho DOPL](https://dopl.idaho.gov/wp-content/uploads/2025/05/BCB-Single-Use-Item.pdf)

**Autoclave / sterilisation logs**
- Minnesota nail rules: autoclaves are allowed only with regular spore testing by a contracted lab, and a positive result takes the unit out of use until a negative result. The salon must log each use, test samples/results and maintenance. Retention is **36 months** in the current version, raised from 12 months in 2016 — [MN Rule 2105.0377 (2017)](https://www.revisor.mn.gov/rules/2105.0377/version/2017-11-22%2009:24:51+00:00)
- Boston: an autoclave or dry-heat sterilizer is required for multi-use tools, with a daily log with indicator strips attached, kept for one year — [Boston.gov](https://www.boston.gov/node/14772191)
- Florida (body-piercing rule, possibly not applicable to nails): spore test every 40 hours of operation, at least quarterly — [Fla. Admin. Code 64E-19.005](https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-64E-19-005)

### Inferences
- **Logs the system should provide** (tamper-evident, append-only, timestamped, staff-attributed, printable/exportable on demand for an inspector or client):
  1. `FootspaCleaningLog {station_id, type: AFTER_CLIENT | END_OF_DAY | WEEKLY | NOT_IN_SERVICE, started_at, completed_at, disinfectant_product, contact_minutes, staff_initials/id, linked_ticket_id}`. AFTER_CLIENT should be **auto-prompted** when a pedicure ticket closes. End-of-day and weekly entries are checklist tasks with overdue alerts.
  2. `SterilizationLog {device_id, cycle_at, cycle_params, indicator_result, load contents, staff}` + `SporeTestLog {sent_at, lab, result, result_at}`. A positive result blocks the device.
  3. `DisinfectionLog` for barbicide-style immersion of multi-use metal implements (contact time per label).
  4. `SingleUseIssue` is implicit through the recipe deduction of files/buffers/liners per ticket, which gives evidence that disposables were issued per client.
  5. A configurable **jurisdiction profile** (rule set: required frequencies, retention period such as 12/36 months, required fields), because rules vary by state/country.
- Retention defaults to the longest common requirement (about 3 years) and is configurable.

### Gaps
- The exact weekly soak duration and California's log retention period could not be verified from the official CCR text (Justia returned 403; the PDF is truncated).
- UK/EU/other-country nail hygiene logging rules (mostly local-authority licensing) were not researched.

---

## 6. Departmental P&L: revenue, direct cost, gross margin; overhead allocation

### Takeaway
Treat Barbering and Nails as departments (profit centres). Department gross margin = service revenue − consumables (recipe cost) − service commission/wages. Department contribution = gross margin − directly attributable costs (disposables, laundry, the department's own equipment depreciation). Shared overhead is allocated **by floor area for occupancy** and by other drivers for other costs, **not by sales**.

### Cited Findings
- Occupancy costs (rent, repairs, insurance) follow floor share: a department using 20% of floor absorbs 20% of occupancy. Other bases: headcount (supplies, phones), time (shared salaries), direct attribution (contract labour), sales share for card fees. Allocating everything by % of sales is warned against because expenses rarely track sales — [NAMM, Plan for Profit One Department at a Time](https://www.namm.org/nammu/finance/plan-profit-one-department-time)
- Document the allocation basis and apply it consistently. Changing the basis mid-period breaks comparisons — [Tally Solutions](https://tallysolutions.com/accounting/departmental-accounting-practical-guide-for-business-success/)
- A salon-specific approach: compute fixed overhead (rent, utilities, insurance, software, marketing, front-desk salaries) per chair per hour — [Booksy commission split models](https://biz.booksy.com/blog/salon-commission-split-models)
- Zenoti's service profitability view: per service, consumables cost + "cost to center" + commission = total cost → profit and margin — [Zenoti](https://help.zenoti.com/en/reports/finance/sales/service---profitability-report--v1-.html)
- Card processing fees are deducted from tech pay in some models ($40/week scenario) — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)

### Inferences
- **Recommended allocation drivers:** rent, rates and building insurance by **square metres** of each department's floor (shared waiting area/reception split by the same ratio or by ticket count); water and hot water mostly to Nails if pedicure tubs are present (sub-meter or estimate per pedicure); electricity by equipment kW or station-hours; front desk and software by **ticket count** or service-hours; card fees by actual revenue (they really do follow sales); marketing direct if campaign-tagged, otherwise by revenue.
- Better still, use a **station-hour cost rate**: overhead ÷ available station-hours. Charge each service its occupied station-minutes (including pedicure cleaning downtime). This exposes the real cost of long nail services against fast haircuts.
- Report levels: per service variant (margin %), per department (GM, contribution, net after allocation), per staff member, per station (revenue per available station-hour).
- Retail sales are a separate line within each department (by the selling staff member's department or by the product's category).
- Allocated net profit depends on the chosen drivers, so the system should show contribution (before allocation) as the primary decision metric and net-after-allocation as secondary.

### Gaps
- No nail-specific or barbershop-specific published departmental P&L benchmarks (typical gross margin % for nail departments) were found.

---

## 7. Staffing: nail techs vs barbers, cross-training, commission differences

### Takeaway
Nail techs are typically paid a few points lower commission than barbers (40–50% vs 50–60%) **because of product costs**, often net of a backbar deduction. Hybrid hourly + commission is common. Separate licences (nail technician/manicurist vs barber) usually define who may perform which service.

### Cited Findings
- Barbers 50–60% (flat or sliding) with zero to minimal product deductions; nail techs 40–50% with standard flat product-tier deductions — [Booksy](https://biz.booksy.com/blog/how-to-run-a-commission-based-salon). A 50% split is the most common for nail techs — [Booksy nail tech pay](https://biz.booksy.com/blog/how-much-do-nail-techs-make)
- Barbershop example split 60% barber / 40% shop — [Yocale barbershop commission agreement](https://www.yocale.com/blog/barbershop-commission-agreement)
- Nail tech tiers: apprentice 30–40% (salon supplies everything), mid 45–55%, senior 55–65%, tech-supplied product 60–70%. Sliding by rebooking rate: 45% (<50% rebook), 50% (50–70%), 55% (>70%). Hybrid: $10–15/h + 20–35% commission (e.g. $12/h + 25%), or "greater of $15/h or 45%". Retail commission about 10–15%. Booth rent $150–400/week ($400+ in LA/Miami/NYC); regional ranges Northeast $275–425, West Coast $250–400, South $175–300, Midwest $150–275, Mountain $200–325. Vagaro says these are commonly reported norms, not a single verified study — [Vagaro](https://www.vagaro.com/learn/nail-salon-commission-structure)
- Separate barbering and cosmetology/nail regulation exists at state level (e.g. California's Board of Barbering and Cosmetology covers both) — [CA BBC](https://www.barbercosmo.ca.gov/forms_pubs/publications/980_2_pipeless.pdf)

### Inferences
- `Staff {primary_department, licences[] (with expiry for compliance alerts), skills[], pay_plan_id}`, with `PayPlan` per department or per service category, so a cross-trained barber who does a men's manicure is paid at the nail rate (or the shop's chosen rule) and the revenue lands in Nails.
- Support pay models: % commission (flat/tiered/sliding on revenue or rebooking), hourly, hourly + commission, greater-of, booth rent (the tech is a tenant, so shop revenue is rent, not service revenue; the department P&L must handle this differently), and product-supplied-by-tech flags (no recipe cost to shop).
- Walk-in shops tip heavily. Tips should be tracked per staff line and excluded from department revenue (pass-through liability).

### Gaps
- No source quantified how common cross-trained barber/nail staff are, or how licence restrictions differ outside the US.

---

## 8. Combined tickets (haircut by barber + pedicure by nail tech)

### Takeaway
Attribute at the **line-item level**: each service line carries its own staff member, department, price, discount share, recipe cost and commission rule. The ticket is only a payment container. Zenoti-class systems handle splits and cost deductions per item and per employee.

### Cited Findings
- Zenoti: commission configurable per item, per employee or per job level, with automatic handling of splits, cost deductions, discounts and no-show commission — [Zenoti](https://www.zenoti.com/platform/commission-management)
- Bundles are discounted 10–15%, with each service still individually profitable — [Zenoti nail prices](https://www.zenoti.com/thecheckin/nail-salon-prices)
- Mangomint applies backbar deductions per service, pre- or post-commission, shown in payroll — [Mangomint](https://www.mangomint.com/learn/deducting-backbar-fees/)

### Inferences
- **Rules to implement:**
  1. Each `TicketLine {service_variant, staff_id, department_id, station_id, list_price, discount_alloc, net_price, recipe_cost_snapshot, commission_base, commission_amount, tip}`.
  2. Ticket-level discounts and package discounts are **apportioned pro-rata by list price** (default) across lines, so each department and staff member bears its share. This is configurable (e.g. "discount comes from the nail line only").
  3. Add-ons inherit the staff member of their parent line unless reassigned (e.g. a barber applies the paraffin).
  4. Shared-work lines (two techs on one service, e.g. one removes and one applies) support a `split %` among staff, with the department fixed by the service.
  5. Tips are entered per staff member (or split by the client) and are never mixed into department revenue.
  6. Payment-method fees are apportioned by line net price.
  7. Retail on the same ticket is credited to the selling staff member and the product's department.
- Reporting then rolls lines up to department P&L, staff payroll and the client history without double-counting.

### Gaps
- No vendor documentation was retrieved that explicitly describes discount apportionment across multi-staff tickets, so the pro-rata default above is a design recommendation, not a sourced industry standard.
