# AKTL Sitakunda KPI Portal

Internal KPI reporting portal for the AKTL Sitakunda team (16 DSRs, DSOs, supervisors and managers).

- Admin uploads the daily SQR Excel file, checks a preview and publishes.
- Each DSR signs in with an ID and password and sees only their own KPIs and retailers.
- Managers, supervisors and DSOs see the whole team.
- Each account can be used on at most 2 devices (admin is exempt).
- WhatsApp-ready report images per DSR.

No KPI data, passwords or secret keys are stored in this repository. All data lives in
Supabase, protected by row-level security rules in `supabase/setup.sql`.

## Files

| File | What it is |
|---|---|
| `site/` | The website (no build step): `index.html`, `styles.css`, `app.js`, `config.js` |
| `site/sqr-parse.js` | SQR Excel reader, shared by the Upload page and the publisher |
| `supabase/setup.sql` | Database tables, security rules and admin functions |
| `supabase/update-01-github-publisher.sql` | One-time update for databases set up before the publisher existed |
| `tools/kpi.cjs` | Publisher: `build` turns an Excel into `data/<kpi>/latest.json`, `publish` sends it to Supabase |
| `.github/workflows/publish-kpi.yml` | Publishes automatically when a `data/<kpi>/latest.json` changes on `main` |
| `supabase/update-02-trade-visibility.sql` | Optional update: Trade Visibility in the DSRs' Team tab |
| `site/_headers` | Security headers for Cloudflare Pages |

## One-time setup

1. **Supabase database**: open Supabase > SQL Editor > New query. Paste all of
   `supabase/setup.sql`, replace `CHANGE-THIS-PASSWORD` at the bottom with your own
   admin password, and press Run.
2. **Turn off self sign-up**: Supabase > Authentication > Sign In / Providers >
   turn off "Allow new users to sign up". Only the admin creates accounts.
3. **Cloudflare**: Workers & Pages > Create > import this repository. Deploy
   command `npx wrangler deploy`. `wrangler.jsonc` tells it to serve the `site`
   folder only.
4. Sign in with login ID `tayeb` and your admin password. Upload the SQR file,
   publish, then go to People and create the DSR logins.

Every push to `main` updates the live site automatically.

## KPIs

- **SQR · Super QR**: transaction-active retailers (300 Tk+) against the C2S target, QR visibility.
- **Trade Visibility**: every BCD POS must be visited 2 times. The file's "Retail Wise" sheet lists
  POS still to visit: "Pending" = needs 1st and 2nd visit, "1st Times Done" = needs 2nd visit only.
  DSRs are matched by number ("AKTL (Sitakunda) DSR 01" = "DSR-01"); MSISDNs are cut to the last 4 digits.

Each KPI has its own section on the home and team pages, with a "See details" button.

## Updating the KPIs

**Option A: send the Excel to Claude.** Claude runs `node tools/kpi.cjs build <file.xlsx>`,
checks the result, and pushes `data/<kpi>/latest.json`. The GitHub Action then publishes it.
Only figures and retailer lists are stored; retailer EL phone numbers are never saved.

**Option B: the website.** Sign in as admin > Upload > choose the file > Publish.

Both read the file with the same `site/sqr-parse.js`. Supported layouts:
a summary sheet (e.g. "Summury": DSR Name, Retailers, Retailer has Request,
Retailer Trxn Active, C2S Target, QR Target, QR Visibility Success, photo checks)
plus a retailer sheet (DSR Profile Code, DSR Name, Retailer Code, retail name,
COMPLETED Amount, QR Visibility, photo checks), or the older "DSR Wise" layout.
C2S target = retailers targeted for a 300 Tk+ transaction; QR target = number of retailers.

Publisher setup (once): run `supabase/update-01-github-publisher.sql` in Supabase, then add
the Supabase secret key as the GitHub Actions secret `SUPABASE_SECRET_KEY`.
