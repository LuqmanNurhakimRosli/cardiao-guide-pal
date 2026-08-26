CREATE TABLE public.cdss_research_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  mrn text NOT NULL,
  visit_id text NOT NULL,
  index_alert_date date NOT NULL,
  pre_alert_start date NOT NULL,
  pre_alert_end date NOT NULL,
  post_alert_start date NOT NULL,
  post_alert_end date NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patient_id, visit_id)
);
GRANT SELECT, INSERT, UPDATE ON public.cdss_research_timelines TO authenticated;
GRANT ALL ON public.cdss_research_timelines TO service_role;
ALTER TABLE public.cdss_research_timelines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinicians can view research timelines"
ON public.cdss_research_timelines FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Clinicians can create research timelines"
ON public.cdss_research_timelines FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());
CREATE POLICY "Timeline creators can update timelines"
ON public.cdss_research_timelines FOR UPDATE TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

CREATE TABLE public.cdss_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  mrn text NOT NULL,
  visit_id text NOT NULL,
  clinician_id uuid NOT NULL DEFAULT auth.uid(),
  request_id text,
  engine_version text NOT NULL,
  rule_version text NOT NULL,
  index_alert_date date,
  research_window text CHECK (research_window IN ('pre-alert', 'index', 'post-alert', 'outside')),
  event_category text NOT NULL,
  alert_id text,
  alert_title text,
  action text CHECK (action IN ('accept', 'override', 'defer')),
  reason_code text,
  reason_text text,
  notes text,
  doctor_plan text,
  monitoring_plan text,
  next_appointment_date date,
  medication_change jsonb,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cdss_audit_events TO authenticated;
GRANT ALL ON public.cdss_audit_events TO service_role;
ALTER TABLE public.cdss_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinicians can view audit events"
ON public.cdss_audit_events FOR SELECT TO authenticated
USING (true);
CREATE POLICY "Clinicians can create audit events"
ON public.cdss_audit_events FOR INSERT TO authenticated
WITH CHECK (clinician_id = auth.uid());

CREATE INDEX cdss_audit_events_patient_occurred_idx
ON public.cdss_audit_events (patient_id, occurred_at DESC);
CREATE INDEX cdss_audit_events_visit_idx
ON public.cdss_audit_events (visit_id);
CREATE INDEX cdss_audit_events_index_date_idx
ON public.cdss_audit_events (index_alert_date);

CREATE OR REPLACE FUNCTION public.set_cdss_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_cdss_research_timelines_updated_at
BEFORE UPDATE ON public.cdss_research_timelines
FOR EACH ROW EXECUTE FUNCTION public.set_cdss_updated_at();