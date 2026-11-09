// Public connection settings for Supabase.
// These two values are meant to be public: the database's security rules
// decide what each signed-in person can see. Never put the secret
// (service_role) key or the database password in this file.
window.AKTL_CONFIG = {
  supabaseUrl: 'https://kyleldtbyjkgtulmhjbm.supabase.co',
  supabaseKey: 'sb_publishable_RPdGts_kFGIODlz8JHf5wQ_iHaBL2ly',
  loginDomain: '@aktl-kpi.local'   // must match private.login_email() in supabase/setup.sql
};
