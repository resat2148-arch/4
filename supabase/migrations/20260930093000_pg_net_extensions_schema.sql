-- pg_net was created without a schema and landed in public (Supabase linter
-- 0014). Recreate it in the extensions schema; its functions stay in schema
-- net, so private.request_moderation_notification() and friends are unchanged.
-- Only pending HTTP requests and stored responses are lost.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
