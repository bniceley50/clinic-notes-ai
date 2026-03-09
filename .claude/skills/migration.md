# migration

Repo schema conventions:

- organizations table is `public.orgs`, not `organizations`
- org foreign keys use `org_id UUID REFERENCES public.orgs(id)`
- auth linkage uses `profiles.user_id = auth.users.id`, not `profiles.id = auth.uid()`
- RLS helpers already exist: `public.is_org_member(org_id)` and `public.is_org_admin(org_id)`
- match existing RLS style: `created_by = auth.uid() AND public.is_org_member(org_id)`
- ship schema + RLS together in the same migration
- extend existing tables when appropriate; do not create duplicate compliance tables if one already exists