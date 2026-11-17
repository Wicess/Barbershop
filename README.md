# Barbershop Manager

A management system for a barbershop that also does manicure, pedicure and other services and sells drinks.

It is not a booking system. The cashier records each sale at the counter, and the system works out the rest automatically:

- each barber's or nail technician's share of the work they did;
- monthly staff pay, after advances, bonuses and deductions;
- profit or loss for each section (Barbering, Manicure, Pedicure, Drinks…) and for the whole shop;
- the expected cash in the drawer at the end of the day.

It is an installable web app (PWA) that looks and works like a phone app, and keeps working with no internet.

## Who can do what

| | Owner | Shop manager | Cashier |
|---|:-:|:-:|:-:|
| Record sales, print receipts | ✓ | ✓ | ✓ |
| Close the day (blind cash count) | ✓ | ✓ | ✓ |
| Change a price / give a discount at the till | ✓ | ✓ | only if the owner allows |
| Void a sale (with reason) | ✓ | ✓ | – |
| Expenses, fixed monthly costs | ✓ | ✓ | – |
| Price list, sections, drinks stock | ✓ | ✓ | – |
| Add/edit staff | ✓ | ✓ (can't change pay) | – |
| Staff share %, salary, bonuses, deductions | ✓ | – | – |
| Give staff advances | ✓ | ✓ | – |
| Record staff payments | ✓ | – | – |
| Daily sales reports (by section, staff, payment) | ✓ | ✓ | – |
| Live earnings per employee, split of every sale | ✓ | ✓ | – |
| Client book (visits, usual barber, who hasn't been back) | ✓ | ✓ | lookup at the till only |
| Spreadsheet exports (sales, payments, expenses, pay, clients) | ✓ | ✓ | – |
| Full backup file | ✓ | – | – |
| Profit & loss, Money in & out book | ✓ | ✓ | – |
| Users, devices, settings, activity log | ✓ | – | – |

## How the money is calculated

- **One ticket, many sections.** A customer who has a haircut, a pedicure and a soda gets one receipt. Each line remembers its section and the staff member who did it. The haircut counts toward Barbering and the barber, the pedicure toward Pedicure and the nail technician, and the soda toward Drinks.
- **Staff share.** Each staff member has the share % agreed with the owner, for example 40%. They can also have a different share per section. The share is worked out from what the customer actually paid, after any discount. The rate and amount are frozen on the sale line, so changing someone's rate later never rewrites past months.
- **Who gets what.** Every sale shows each worker's cut and the shop's cut, line by line. The shop's cut is the line total minus the worker's cut, so the parts always add up to the exact total, to the cent.
- **Live earnings.** The Earnings screen shows what each employee has made today, this week or this month, and lists every service behind it. It updates the moment a sale is recorded on any device.
- **Tips.** A tip is added at payment and goes 100% to the person picked. The customer pays the bill plus the tip. The tip is added to that person's monthly pay, and it is never counted as shop sales or profit. A voided sale takes its tip with it.
- **Section profit** = revenue − staff share − cost of products sold − spoiled or missing stock − expenses charged to that section.
- **Net profit** = all section profit − shop-wide expenses (rent, power…) − staff salaries − bonuses + deductions.
- **Staff pay for a month** = share earned + tips + salary + bonuses − deductions − advances. Payments already made are subtracted, which leaves the balance still to pay.
- **Money in & out** is the cash book. It lists every customer payment in, and every refund, expense, staff advance, staff payment and stock purchase out, grouped by day with totals. Staff cuts appear there when they are paid. The profit report counts them as soon as they are earned.
- **Expected cash in the drawer** = opening float + cash sales − cash paid out of the drawer (expenses, advances, staff payments, stock bought).
- **Expected cash** includes cash tips, because they sit in the drawer until the staff member is paid.
- Nothing is ever deleted. A void or correction is a new record with a reason, and every change appears in the activity log.

## Clients

Type the customer's phone number on the ticket (it's optional). The next time that number is typed, the till shows who they are: their name, visit number, when they last came, their usual barber and their favourite services. The **Clients** screen lists everyone with visits and total spent. It has filters for regulars, clients not seen in 30 days (worth a call) and new clients this month. There is no separate sign-up: the client book is built from the sales, so it always agrees with them.

## Keeping data safe

The shop's records are kept in several places at once, so no single failure loses them.

| What can go wrong | What protects the data |
|---|---|
| No internet | Every change is saved on the device first. It uploads when the connection returns. |
| The app is closed mid-sale | A sale only shows "Sale recorded" once it is saved on the device. Saves run one at a time, so they never overlap. |
| The phone runs low on storage | The app asks the browser for **persistent storage**, so its data isn't cleared to make space. If a save fails (storage full), a red banner says so and the app keeps retrying. |
| The device's saved file is damaged | Each device keeps a **daily copy for 7 days**. The file is checked on every start. If it is damaged, the newest good copy loads automatically and newer changes come back from the server. |
| Changes stuck on one phone | A warning appears after 6 hours not to clear the browser or uninstall the app. Backup & export shows exactly what is waiting. |
| A device is signed out, or its copy is replaced | An **archive** of its data is kept first. Changes in it that never uploaded can be sent from Backup & export, and the server accepts each one only once. |
| A phone is lost | Every other phone, and the server, has a full copy. |
| The server (self-hosted) is damaged | The server makes its own **daily copy** (`data/backups/`, or `BACKUP_DIR`) the first time a device syncs each day. It keeps 14 days plus one a month for a year. The owner can download these from the app with their PIN. |
| The server's database (Turso) is lost | Turso keeps point-in-time backups. You can also rebuild from a backup file (below). |
| Everything online is lost | **Restore from a backup file.** On the first-run screen of a new, empty server, choose *Restore a shop from a backup file* and enter the owner's PIN. This brings back the whole shop: sales, staff, pay, expenses, clients and logins. Changes in the file that had never reached the old server are sent too. Other phones notice the restore, keep an archive of their old copy, and download the restored shop. |

The owner should also keep their **own copy** off the phone. Backup & export → *Save to Drive / send* shares the backup file to Google Drive, email or WhatsApp in one tap. Home reminds the owner when no copy has been taken for 7 days.

To restore a self-hosted server from one of its own daily copies, stop the app and copy the file back:

```bash
cp data/backups/barbershop-2026-11-13.db data/barbershop.db && rm -f data/barbershop.db-wal data/barbershop.db-shm
```

### Spreadsheets

**More → Backup & export** also downloads CSV files for any period. They open in Excel or Google Sheets:

- sales line by line, with each person's % and cut;
- payments and tips;
- expenses;
- Money in & out;
- staff pay;
- clients.

Home also warns about drinks running low, and about a day with sales that was never closed. It compares today's sales with the same time last week.

## Run it

```bash
npm install          # also copies the offline SQLite engine into public/sqljs
cp .env.example .env.local   # then set AUTH_SECRET (openssl rand -base64 32)
npm run dev          # http://localhost:3000
```

The first visit asks for the shop name, currency and the owner's PIN. The owner then adds staff, the price list, and the manager and cashier logins (Settings → People who can sign in).

```bash
npm test             # calculation tests (commission, voids, payroll, P&L, cash-up, month-end, sorting)
npm run typecheck
npm run build && npm start
```

The tests include a **demo shop**: two months of realistic activity (about 360 tickets, many shared by several workers on one receipt, with drinks, discounts, tips, split payments, voids, expenses, rent, advances, bonuses, deductions, month-end pay and daily cash counts), generated from a fixed seed in `src/core/demo.ts`. The generator keeps its own ledger of what every figure should be, and the tests check every receipt split, monthly total, payslip, cash count and stored month-end against it, to the cent.

To click around that demo shop, run a **separate** server with its own database and load it (it refuses to touch a shop that is already set up):

```bash
npm run build                                        # (stop `npm run dev` first: one dev server per folder)
DATABASE_URL=file:data/demo.db npx next start -p 3200
npx tsx scripts/demo-shop.ts http://localhost:3200   # then sign in as Brian Otieno, PIN 1234
```

## On the phone

The app is built to feel like an installed app:

- a large title that collapses into the top bar;
- a tab bar, with a dot on More when changes are waiting to upload;
- bottom sheets you can swipe down to close;
- pull down to sync;
- on Sell, a floating ticket-and-charge bar, with a count on each tile showing how many are on the ticket;
- light haptic taps on Android;
- an install card, plus home-screen shortcuts (long-press the icon) for *New sale* and *Close the day*;
- support for safe areas (notches) and dark mode.

## Printing

Receipts, day-close slips, payslips and reports go through the browser's print dialog, so any printer the device can reach will work. That includes USB, Bluetooth and network thermal receipt printers (58 mm or 80 mm) and ordinary A4 printers. Set the paper width in Settings. On Android, a Bluetooth thermal printer needs a print-service app (for example RawBT) so it shows up in the print dialog.

## Offline and sync

Each device keeps a full copy of the shop's data in its own SQLite database: sql.js running in the browser, saved to IndexedDB. Every sale or change is saved there first, so the shop keeps working when the internet drops. Changes upload to the server as soon as there is a connection, and other devices download them the same way. On the server, every change is checked again against the user's role before it is accepted.

Sync is event-driven. It runs when something changes, when the connection comes back and when the app is brought to the front, plus once a minute while someone is actually using the screen. An idle or hidden tab never polls, so leaving the owner's dashboard open all day does not keep the server and database busy.

A device must be online once to connect to the shop (any user's PIN unlocks it). After that, people sign in with their PIN even offline. The owner can sign out a lost phone under Settings → Connected devices.

## Deploying

The server stores the master copy in SQLite through libSQL:

- **Self-hosted** (a small VPS, or a PC in the shop): keep the default `DATABASE_URL=file:data/barbershop.db`, run `npm run build && npm start`, and put it behind HTTPS. Back up the `data/` folder.
- **Vercel or another serverless host**: a local file won't persist there, so use a [Turso](https://turso.tech) database: `DATABASE_URL=libsql://…` plus `DATABASE_AUTH_TOKEN`.

HTTPS is required in production, because PWAs, offline caching and PIN hashing all need a secure origin. `AUTH_SECRET` must be set.

## Code map

```
src/core/       shared by browser and server
  schema.ts       tables (one definition for both databases)
  commands.ts     every change: validation, permissions, the writes
  reports.ts      every calculation: P&L, payroll, cash-up, stock, clients
  exports.ts      CSV exports
  backup.ts       backup retention and restore rules
  permissions.ts  owner / manager / cashier rules
src/server/     libSQL database, device tokens, daily server copies
src/app/api/    /status, /setup, /devices, /sync, /backup, /restore
src/client/     offline database, sync engine, app state, router
src/views/      screens (Sell, Sales, Reports, Staff pay, …)
tests/          calculation tests
```
