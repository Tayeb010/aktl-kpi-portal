# AKTL Sitakunda KPI Portal

Internal KPI reporting portal for the AKTL Sitakunda team (16 DSRs, DSOs, supervisors and managers).

- Admin uploads the daily SQR Excel file, checks a preview and publishes.
- Each DSR signs in with an ID and password and sees only their own KPIs and retailers.
- Managers and supervisors see the whole team.
- WhatsApp-ready report images per DSR.

Stack: static site on Cloudflare Pages, Supabase for database, login and access rules.
No KPI data or secret keys are stored in this repository.
