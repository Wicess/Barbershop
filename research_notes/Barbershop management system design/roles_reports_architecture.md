# Roles, Reports and Architecture for a Barbershop Management System (Owner / Manager / Cashier / Staff)

Scope: walk-in barbershop with sections (barber / manicure / pedicure), one or more branches, a shared counter device, owner who checks in remotely from a phone. Online booking is out of scope. Researched October 2026. Vendor help docs are thin on default per-role matrices, so the matrix below is a design proposal derived from the permission lists vendors publish (marked as inference).

## 1. RBAC design: how POS/salon vendors define permissions, and a concrete matrix

### Takeaway
Every major vendor uses the same model. There are a few preset roles, a granular permission list split into "at the till" and "back office", an owner role that cannot be restricted, and a way for a higher role to authorise a single blocked action with their PIN. For a barbershop, use 4 preset roles (Owner, Manager, Cashier, Staff) built on a granular permission list, with per-branch scoping and editable presets.

### Cited Findings
- Loyverse ships 4 preset roles: Owner, Administrator, Manager and Cashier. Custom roles can be added. The Owner has every right and those rights cannot be changed. All other roles can be edited. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees)
- Loyverse has 14 POS access rights: view all receipts, apply discounts with restricted access, change taxes in a sale, accept payments, perform returns, manage all open tickets, void saved items in open tickets, view shift report, open cash drawer without making a sale, reprint/resend receipts, manage items, view cost of items, change settings, and live chat support. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees)
- Loyverse has 16 Back Office rights, which apply only when back-office access is switched on. They include view sales reports, cancel receipts, manage items, manage inventory, view cost of items, manage employees, manage customers, edit general settings, manage billing, manage payment types, manage taxes and manage POS devices. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees)
- Loyverse lets owners choose whether cashiers can see the expected cash amount in the shift. Owners can then compare counted cash against expected cash and monitor cash inaccuracy for every shift. — [Loyverse employee management](https://loyverse.com/employee-management)
- Square permission sets come in three levels. Standard covers basic POS transactions. Enhanced adds things like backing out of a sale and managing shifts, and suits shift lead, manager and front desk roles. Full covers almost everything except transfers and bank accounts. Any set can be customised. — [Square for Retail team setup](https://square.com/help/us/en/article/6455-setting-up-your-employees-with-square-for-retail); [Square permissions (IE)](https://squareup.com/help/ie/en/article/5822-employee-permissions)
- Square's shared "team passcode" lets several people use one shared POS, but it does not track sales, time or activity per team member. This is an argument for individual PINs. — [Square permissions (IE)](https://squareup.com/help/ie/en/article/5822-employee-permissions)
- On Square, the account owner always has full access whatever the settings. A refund button stays visible on screen, but staff without the refund permission who sign in with their own passcode cannot issue refunds. — [Square Seller Community](https://community.squareup.com/t5/Archived-Discussions-Read-Only/how-do-I-disable-my-team-from-seeing-the-transaction-screen/m-p/327474/highlight/true)
- Square has an "Apply restricted discounts and comps" permission, and each discount can individually require a passcode. Sellers report bugs: staff could still create discounts or issue refunds with permissions off. Square said an engineer was investigating, so treat this as unresolved. — [Square community thread](https://community.squareup.com/t5/Square-for-Retail/Discounts-that-only-Manager-can-apply/td-p/796004); [Square Restaurants permissions](https://square.com/help/us/en/article/6430-setting-up-your-employees-with-square-for-restaurants)
- Fresha assigns each team member a custom "permission role". Reports have their own 4-level access setting: Full access, Can edit (cannot share), View only, and No access. — [Fresha: assign permission roles](https://www.fresha.com/help-center/knowledge-base/team/101715-assign-permission-roles-to-team-members); [Fresha: report access](https://www.fresha.com/help-center/knowledge-base/reports/192-manage-report-access-for-team-members)
- Zenoti defines roles at organisation level with checkbox permissions. Its predefined roles include Therapist, Receptionist, Supervisor, Accountant, Inventory Manager and Monitor. Its own docs conflict on users with multiple roles: one page says permissions are added together (for organisations that went live after 15 Feb 2023), another says the highest role wins. — [Zenoti role permissions](https://help.zenoti.com/en/configuration/security-configurations/application-of-role-permissions-in-zenoti.html); [Zenoti multiple roles](https://help.zenoti.com/en/configuration/security-configurations/what-permission-would-apply-to-an-employee-assigned-to-multiple-roles-.html)
- Phorest uses editable "Access Levels" under Manager > Access, and every staff member must have one. No default matrix is published. — [Phorest help](https://phorest.helpjuice.com/understanding-access-levels)

### Inferences — proposed permission matrix
Key: Y = allowed; A = allowed only with Manager/Owner PIN approval at the till; T = allowed up to a threshold, approval needed above it; Own = own records only; N = not allowed. All presets are editable except Owner, following the Loyverse model. Permissions are scoped per branch: a Manager holds rights only at the branches assigned to them.

| Capability | Owner | Manager | Cashier | Staff (self-view) |
|---|---|---|---|---|
| Ring up sale / take payment | Y | Y | Y | N (optional: start a ticket for self) |
| Assign service provider to line item | Y | Y | Y | N |
| Discount (preset, % at or below threshold) | Y | Y | T (e.g. at or below 10%) | N |
| Discount above threshold / custom amount / comp | Y | Y (logged) | A | N |
| Price override on a service or product | Y | Y | A | N |
| Remove line from an open ticket (pre-payment) | Y | Y | Y (logged) | N |
| Void a paid ticket, same day | Y | Y | A | N |
| Void a ticket from a closed/previous day | Y | A (dual control) or N | N | N |
| Refund (full or partial) | Y | Y (reason required) | A | N |
| Edit a tip after payment | Y | A | N | N |
| Open cash drawer with no sale | Y | Y (logged) | A | N |
| Open/close cash session, count float | Y | Y | Y (blind count) | N |
| See expected cash before counting | Y | Y | N (blind close) | N |
| Cash paid in / paid out (petty cash) | Y | Y up to a limit | A | N |
| Record an expense | Y | Y | T (small, with receipt photo) | N |
| Approve or edit expenses | Y | Y (own branch) | N | N |
| View staff list and contacts | Y | Y (own branch) | Name only | Own |
| Create or edit staff, set roles and PINs | Y | Edit staff below Manager only | N | N |
| Edit commission rules / pay rates | Y | N (propose only) | N | N |
| Run the payroll/commission report | Y | Y (view, own branch) | N | Own earnings only |
| Approve pay period / mark payouts paid | Y | A (Owner confirms) | N | N |
| Daily sales summary / cash-up report | Y | Y | Own shift only | N |
| Full reports (profit, costs, cross-branch) | Y | Own branch, no profit/cost by default | N | N |
| Product cost price / margins | Y | Optional | N | N |
| Inventory: receive stock, count | Y | Y | Optional (receive only) | N |
| Inventory: adjust / write off | Y | Y (reason required) | N | N |
| Services and price list | Y | Propose / Y if enabled | N | N |
| Settings (taxes, payment types, receipts, devices) | Y | Limited (printer, device) | N | N |
| Data export (CSV/PDF) | Y | Reports only, own branch | N | Own statement |
| Delete data (hard delete) | No one; soft-delete/archive only | N | N | N |
| View audit log | Y | Own branch (read-only) | N | N |
| Billing / subscription / bank details | Y | N | N | N |

- Do not support a shared team login. Square's own docs say a shared passcode loses per-person attribution, which defeats commission tracking and the audit trail.
- Store permissions as atomic keys (for example `sale.void.sameday` or `discount.apply.above_threshold`). Roles are bundles of these keys, and each assignment is a `(user, role, branch)` row. If a user holds several roles, take the union of their permissions and document the rule explicitly; Zenoti's conflicting docs show how ambiguity here confuses people.
- Enforce permissions on the server/sync layer as well as in the UI. The Square refund-button reports show that hiding a button in the UI is not access control.

### Gaps
- No vendor publishes a default per-role matrix for its preset roles (Loyverse, Square, Phorest and Fresha all omit this). The matrix above is a synthesis.
- Vagaro, Lightspeed and Toast salon/retail role defaults were not retrieved, apart from Toast's discount and void rules in section 2.

## 2. Approval and override workflows (manager PIN, thresholds, dual control, break-glass)

### Takeaway
The industry-standard pattern is inline step-up. When a user tries a blocked action, a PIN pad appears, an authorised person enters their PIN, and the system grants a one-time authorisation for that single action. Both the requester and the approver are logged. Thresholds by amount are not well supported by the big vendors, which makes them a point of differentiation.

### Cited Findings
- On Loyverse, if an employee tries a function they lack access to, a PIN panel opens. Entering the PIN of an employee who has that access grants one-time access to that function. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees)
- On Toast, each discount has a Permissions Level setting: Any User (the default) or Manager. Employees without the Discounts permission are prompted for a manager passcode. Auto-apply discounts must be set to Any User. — [Toast: who can apply a discount](https://doc.toasttab.com/doc/platformguide/adminDiscountsRequireManager.html); [Toast troubleshooting](https://support.toasttab.com/en/article/Troubleshoot-Discount-Availability?lang=en_US)
- Toast treats voiding as a job- or employee-level permission. Without it, a manager override is required. A separate permission allows same-day voids/refunds without approval. Toast's Sales Exception report surfaces voided payments and items on reopened checks. — [Toast void docs](https://support.toasttab.com/en/article/Using-the-Sales-Exception-Report-to-Identify-Voided-Payments-and-Items-for-Re-Opened-Checks?lang=en_US)
- Searches found no amount-threshold approval setting in Toast; approval is by discount type and permission level. — [Toast discounts overview](https://doc.toasttab.com/doc/platformguide/platformDiscountsOverview.html)
- Square's restricted-discount passcode is the approver's own 4-digit POS passcode, not a separate code for each discount. — [Square community](https://community.squareup.com/t5/Questions-How-To/Team-Management-How-do-I-set-up-a-restricted-discounts-where-the/m-p/80699)

### Inferences — proposed workflows
- **Inline override.** The blocked action opens a modal: "Manager approval needed: Void KSh 1,500 ticket #1042". The approver enters their PIN, and a reason code is required (wrong service, customer complaint, test, other + note). The system writes one `approval` row (requester, approver, action, amount, reason, device, timestamp) linked to the audit event. The approver's PIN authorises that one action only; the cashier stays logged in. An approver cannot approve their own request: if a Manager is the cashier, a void above the threshold needs a second person or the Owner.
- **Configurable thresholds per branch:** maximum cashier discount %, maximum cashier discount amount, refund limit without approval, paid-out limit, expense limit, and a void window (same session only).
- **Remote approval (optional).** When no manager is on site, the request goes to the Owner's phone as a push notification and is approved in the app. This requires connectivity. Fallback: the request is held as "pending approval", the ticket stays open, and the cash is not released.
- **Dual control for high-risk back-office actions:** voiding a previous-day sale, editing a closed cash session, changing commission rules mid-period, deleting or deactivating a staff member who has unpaid commissions, and bulk price changes. One person proposes and the Owner confirms.
- **Break-glass.** For when the Owner account is locked or no manager is available, use a sealed one-time Owner recovery code (or code list) generated at setup and stored offline. Using it raises a high-severity audit event and alerts the Owner, and the code must be rotated afterwards. Break-glass never bypasses the audit log.
- **Exception report** (modelled on Toast's Sales Exception report): a daily list of every void, refund, discount above threshold, no-sale drawer open, price override and approval, grouped by requester and approver. This is the report owners actually read.

### Gaps
- No primary vendor source was found for amount-based approval thresholds or remote push approval. Both are design proposals.

## 3. Audit trail design

### Takeaway
Log who, what, when, where (device and branch) and before/after values for every money-moving and privilege-changing action. Make the log append-only, with database triggers that block UPDATE and DELETE, and hash-chain it for tamper evidence. Restrict who can read it. Owners do not read raw logs; they read the exception report and the cash variance per shift.

### Cited Findings
- OWASP requires every event to record "when, where, who and what". When: log time plus event time if they differ. Where: application ID, address, service, page or code location. Who: source address and user identity. What: event type, severity and description. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- OWASP says to always log authentication successes and failures, authorisation (access control) failures, session failures, and use of higher-risk functions such as user administration, privilege use and sensitive data access. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- OWASP says never to log passwords, access tokens or keys. Session IDs should be hashed, and payment or bank data should not be stored in plain form. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- OWASP: "Build in tamper detection so you know if a record has been modified or deleted." Move logs to read-only media as soon as possible, restrict and monitor access to logs, prefer structured formats such as JSON, and keep logs for the required retention period but no longer. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- The hash-chain pattern: each audit row's hash includes the previous row's hash, and a scheduled job recomputes the chain so that edits, deletes and insertions break it at an identifiable row. — [DEV Community (137foundry)](https://dev.to/137foundry/how-to-add-tamper-evidence-to-an-existing-audit-table-17f1)
- Append-only enforcement can use database triggers that block UPDATE, DELETE and TRUNCATE on the audit table, with verification run against a copy. (Vendor material.) — [Knogin](https://knogin.com/developers/auth-tamper-evident-audit-trail)

### Inferences
- **Audit row fields:** `id`, `tenant_id`, `branch_id`, `device_id`, `actor_user_id`, `approver_user_id?`, `action` (for example `sale.void`, `discount.apply`, `drawer.no_sale`, `price.override`, `user.role_change`, `login.fail`), `entity_type`, `entity_id`, `before` (JSONB), `after` (JSONB), `reason_code`, `note`, `client_ts` (device time), `server_ts` (time received), `app_version`, `prev_hash`, `hash`.
- **Offline devices:** chain hashes per device locally using a per-device sequence number. The server verifies each chain on sync and stores `client_ts` and `server_ts` separately, because device clocks drift. A gap in a device's sequence numbers is itself an alert.
- **Never hard-delete business records.** Use a status (`voided`, `refunded`, `archived`). Corrections are new reversing entries, following the ledger principle; a sale is never edited after payment.
- **What owners review:** the daily exception report (section 2), cash variance per session and per cashier over time, discount totals by staff, the no-sale drawer count, after-hours logins, failed PIN attempts, and role/rate changes. Review the full raw log only during an investigation.

### Gaps
- The OWASP ASVS V16 requirement numbers were mentioned only in secondary sources and were not verified.

## 4. Authentication on a shared counter device

### Takeaway
Use a two-layer model. The device is registered once by the Owner or Manager with a full account, and staff then switch in with a personal 4–6 digit PIN. Add auto-lock after inactivity, PIN lockout, and step-up PIN for sensitive actions. The Owner uses normal email/password (or passkey) with 2FA on their own phone, with remote device revocation.

### Cited Findings
- Loyverse staff sign in to the POS app with a PIN or password. The "Manage POS devices" right also allows sign-in with email and password, which is effectively device enrolment. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees); [Loyverse employee management](https://loyverse.com/employee-management)
- Square's shared POS access point must be enabled for a team passcode. Individual 4-digit passcodes give per-person attribution, while the team passcode does not. — [Square permissions (IE)](https://squareup.com/help/ie/en/article/5822-employee-permissions); [Square community](https://community.squareup.com/t5/Questions-How-To/Team-Management-How-do-I-set-up-a-restricted-discounts-where-the/m-p/80699)
- OWASP: log authentication successes and failures. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Inferences
- **Device registration.** The Owner or Manager signs in once on the counter device. The server issues a long-lived device credential bound to a branch, stored as a non-extractable key or token. A PIN works only on registered devices, so a PIN alone is useless anywhere else. The Owner can see and revoke devices from their phone.
- **PINs:** unique per user per tenant, stored only as a salted slow hash (with a local copy so offline login works). Lock out after about 5 failed attempts for a cool-down period, and log every failure. Never show PINs to anyone; let users set their own.
- **Quick switch:** after each completed sale, return to the "Who's serving?" PIN pad, or after N seconds idle (for example 60–120 s). Each ticket carries the cashier who took payment and the provider per line item.
- **Step-up:** sensitive actions re-prompt for a PIN even when someone is already logged in, which handles a cashier walking away from a logged-in till.
- **Owner remote access:** a web or PWA dashboard with email + password/passkey and TOTP 2FA, no PIN login. This access is read-mostly, with approvals and settings.
- **Offline authorisation:** permissions are cached on the device along with each user's role. Changes made while the device is offline (such as a fired employee) take effect at the next sync. Mitigation: a short validity window on the cached permission set (for example 24–72 h without sync forces re-auth by the Owner or Manager).

### Gaps
- No vendor documentation on auto-lock timeouts or PIN lockout counts was retrieved. The values above are suggestions.

## 5. Reports, dashboards and KPIs by role

### Takeaway
The Cashier needs only their own shift close-out. The Manager needs today/this-week operational views for their branch, plus exceptions and payroll preview. The Owner needs cross-branch financials (revenue, expenses, profit, commission liability), trends and exceptions. Staff need their own services, tips and earnings. Standard salon KPIs are average ticket, clients per day, utilisation, retail attach rate and revenue per staff hour.

### Cited Findings
- Retail attach rate is the share of service appointments that include a product sale. It raises revenue per client without adding appointments. — [Boulevard](https://www.joinblvd.com/blog/salon-analytics-software)
- Average ticket is the average a client spends per visit. — [Sola Salon Studios](https://www.solasalonstudios.com/blog/understanding-your-sola-business1)
- Zenoti's KPI list includes service-provider utilisation, average service ticket and occupancy ratio (the share of available appointments booked). — [Zenoti 30 KPIs](https://www.zenoti.com/thecheckin/30-key-performance-indicators-kpis-for-salons-and-spas)
- Zenoti's vendor benchmark: top salons run at 76–79% utilisation against a median of 47–49%. For a stylist with 40 billable hours and an $85 ticket, going from 50% to 75% utilisation is worth about $850 a week. — [Zenoti revenue management guide](https://www.zenoti.com/thecheckin/salon-revenue-management-guide)
- Loyverse shows expected vs counted cash per shift and tracks cash inaccuracy. — [Loyverse employee management](https://loyverse.com/employee-management)
- Fresha gates reports separately per role (Full / Can edit / View only / No access). — [Fresha report access](https://www.fresha.com/help-center/knowledge-base/reports/192-manage-report-access-for-team-members)

### Inferences — reports by role
- **Cashier:** a shift (cash-up) report covering opening float, cash sales, paid-in/out, blind counted cash, card/mobile-money totals, and number of tickets. Variance is shown after the cashier submits the count.
- **Staff (self):** today, this week and this pay period: services performed (by section), gross service revenue attributed, commission earned, tips, product sales commission, advances/deductions, and payout history. Staff cannot see other staff.
- **Manager (own branch):** daily sales summary; sales by section (barber/manicure/pedicure); sales by staff; sales by payment method (cash/card/mobile money); cash-up per session with variance; exception report; expenses entered; commission/payroll preview; inventory low-stock and usage; and walk-ins per hour (to plan staffing).
- **Owner (all branches + comparison):** all of the above plus profit (revenue − cost of goods − commissions − expenses), branch comparison, trend lines, commission liability outstanding, cash variance by cashier over time, discount/void totals by person, and data export.
- **KPI definitions (walk-in adapted):**
  - Average ticket = net sales ÷ tickets.
  - Clients per day = distinct tickets per day (walk-ins have no booking, so count tickets).
  - Revenue per staff hour = service revenue by provider ÷ hours clocked in. This requires a clock-in/out or attendance record.
  - Utilisation = service minutes performed (sum of service standard durations, or actual start/finish if captured) ÷ minutes clocked in.
  - Retail attach rate = tickets containing at least 1 product and at least 1 service ÷ tickets with at least 1 service.
  - Mix by section, discount rate (discount ÷ gross), void/refund rate, tips % of service, and repeat-client rate (only if customer phone numbers are captured).
- Rebooking KPIs are irrelevant here because booking is out of scope.

### Gaps
- No authoritative formula for "revenue per staff hour" was found. The definition above is a standard construction. Utilisation benchmarks are appointment-based vendor figures (Zenoti) and may not translate to walk-in shops.

## 6. Architecture: offline-first, platform choice, hardware, multi-branch, backups, hosting cost

### Takeaway
The best balance for a small shop is an installable PWA (React/Next or similar) that writes to a local database (IndexedDB via Dexie, or SQLite-WASM on OPFS) and syncs through an idempotent outbox to a serverless Postgres with row-level security. Print over the network or WebUSB with ESC/POS, and kick the cash drawer through the printer. Treat money records as append-only server-validated events, not last-write-wins documents. Keep costs near zero by letting the database scale to zero: no timer polling of dashboards, and sync on events and on focus.

### Cited Findings
- Local-first PWA layers: a service worker for the offline shell, a local DB as the primary copy for reads and writes, and a sync engine for eventual consistency. OPFS-backed SQLite (WASM) is cited as the most capable browser option. — [OpenReplay](https://blog.openreplay.com/local-first-pwa-architecture/); [LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- Use a durable outbox of pending operations that is idempotent, replayed in order with exponential-backoff retries and idempotency keys. — [OneUptime](https://oneuptime.com/blog/post/2026-01-30-offline-capabilities/markdown); [AdvisoryApps](https://advisoryapps.com/modules/offline-edge-sync)
- Field-level last-write-wins covers most cases. Semantic conflicts need server-side validation at sync time. Base-revision checks can detect concurrent edits. — [OpenReplay](https://blog.openreplay.com/local-first-pwa-architecture/); [Smallstack](https://docs.smallstack.com/developer/local-first)
- Sync tools named in the sources: Replicache (push/pull with optimistic mutations), ElectricSQL (Postgres to local SQLite), TinyBase (CRDT), and Dexie (an IndexedDB wrapper). — [LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/)
- Safari lacks the Background Sync API, so add a manual `online` event listener as a fallback. — [OneUptime](https://oneuptime.com/blog/post/2026-01-30-offline-capabilities/markdown)
- In the browser, a WebUSB POS requests a device with filters, the user picks it, then the app claims the interface and writes to the endpoint. Pairing is per browser per device, so it must be redone on a new device or after clearing browser data. — [LaunchMyStore](https://launchmystore.help.center/article/1117-pos-hardware-receipt-printer-barcode-scanner-cash-drawer); [Niels Leenheer, "Making money with Project Fugu"](https://noti.st/nielsleenheer/I1Zowj/slides)
- The cash drawer is wired to the printer's drawer port. An ESC/POS pulse command (pin 2 or pin 5) opens it, so the drawer needs no connection of its own. — [LaunchMyStore](https://launchmystore.help.center/article/1117-pos-hardware-receipt-printer-barcode-scanner-cash-drawer); [unified_esc_pos_printer docs](https://pub.dev/documentation/unified_esc_pos_printer/3.4.0/)
- Browsers expose no raw TCP or Bluetooth SPP, so browser printing depends on WebUSB (or similar). Network printers using cloud-polled protocols (for example Star CloudPRNT) poll the backend over HTTPS and need no browser permissions. — [unified_esc_pos_printer](https://pub.dev/documentation/unified_esc_pos_printer/3.3.3/); [LaunchMyStore](https://launchmystore.help.center/article/1117-pos-hardware-receipt-printer-barcode-scanner-cash-drawer)
- Multi-tenant Postgres RLS: put a NOT NULL `tenant_id` on every tenant table, enable RLS on all of them, and set the tenant context per request (for example `app.current_tenant_id`) rather than using a database user per tenant. The app must not connect as the table owner, because owners bypass RLS unless FORCE ROW LEVEL SECURITY is set. Use restrictive policies for the tenant boundary. RLS does not replace column privileges or encryption. — [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html); [AppMaster](https://appmaster.io/blog/postgresql-row-level-security-multitenant-patterns); [OneUptime RLS](https://oneuptime.com/blog/post/2026-01-25-row-level-security-postgresql/markdown)
- Neon suspends compute after 5 minutes idle, and suspended compute accrues no CU-hours (storage is still billed). On the Free plan the 5-minute suspend cannot be disabled. The Launch plan is $0.106/CU-hour with autoscale up to 16 CU. Free-plan compute allowances conflict between Neon pages (100 vs 50 CU-hours per project per month). — [Neon FAQ](https://neon.com/faqs/databases-automatically-scale-serverless-environments); [Neon plans](https://neon.com/docs/introduction/plans); [Neon free plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas)
- The project owner's cost playbook (local, not public) gives the real-world lesson. A Neon bill of about $48 and a Vercel bill of about $20 in one cycle across about 12 similar projects were driven mainly by admin dashboards left open that auto-refresh on timers, which kept the DB awake. The fix: refresh only while the tab is visible and interacted with in the last 1–3 min, at an interval of 45 s or more; prefer event-driven refresh; cap Neon autoscale at 0.25–1 CU; use the pooled connection string; avoid per-request writes. — `~/.claude/cost-reduction-playbook.md` (user's internal doc)

### Inferences — architecture recommendations
- **Platform: an installable PWA first.** One codebase serves the counter (tablet or mini-PC), the Owner's phone and the Manager's laptop, with no app-store friction. The PWA is weak at printing on iOS Safari, which has no WebUSB. Options:
  - (a) Use an Android tablet or Windows mini-PC with Chrome/Edge at the counter (WebUSB/WebSerial work there).
  - (b) Use a LAN/Wi-Fi ESC/POS printer through a tiny local print bridge, or cloud-polled printing.
  - (c) Wrap in Capacitor or Tauri later if native Bluetooth printing is required. A desktop Electron/Tauri app is justified only if offline robustness or raw TCP printing is a hard requirement.
- **Local data:** Dexie/IndexedDB is simplest. SQLite-WASM/OPFS is the alternative if relational queries are needed for offline reports. Ask for persistent storage (`navigator.storage.persist()`) so the browser does not evict the outbox.
- **Sync model for a POS:**
  - Client-generated UUIDv7 IDs and per-device human-readable ticket numbers (for example `B1-T2-000123`) avoid collisions offline.
  - Sales, payments, voids, refunds, cash movements and inventory movements are **immutable events/ledger rows**, pushed via the outbox with idempotency keys. There are no conflicts, only appends; the server validates and re-derives totals.
  - Catalogue, prices, staff and settings are pulled from the server, which is authoritative. They are edited only online by Owner/Manager, with field-level LWW plus `updated_at`/version.
  - An inventory going negative offline is accepted and flagged, not blocked.
  - A permission change takes effect at next sync, with a maximum offline grace period.
- **Sync triggers (cost-aware):** on outbox write (debounced), on `online`, on `visibilitychange`/focus, and on login/PIN switch. Optionally add a slow heartbeat (≥5–10 min) only while the till is active. Do **not** poll the DB on a timer from dashboards. The Owner dashboard refreshes on open/focus/pull-to-refresh and pauses when idle or hidden. For "live" feel, push a lightweight signal (web push / SSE from a cheap pub-sub, or a Redis "last-changed" timestamp) and query Postgres only when something changed. This lets Neon reach its 5-minute idle suspend every night and through quiet hours.
- **Multi-branch tenancy:** a single Postgres with RLS on `tenant_id`. `branch_id` is a further dimension enforced by app-level permission checks (or a second RLS predicate tied to the user's branch assignments). Use one tenant per business and many branches per tenant. Reporting rollups use materialised daily summary tables (`daily_branch_summary`, `daily_staff_summary`) written on cash-session close or on sync. This avoids heavy queries on every dashboard open and keeps the DB idle-friendly.
- **Backups:** Neon's point-in-time restore (window depends on plan; not verified here), plus a nightly logical export (pg_dump to object storage such as R2/S3) run by a cron at a quiet hour, plus an Owner-facing "Export all my data" (CSV/ZIP), which is also a data-portability duty. The local device DB is a cache plus outbox, not a backup. Warn if a device has unsynced items for more than X hours.
- **Hardware summary:**
  - 80 mm ESC/POS thermal printer (USB or LAN).
  - Cash drawer RJ11 into the printer; kick via ESC/POS pulse after a cash payment, and on "no sale" with permission.
  - USB/Bluetooth barcode scanner in HID keyboard mode, which needs no driver, for retail products.
  - Optional customer-facing display.

### Gaps
- Neon free-plan allowances conflict between its own pages. Point-in-time-restore windows per plan were not retrieved.
- WebSerial-specific ESC/POS details and iOS printing workarounds were not found in primary sources.
- No primary benchmark on offline POS sync was found; sources are vendor and engineering blogs.

## 7. Data model (schema sketch)

### Takeaway
Use a tenant → branch → section hierarchy. Users (logins) are separate from staff (people who perform services and earn commission). Each ticket has line items that carry the provider and a commission snapshot. Payments and cash movements are ledger-style append-only rows, and there is an append-only audit log. Commission is computed per line item at sale time and frozen into pay periods and payouts.

### Cited Findings
- Tenant-scoped tables need a NOT NULL `tenant_id` and a single consistent tenant identifier (UUID); slugs are for display only. — [AppMaster](https://appmaster.io/blog/postgresql-row-level-security-multitenant-patterns)
- An offline-first client store should keep entities, pending operations (outbox), sync metadata and conflict logs separately. — [OneUptime](https://oneuptime.com/blog/post/2026-01-30-offline-capabilities/markdown)
- Loyverse separates POS rights from Back Office rights, and its separate rights include viewing item cost and receipt cancellation. This supports modelling permissions as granular keys. — [Loyverse help](https://help.loyverse.com/help/how-manage-access-rights-employees)

### Inferences — schema sketch (Postgres; every table has `id uuid pk`, `tenant_id`, `created_at`, `updated_at`, plus `branch_id` where relevant)
```
tenant(id, name, currency, timezone, settings jsonb)
branch(id, tenant_id, name, address, phone, receipt_footer, is_active)
section(id, tenant_id, branch_id?, name)              -- Barber, Manicure, Pedicure
app_user(id, tenant_id, email?, password_hash?, pin_hash, display_name, status, mfa_secret?)
role(id, tenant_id, name, is_system)                  -- Owner/Manager/Cashier/Staff + custom
permission(key pk, description)                       -- 'sale.void.sameday', 'discount.over_threshold', ...
role_permission(role_id, permission_key, limit_value numeric?)  -- e.g. discount max %
user_role(user_id, role_id, branch_id NULL=all)       -- branch-scoped grants
device(id, tenant_id, branch_id, name, registered_by, credential_hash, last_seen_at, revoked_at)
staff(id, tenant_id, user_id?, full_name, phone, national_id_enc?, hire_date, status,
      default_section_id, pay_type ['commission','salary','hybrid'])
staff_branch(staff_id, branch_id)
attendance(id, staff_id, branch_id, clock_in, clock_out, source_device_id)
service_category(id, tenant_id, section_id, name)
service(id, tenant_id, category_id, name, price, duration_min, is_active)
service_branch_price(service_id, branch_id, price)    -- optional per-branch override
product(id, tenant_id, sku, barcode, name, cost_price, sell_price, track_stock)
customer(id, tenant_id, name?, phone?, consent_marketing bool, notes)  -- optional; walk-ins may be anonymous
cash_session(id, branch_id, device_id, opened_by, opened_at, opening_float,
             closed_by, closed_at, counted_cash, expected_cash, variance, status)
cash_movement(id, cash_session_id, type ['sale','refund','paid_in','paid_out','float','drop'],
              amount, reason, user_id, approval_id?)
ticket(id, branch_id, device_id, number, cash_session_id, customer_id?, cashier_user_id,
       status ['open','paid','voided','refunded','partially_refunded'],
       subtotal, discount_total, tax_total, total, tip_total, opened_at, closed_at,
       client_seq, voided_ticket_id?)                -- refunds/voids reference originals
ticket_line(id, ticket_id, kind ['service','product'], service_id?, product_id?,
            provider_staff_id?, section_id, qty, unit_price, list_price,
            discount_amount, price_override_by?, commission_rule_id, commission_amount)  -- snapshot
payment(id, ticket_id, method ['cash','card','mobile_money','voucher'], amount,
        reference, status, refund_of_payment_id?)
tip(id, ticket_id, staff_id, amount, method)          -- tips split per provider
discount_reason / reason_code(id, tenant_id, kind, label)
approval(id, action, entity_type, entity_id, amount, requested_by, approved_by,
         reason_code_id, note, device_id, created_at)
expense_category(id, tenant_id, name)
expense(id, branch_id, category_id, amount, paid_from ['cash_drawer','bank','owner'],
        cash_session_id?, description, receipt_url, recorded_by, approved_by?, status)
commission_rule(id, tenant_id, scope ['service','category','section','product','staff'],
                scope_id, staff_id?, type ['percent','flat','tiered'], value, tiers jsonb,
                applies_to ['gross','net_of_discount'], valid_from, valid_to)
pay_period(id, tenant_id, branch_id?, start_date, end_date, status ['open','locked','paid'])
payout(id, pay_period_id, staff_id, commission_total, tips_total, base_pay,
       advances, deductions, net, paid_at, paid_by, method)
staff_advance(id, staff_id, amount, given_at, given_by, cash_movement_id?)
inventory_movement(id, branch_id, product_id, qty_delta, type ['receive','sale','return',
                   'adjust','waste','transfer_in','transfer_out','use_in_service'],
                   ref_type, ref_id, unit_cost, user_id, reason)
daily_branch_summary(branch_id, date, ...rollups)     -- materialised for cheap dashboards
daily_staff_summary(staff_id, branch_id, date, ...)
audit_log(id, tenant_id, branch_id, device_id, device_seq, actor_user_id, approver_user_id,
          action, entity_type, entity_id, before jsonb, after jsonb, reason, client_ts,
          server_ts, prev_hash, hash)                 -- append-only, triggers block UPDATE/DELETE
```
- Key relationships:
  - `user` (login) is distinct from `staff` (earner). A cashier may also be a barber, and a staff member might never log in.
  - The provider is set per `ticket_line`, so commission and "sales by staff" are line-level, and "sales by section" comes from `ticket_line.section_id`.
  - Commission is snapshotted on the line, so later rule changes never rewrite history.
  - Stock is derived as the sum of `inventory_movement`.
  - Cash expected is derived as the sum of `cash_movement` within a session.
- Money is stored as integer minor units (or numeric) with a tenant currency. Never use floats.

### Gaps
- No published reference schema for salon POS was found. This sketch is a synthesis of standard POS/ledger practice.

## 8. Security and privacy basics (GDPR, Kenya DPA, Nigeria NDPA, POPIA)

### Takeaway
All four regimes share GDPR-style principles: lawful basis, minimisation, purpose limitation, security safeguards, data-subject rights and breach notification. Kenya and Nigeria require regulator notification within 72 hours, and POPIA requires it "as soon as reasonably possible". For a barbershop, the practical approach is to collect little customer data, protect employee data (IDs, pay, bank/mobile-money details) with access control and encryption, keep a breach register, and support export and deletion requests.

### Cited Findings
- Kenya (DPA 2019): notify the regulator (ODPC) within 72 hours, or 24 hours for critical information infrastructure. Notify affected individuals in writing within a "reasonably practicable" period. Practitioners say the ODPC insists on strict compliance. — [Bowmans](https://bowmanslaw.com/insights/kenya-a-few-insights-on-navigating-data-breaches-in-kenya-under-the-kenyan-data-protection-law/); [Polity (Sept 2026)](https://www.polity.org.za/article/when-the-clock-starts-ticking-why-cross-border-data-breach-response-demands-more-than-good-intentions-2026-09-18)
- Nigeria (NDPA 2023): 72-hour breach notification to the regulator. Notify data subjects directly where the risk is high, and maintain a breach register. — [TechInAfrica](https://www.techinafrica.com/blog/tech-policy-2025-new-data-laws-nigeria-south-africa/); [Medium commentary](https://medium.com/@kayode.abijo/what-nigerias-cybersecurity-crisis-actually-means-for-your-data-privacy-obligations-2b6d55aa211e)
- South Africa (POPIA): notify the regulator and affected individuals "as soon as reasonably possible", with no fixed number of hours. — [Polity](https://www.polity.org.za/article/when-the-clock-starts-ticking-why-cross-border-data-breach-response-demands-more-than-good-intentions-2026-09-18)
- Other African deadlines for comparison: Zambia and Zimbabwe 24 h, Rwanda 48 h. — [Polity](https://www.polity.org.za/article/when-the-clock-starts-ticking-why-cross-border-data-breach-response-demands-more-than-good-intentions-2026-09-18)
- A GDPR-vs-African-laws comparison is available. — [GDPR Local](https://gdprlocal.com/?p=2585); [Africa HR](https://africa-hr.com/blog/data-laws-across-africa/)
- OWASP: never log secrets, hash session IDs, keep payment data out of logs, and retain logs no longer than required. — [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Inferences
- **Minimise.** Customers can stay anonymous (walk-in). If phone or name is captured, record a marketing-consent flag separately. Do not store card data at all; integrate a payment terminal or provider so the system stays out of PCI scope.
- **Employee data:** encrypt national ID and bank/mobile-money numbers at the column/application level. Only the Owner (and optionally the Manager) can see them, and staff see their own record. Pay data is visible only to the Owner, the Manager (own branch) and the staff member concerned.
- **Rights and operations:**
  - Export of a person's data, and deletion/anonymisation for customers.
  - Financial records are anonymised rather than deleted, because tax and bookkeeping retention obligations (often 5–7 years, varying by country; not verified here) override erasure.
  - A breach register, plus a 72-hour incident runbook as the lowest common denominator.
  - Hosting region chosen with cross-border transfer rules in mind.
  - A Data Processing Agreement with the hosting provider.
  - Kenya requires data controller registration with the ODPC above certain thresholds (not verified here).
- **Security baseline:**
  - TLS everywhere.
  - Owner 2FA.
  - Device-bound credentials plus PINs.
  - Server-side permission checks on every mutation.
  - RLS for tenant isolation.
  - Rate-limiting and lockout on PIN attempts.
  - Encrypted backups.
  - Least-privilege DB role for the app, which is not the table owner.

### Gaps
- Employee-data retention periods and tax-record retention rules per country were not found.
- Kenya ODPC registration thresholds and NDPA "data controller of major importance" registration rules were not retrieved.
- The sources for the African laws are law-firm and commentary pages, not the statutes themselves.
