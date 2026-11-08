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
| `index.html`, `styles.css`, `app.js` | The website (no build step) |
| `config.js` | Supabase project URL and public (publishable) key |
| `supabase/setup.sql` | Database tables, security rules and admin functions |
| `_headers` | Security headers for Cloudflare Pages |

## One-time setup

1. **Supabase database**: open Supabase > SQL Editor > New query. Paste all of
   `supabase/setup.sql`, replace `CHANGE-THIS-PASSWORD` at the bottom with your own
   admin password, and press Run.
2. **Turn off self sign-up**: Supabase > Authentication > Sign In / Providers >
   turn off "Allow new users to sign up". Only the admin creates accounts.
3. **Cloudflare Pages**: Workers & Pages > Create > Pages > Connect to Git >
   choose this repository. Framework preset: None. Build command: empty.
   Build output directory: `/`. Deploy.
4. Sign in with login ID `tayeb` and your admin password. Upload the SQR file,
   publish, then go to People and create the DSR logins.

Every push to `main` updates the live site automatically.
