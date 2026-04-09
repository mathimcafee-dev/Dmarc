-- DNSMonitor - Multi-tenant DMARC & DNS Management SaaS
-- Supabase Schema - Phase 1
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- ORGANISATIONS (tenants)
-- ============================================================
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- used in URL: dnsmonitor.easysecurity.in/org/slug
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORG MEMBERS (user <-> org relationship)
-- ============================================================
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member', 'viewer');

CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(org_id, user_id)
);

-- ============================================================
-- ORG INVITATIONS (pending invites)
-- ============================================================
CREATE TABLE IF NOT EXISTS org_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

-- ============================================================
-- USER PROFILES (extended auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  default_org_id UUID REFERENCES organisations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DOMAINS (per org)
-- ============================================================
CREATE TYPE domain_status AS ENUM ('pending_verification', 'active', 'error');

CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status domain_status NOT NULL DEFAULT 'pending_verification',
  verification_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  verified_at TIMESTAMPTZ,
  added_by UUID REFERENCES auth.users(id),
  last_checked_at TIMESTAMPTZ,
  health_score INTEGER DEFAULT 0 CHECK (health_score >= 0 AND health_score <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, domain)
);

-- ============================================================
-- DMARC RECORDS (current + history per domain)
-- ============================================================
CREATE TABLE IF NOT EXISTS dmarc_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  raw_record TEXT,
  policy TEXT CHECK (policy IN ('none', 'quarantine', 'reject')),
  subdomain_policy TEXT CHECK (subdomain_policy IN ('none', 'quarantine', 'reject')),
  pct INTEGER DEFAULT 100 CHECK (pct >= 0 AND pct <= 100),
  rua TEXT[], -- aggregate report URIs
  ruf TEXT[], -- forensic report URIs
  adkim TEXT CHECK (adkim IN ('r', 's')), -- DKIM alignment
  aspf TEXT CHECK (aspf IN ('r', 's')),   -- SPF alignment
  fo TEXT,    -- failure options
  rf TEXT,    -- report format
  ri INTEGER, -- report interval
  is_current BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SPF RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS spf_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  raw_record TEXT,
  mechanisms JSONB DEFAULT '[]',  -- [{type: 'include', value: 'spf.google.com', qualifier: '+'}]
  lookup_count INTEGER DEFAULT 0,
  is_valid BOOLEAN,
  is_current BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DKIM RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS dkim_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  selector TEXT NOT NULL,
  raw_record TEXT,
  key_type TEXT,
  public_key TEXT,
  is_valid BOOLEAN,
  is_current BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain_id, selector)
);

-- ============================================================
-- BIMI RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS bimi_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  raw_record TEXT,
  logo_url TEXT,
  vmc_url TEXT,
  is_valid BOOLEAN,
  is_current BOOLEAN DEFAULT true,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DNS TIMELINE (change history)
-- ============================================================
CREATE TYPE dns_record_type AS ENUM ('dmarc', 'spf', 'dkim', 'bimi', 'mta_sts', 'tls_rpt', 'mx', 'txt');

CREATE TABLE IF NOT EXISTS dns_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  record_type dns_record_type NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  change_detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALERTS CONFIG
-- ============================================================
CREATE TYPE alert_type AS ENUM (
  'dmarc_policy_change', 
  'spf_failure', 
  'dkim_failure', 
  'domain_expiry',
  'health_score_drop',
  'new_sending_source'
);

CREATE TABLE IF NOT EXISTS alert_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE CASCADE, -- NULL = all domains
  alert_type alert_type NOT NULL,
  email_recipients TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmarc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE spf_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dkim_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE bimi_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dns_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's orgs
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT org_id FROM org_members 
    WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is org admin/owner
