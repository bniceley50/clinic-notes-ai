CREATE TABLE public.invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  org_id      UUID NOT NULL REFERENCES public.orgs(id),
  role        TEXT NOT NULL DEFAULT 'provider',
  invited_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ,
  CONSTRAINT chk_invites_role CHECK (role IN ('provider', 'admin')),
  CONSTRAINT uq_invites_email_org UNIQUE (email, org_id)
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage invites"
  ON public.invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND org_id = invites.org_id
        AND role = 'admin'
    )
  );
