-- Migration: CDSS Audit Log Table Schema (2026.08.26 Specification)

CREATE TABLE IF NOT EXISTS cdss_audit_log (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    patient_id TEXT NOT NULL,
    mrn TEXT,
    visit_id TEXT,
    clinician_id TEXT,
    alert_id TEXT NOT NULL,
    alert_title TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('accept', 'override', 'defer')),
    override_reason TEXT,
    override_reason_code TEXT,
    override_notes TEXT,
    defer_until DATE,
    med_change JSONB,
    snapshot JSONB,
    request_id TEXT,
    engine_version TEXT,
    rule_version TEXT,
    index_alert_date DATE,
    research_window TEXT CHECK (research_window IN ('pre-alert', 'index', 'post-alert', 'outside')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for rapid clinical queries and research dataset extraction
CREATE INDEX IF NOT EXISTS idx_cdss_audit_patient_id ON cdss_audit_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_cdss_audit_timestamp ON cdss_audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cdss_audit_window ON cdss_audit_log (research_window);
CREATE INDEX IF NOT EXISTS idx_cdss_audit_action ON cdss_audit_log (action);