CREATE OR REPLACE FUNCTION is_org_admin(p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members 
    WHERE org_id = p_org_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin')
    AND accepted_at IS NOT NULL
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ORGANISATIONS policies
CREATE POLICY "Users can view their orgs" ON organisations
  FOR SELECT USING (id = ANY(get_user_org_ids()));

CREATE POLICY "Admins can update their org" ON organisations
  FOR UPDATE USING (is_org_admin(id));

CREATE POLICY "Authenticated users can create orgs" ON organisations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ORG MEMBERS policies
CREATE POLICY "Members can view their org members" ON org_members
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "Admins can manage members" ON org_members
  FOR ALL USING (is_org_admin(org_id));

CREATE POLICY "Users can see their own membership" ON org_members
  FOR SELECT USING (user_id = auth.uid());

-- ORG INVITATIONS policies
CREATE POLICY "Admins can manage invitations" ON org_invitations
  FOR ALL USING (is_org_admin(org_id));

CREATE POLICY "Anyone can view invitation by token" ON org_invitations
  FOR SELECT USING (true); -- token-gated at app level

-- PROFILES policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- DOMAINS policies
CREATE POLICY "Org members can view domains" ON domains
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "Org admins can manage domains" ON domains
  FOR ALL USING (is_org_admin(org_id));

-- DNS record tables policies (same pattern)
CREATE POLICY "Org members can view dmarc records" ON dmarc_records
  FOR SELECT USING (
    domain_id IN (SELECT id FROM domains WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members can view spf records" ON spf_records
  FOR SELECT USING (
    domain_id IN (SELECT id FROM domains WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members can view dkim records" ON dkim_records
  FOR SELECT USING (
    domain_id IN (SELECT id FROM domains WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members can view bimi records" ON bimi_records
  FOR SELECT USING (
    domain_id IN (SELECT id FROM domains WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members can view dns timeline" ON dns_timeline
  FOR SELECT USING (
    domain_id IN (SELECT id FROM domains WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members can view alerts" ON alert_configs
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "Org admins can manage alerts" ON alert_configs
  FOR ALL USING (is_org_admin(org_id));

CREATE POLICY "Org members can view audit logs" ON audit_logs
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organisations_updated_at BEFORE UPDATE ON organisations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER domains_updated_at BEFORE UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);
CREATE INDEX idx_domains_org_id ON domains(org_id);
CREATE INDEX idx_dmarc_records_domain_id ON dmarc_records(domain_id);
CREATE INDEX idx_spf_records_domain_id ON spf_records(domain_id);
CREATE INDEX idx_dkim_records_domain_id ON dkim_records(domain_id);
CREATE INDEX idx_dns_timeline_domain_id ON dns_timeline(domain_id);
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);

-- ============================================================
-- PHASE 2 ADDITIONS
-- ============================================================

-- DMARC Aggregate Reports (RUA XML parsed)
CREATE TABLE IF NOT EXISTS dmarc_aggregate_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  report_id TEXT,
  org_name TEXT,
  email TEXT,
  extra_contact_info TEXT,
  report_begin TIMESTAMPTZ,
  report_end TIMESTAMPTZ,
  policy_domain TEXT,
  policy_adkim TEXT,
  policy_aspf TEXT,
  policy_p TEXT,
  policy_sp TEXT,
  policy_pct INTEGER,
  raw_xml TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DMARC Report Records (rows inside aggregate reports)
CREATE TABLE IF NOT EXISTS dmarc_report_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES dmarc_aggregate_reports(id) ON DELETE CASCADE,
  source_ip INET,
  count INTEGER DEFAULT 0,
  disposition TEXT,
  dkim_result TEXT,
  spf_result TEXT,
  header_from TEXT,
  envelope_from TEXT,
  envelope_to TEXT,
  dkim_domain TEXT,
  dkim_selector TEXT,
  dkim_human_result TEXT,
  spf_domain TEXT,
  spf_scope TEXT,
  spf_human_result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert Events (fired alerts history)
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES domains(id) ON DELETE SET NULL,
  alert_type alert_type NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled scan queue
CREATE TABLE IF NOT EXISTS scan_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  error_message TEXT
);

-- RLS for new tables
ALTER TABLE dmarc_aggregate_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dmarc_report_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view aggregate reports" ON dmarc_aggregate_reports
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "Org members view report records" ON dmarc_report_records
  FOR SELECT USING (
    report_id IN (SELECT id FROM dmarc_aggregate_reports WHERE org_id = ANY(get_user_org_ids()))
  );

CREATE POLICY "Org members view alert events" ON alert_events
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE POLICY "Org members view scan queue" ON scan_queue
  FOR SELECT USING (org_id = ANY(get_user_org_ids()));

CREATE INDEX idx_dmarc_reports_domain_id ON dmarc_aggregate_reports(domain_id);
CREATE INDEX idx_dmarc_reports_org_id ON dmarc_aggregate_reports(org_id);
CREATE INDEX idx_dmarc_report_records_report_id ON dmarc_report_records(report_id);
CREATE INDEX idx_alert_events_org_id ON alert_events(org_id);
CREATE INDEX idx_dns_timeline_created_at ON dns_timeline(created_at DESC);
