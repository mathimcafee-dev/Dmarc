import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import {
  ChevronRight, RotateCcw, CheckCircle2,
  User, Building2, Mail, ArrowRight, Clock,
  ChevronDown, ChevronUp, Trash2, Plus, Cpu
} from 'lucide-react'

// ─── PRODUCT META ─────────────────────────────────────────────────────────────
const PM = {
  scm_enterprise: { label:'SCM Enterprise',         color:'#0D6E56', bg:'#E8F7F2', icon:'🏢' },
  private_pki:    { label:'Private PKI',             color:'#1A4FBA', bg:'#EBF0FD', icon:'🔒' },
  smime:          { label:'S/MIME Solutions',         color:'#4E35C2', bg:'#EDEBFC', icon:'✉️' },
  devops:         { label:'DevOps PKI',              color:'#0F5C8A', bg:'#E6F2FA', icon:'⚙️' },
  code_signing:   { label:'Code Signing',            color:'#2D6B1A', bg:'#EBF5E6', icon:'📝' },
  pqc:            { label:'PQC / Quantum Labs',       color:'#3C2E99', bg:'#EDEAFB', icon:'⚛️' },
  vmc_cmc:        { label:'VMC / CMC (BIMI)',         color:'#854F0B', bg:'#FEF3E0', icon:'🏷️' },
  ms_ca_mgmt:     { label:'Microsoft CA Management', color:'#0F3A8A', bg:'#E8EFFB', icon:'🖥️' },
}

const PRODUCT_SUMMARIES = {
  scm_enterprise: "Based on your organisation's scale, infrastructure complexity, and certificate volume, you need a CA-agnostic platform that manages public, private, and specialty certificates with full automation across hybrid environments. SCM Enterprise delivers exactly this.",
  private_pki:    "Your answers confirm you need a fully managed internal certificate authority — one that extends beyond AD CS to cover non-Windows devices, IoT, mobile, and zero-trust workloads at enterprise scale.",
  smime:          "Your email security posture has clear gaps that S/MIME certificates will directly address. Digital signing and end-to-end encryption together stop both impersonation attacks and data leakage in transit.",
  devops:         "Your DevOps environment needs a certificate platform built for speed, volume, and ephemeral workloads — with deep integrations into your pipeline tooling and no rate limits to block your CI/CD flow.",
  code_signing:   "Your software distribution chain needs cryptographic proof of integrity. Sectigo Code Signing certificates with HSM-backed keys eliminate SmartScreen warnings and integrate directly into your pipeline.",
  pqc:            "Your answers signal an urgent need to begin post-quantum cryptography preparation. Sectigo PQC Labs and Private PQC give you a structured, low-risk path from cryptographic inventory to full migration.",
  vmc_cmc:        "Your brand has the foundation for BIMI deployment. VMC/CMC certificates will display your verified logo in Gmail, Apple Mail, and Yahoo — boosting sender trust and reducing brand impersonation.",
  ms_ca_mgmt:     "Your AD CS environment has coverage gaps and visibility blind spots that the Sectigo Certificate Manager connector directly solves — adding a single pane of glass over your entire certificate estate.",
}

const NEXT_STEPS = [
  'Schedule a live demo with a Sectigo solutions engineer',
  'Request a proof-of-concept environment (free trial)',
  'Download the relevant datasheet and Forrester TEI study',
  'Have your PKI team review the integration documentation',
]

// ─── TRIAGE QUESTIONS (8) ─────────────────────────────────────────────────────
const TRIAGE_QS = [
  { id:'role', title:'What is your role in this evaluation?', sub:'This shapes how technical our recommendations will be.',
    opts:[{val:'engineer',label:'Security / PKI engineer',desc:'I configure and manage PKI day-to-day'},{val:'architect',label:'IT / Infrastructure architect',desc:'I design the systems that run PKI'},{val:'ciso',label:'IT manager / CISO',desc:'I own the security strategy and budget'},{val:'devops_role',label:'DevOps / Platform engineer',desc:'I build CI/CD pipelines and containers'}]},
  { id:'primary_pain', title:'What is the single biggest PKI problem you need solved?', sub:'Be direct — this gates the entire discovery path.',
    opts:[{val:'outages',label:'Certificate outages & expirations',desc:'Sites going down, trust errors, fire drills'},{val:'email_phishing',label:'Email phishing & impersonation',desc:'Spoofed corporate email, BEC attacks'},{val:'code_trust',label:'Untrusted software / tampered code',desc:'Unsigned builds, supply chain risk'},{val:'internal_visibility',label:'No visibility into internal certs',desc:'Unknown devices, shadow PKI, rogue certs'},{val:'devops_certs',label:'DevOps cert chaos at scale',desc:'Ephemeral certs, Kubernetes, CI/CD gaps'},{val:'pqc_readiness',label:'Quantum cryptography readiness',desc:'PQC migration, crypto-agility strategy'},{val:'bimi',label:'Brand trust in email (BIMI / VMC)',desc:'Logo in Gmail, Apple Mail'}]},
  { id:'org_size', title:'How large is your organisation?', sub:'Certificate volume and licensing tier scale with headcount.',
    opts:[{val:'small',label:'< 250 employees',desc:'SMB / startup'},{val:'mid',label:'250 – 2,500',desc:'Mid-market'},{val:'large',label:'2,500 – 25,000',desc:'Large enterprise'},{val:'xlarge',label:'25,000+',desc:'Global / complex org'}]},
  { id:'cert_volume', title:'How many digital certificates are in scope?', sub:'Include every type — SSL/TLS, email, device, code signing.',
    opts:[{val:'low',label:'< 100',desc:'Small footprint'},{val:'mid',label:'100 – 1,000',desc:'Growing estate'},{val:'high',label:'1,000 – 10,000',desc:'Large estate'},{val:'xlarge',label:'10,000+',desc:'Very large / dynamic'}]},
  { id:'infra', title:'What does your infrastructure look like?', sub:'Determines which automation protocols and integrations matter.',
    opts:[{val:'cloud',label:'Cloud-native',desc:'AWS / GCP / Azure'},{val:'onprem',label:'On-premises only',desc:'Data centres, Windows Server'},{val:'hybrid',label:'Hybrid',desc:'Mix of cloud and on-prem'},{val:'complex',label:'Multi-cloud + legacy',desc:'Complex, heterogeneous estate'}]},
  { id:'ms_ca', title:'Are you running Microsoft Active Directory Certificate Services (AD CS)?', sub:'AD CS is common in enterprise Windows environments.',
    opts:[{val:'yes',label:"Yes, it's our primary CA",desc:'Windows-centric environment'},{val:'partial',label:'Yes, but limited coverage',desc:"Can't cover non-Windows devices"},{val:'no',label:'No, we use another CA',desc:"DigiCert, Let's Encrypt, AWS PCA…"},{val:'unknown',label:'Unsure / need discovery',desc:"We don't have full visibility yet"}]},
  { id:'automation_level', title:'How automated is your current certificate management?', sub:'Honest answers lead to better recommendations.',
    opts:[{val:'manual',label:'Fully manual',desc:'Spreadsheets, calendar alerts, ad-hoc'},{val:'partial',label:'Partially automated',desc:'Some ACME or scripts, but gaps exist'},{val:'devops',label:'DevOps integrated',desc:'CI/CD pipelines, Kubernetes'},{val:'chaos',label:'Multi-CA chaos',desc:'No unified visibility across tools'}]},
  { id:'compliance', title:'Are you subject to specific compliance or regulatory requirements?', sub:'Certain cert types are mandated by specific frameworks.',
    opts:[{val:'gov',label:'Government / public sector',desc:'FedRAMP, FISMA, CMMC, eIDAS'},{val:'fin',label:'Financial services',desc:'PCI-DSS, SOX, DORA'},{val:'health',label:'Healthcare / life sciences',desc:'HIPAA, FDA 21 CFR Part 11'},{val:'ot',label:'Manufacturing / OT / IoT',desc:'IEC 62443, ISA/IEC security standards'},{val:'none',label:'No specific compliance',desc:'General best-practice security'}]},
]

// ─── DEEP QUESTIONS — 15 per product ─────────────────────────────────────────
const DEEP_QS = {
  scm_enterprise:[
    {id:'cert_types_mix',title:'Which certificate types do you need under a single platform?',sub:'Select the closest to your full estate.',opts:[{val:'ssl_only',label:'Public SSL/TLS only',desc:'Web servers, APIs, load balancers'},{val:'ssl_smime',label:'SSL + S/MIME email',desc:'Web + encrypted/signed email'},{val:'ssl_private',label:'SSL + private/internal certs',desc:'Web + device/user/app identity'},{val:'all_types',label:'All types: SSL, S/MIME, code, IoT, private',desc:'Full enterprise mixed estate'}]},
    {id:'ca_vendors',title:'How many different CAs are you currently working with?',sub:'CA sprawl is one of the leading causes of outages.',opts:[{val:'one',label:'One CA',desc:'Single CA, but want more control'},{val:'two_three',label:'2–3 CAs',desc:'Some consolidation needed'},{val:'four_plus',label:'4+ CAs',desc:'Significant sprawl, urgent consolidation'},{val:'unknown_ca',label:'Unknown — no full inventory',desc:'Shadow certs are a real concern'}]},
    {id:'discovery_status',title:'Have you ever done a full certificate discovery?',sub:'Most enterprises find 30–40% more certs than expected.',opts:[{val:'never',label:'Never done a full discovery',desc:"We don't know our full footprint"},{val:'partial_disc',label:'Partial scan done',desc:'We covered some segments'},{val:'regular_disc',label:'Regular discovery runs',desc:'But still manual or fragmented'},{val:'automated_disc',label:'Fully automated discovery',desc:'Looking for a better platform'}]},
    {id:'renewal_pain',title:'How much manual effort goes into certificate renewals today?',sub:'47-day SSL lifespans are coming — this is urgent.',opts:[{val:'high_pain',label:"Very high — it's a constant fire drill",desc:'Renewals take days, outages happen'},{val:'medium_pain',label:'Moderate — manageable but risky',desc:'We usually catch it in time'},{val:'low_pain',label:'Low — we have scripts/reminders',desc:"Works for now, won't scale"},{val:'no_pain',label:'Minimal — largely automated',desc:'Looking to extend/improve'}]},
    {id:'cloud_providers',title:'Which cloud providers are in your environment?',sub:'SCM has pre-built integrations for each of these.',opts:[{val:'aws',label:'AWS only',desc:'ACM, AWS Private CA'},{val:'azure',label:'Azure / Microsoft 365',desc:'Azure Key Vault, Entra ID'},{val:'gcp',label:'Google Cloud Platform',desc:'GCP Certificate Authority Service'},{val:'multi_cloud',label:'Multiple cloud providers',desc:'Heterogeneous cloud estate'}]},
    {id:'integration_tools',title:'Which infrastructure/automation tools do you use?',sub:'Determines integration depth.',opts:[{val:'hashicorp',label:'HashiCorp Vault / Terraform',desc:'Key vault and IaC workflows'},{val:'kubernetes',label:'Kubernetes + cert-manager',desc:'Container certificate automation'},{val:'servicenow',label:'ServiceNow',desc:'ITSM + cert lifecycle workflows'},{val:'standard_acme',label:'Standard ACME clients',desc:'Certbot, acme.sh, Caddy'}]},
    {id:'key_storage',title:'Where do you store private keys today?',sub:'Key protection is a critical audit point.',opts:[{val:'hsm',label:'Hardware Security Module (HSM)',desc:'Physical or cloud HSM'},{val:'software_store',label:'Software keystores',desc:'OS certificate store, JKS, PEM files'},{val:'cloud_kms',label:'Cloud KMS / key vault',desc:'AWS KMS, Azure Key Vault, GCP KMS'},{val:'no_standard',label:'No standard practice',desc:'Ad-hoc, team-dependent'}]},
    {id:'team_size',title:'How many people manage PKI / certificates today?',sub:'Staffing affects automation ROI calculation.',opts:[{val:'one_person',label:'One person (part-time)',desc:'PKI is one of many duties'},{val:'small_team',label:'2–5 people',desc:'Dedicated but small team'},{val:'medium_team',label:'5–15 people',desc:'Structured PKI function'},{val:'large_team',label:'15+ people',desc:'Enterprise PKI/IAM team'}]},
    {id:'previous_incidents',title:'Have you experienced a certificate-related outage in the last 12 months?',sub:'Outages dramatically increase automation urgency.',opts:[{val:'major_outage',label:'Yes — major outage / P1 incident',desc:'Significant business impact'},{val:'minor_incident',label:'Yes — minor incident or near-miss',desc:'Caught it just in time'},{val:'no_incident',label:'No incidents',desc:'But we know the risk exists'},{val:'not_tracked',label:'Not tracked / unknown',desc:"We don't have cert incident logging"}]},
    {id:'vendor_lock',title:'Are you concerned about vendor lock-in with your current CA?',sub:'CA-agnostic CLM lets you switch or dual-source freely.',opts:[{val:'major_concern',label:"Yes — it's a strategic risk",desc:'Locked in, single point of failure'},{val:'some_concern',label:'Somewhat concerned',desc:'Would prefer flexibility'},{val:'not_concern',label:'Not a current concern',desc:'Happy with our CA today'},{val:'open_to_change',label:'Actively evaluating CA alternatives',desc:'Looking to switch or multi-source'}]},
    {id:'acme_readiness',title:'Are your systems ACME-protocol ready?',sub:'ACME is the gold standard for automated TLS renewal.',opts:[{val:'full_acme',label:'Yes — ACME is deployed',desc:'Running certbot, acme.sh, or equivalent'},{val:'partial_acme',label:'Partial — some servers only',desc:'Mixed estate, not fully covered'},{val:'no_acme',label:'No ACME deployed',desc:'All manual renewals today'},{val:'evaluating_acme',label:'Evaluating ACME adoption',desc:'Planning to roll out soon'}]},
    {id:'reporting_needs',title:'How important is audit-grade certificate reporting?',sub:'Compliance teams and auditors typically require this.',opts:[{val:'critical_report',label:'Critical — auditors require it',desc:'SOX, ISO 27001, FedRAMP controls'},{val:'important_report',label:'Important — internal governance',desc:'Security team reviews quarterly'},{val:'nice_to_have',label:'Nice to have',desc:'Would use it if available'},{val:'not_needed',label:'Not currently required',desc:'No audit obligation today'}]},
    {id:'timeline',title:'What is your implementation timeline?',sub:'This affects the recommendation tier and approach.',opts:[{val:'urgent',label:'Urgent — within 30 days',desc:'Active outage risk or mandate'},{val:'q_this',label:'This quarter',desc:'3-month deployment window'},{val:'six_months',label:'3–6 months',desc:'Planned project, some flexibility'},{val:'exploring',label:'Exploring / evaluating',desc:'No hard deadline yet'}]},
    {id:'budget_signal',title:'How is this investment being framed internally?',sub:'Shapes the business case and tier recommendation.',opts:[{val:'security_budget',label:'Security / risk reduction budget',desc:'Funded via security programme'},{val:'ops_budget',label:'IT operations / efficiency budget',desc:'Reducing manual overhead'},{val:'compliance_budget',label:'Compliance / audit budget',desc:'Driven by regulatory requirement'},{val:'no_budget',label:'Budget not yet approved',desc:'Need to build business case first'}]},
    {id:'pqc_awareness',title:'Are post-quantum cryptography requirements on your roadmap?',sub:'NIST has finalised ML-DSA standards.',opts:[{val:'active_pqc',label:'Yes — active PQC initiative',desc:'Testing or implementing now'},{val:'planned_pqc',label:'On the 12-month roadmap',desc:'Planning phase, not started'},{val:'aware_pqc',label:'Aware but no plan yet',desc:'Know we need to act'},{val:'not_pqc',label:'Not on our radar',desc:'Not a current concern'}]},
  ],
  private_pki:[
    {id:'internal_ca_today',title:'What internal CA infrastructure do you have today?',sub:'Starting point determines migration path.',opts:[{val:'ms_adcs_only',label:'Microsoft AD CS only',desc:'Windows-centric, no external CA'},{val:'ms_adcs_limited',label:'AD CS, but gaps for non-Windows',desc:'Mobile, IoT, Linux not covered'},{val:'no_internal_ca',label:'No internal CA at all',desc:'Self-signed or nothing'},{val:'legacy_pki',label:'Legacy in-house PKI',desc:'Old CA, hard to maintain'}]},
    {id:'identity_scope',title:'Which identities need private certificates?',sub:'Private PKI covers far more than just servers.',opts:[{val:'servers_only',label:'Internal web servers / APIs only',desc:'Intranet, internal apps'},{val:'users_devices',label:'Users + endpoints',desc:'BYOD, Windows Hello, smart card'},{val:'iot_devices',label:'IoT / OT devices at scale',desc:'Embedded devices, sensors, gateways'},{val:'everything',label:'All of the above + service accounts',desc:'Full machine & human identity'}]},
    {id:'zero_trust_status',title:'Where are you on your Zero Trust journey?',sub:'Private PKI is the certificate engine of Zero Trust.',opts:[{val:'zt_live',label:'Zero Trust deployed and running',desc:'Need PKI to scale with it'},{val:'zt_in_progress',label:'Zero Trust implementation in progress',desc:'PKI is a dependency'},{val:'zt_planned',label:'Zero Trust planned but not started',desc:'PKI will be required'},{val:'zt_none',label:'No Zero Trust initiative',desc:'Traditional perimeter security'}]},
    {id:'mdm_idp',title:'Which MDM / Identity Provider are you using?',sub:'Determines zero-touch provisioning automation.',opts:[{val:'intune',label:'Microsoft Intune + Entra ID',desc:'SCEP/NDES for cert push'},{val:'jamf',label:'Jamf (Apple macOS/iOS)',desc:'MDM profiles for cert deployment'},{val:'okta_ping',label:'Okta / PingIdentity',desc:'IdP-driven cert provisioning'},{val:'no_mdm',label:'No MDM / fragmented',desc:'Manual deployment today'}]},
    {id:'iot_volume',title:'How many IoT / connected devices need certificates?',sub:'IoT PKI requires high-throughput issuance pipelines.',opts:[{val:'no_iot',label:'No IoT devices',desc:'Not applicable'},{val:'iot_hundreds',label:'Hundreds',desc:'Manageable volume'},{val:'iot_thousands',label:'Thousands',desc:'Requires automation'},{val:'iot_millions',label:'Tens of thousands or more',desc:'High-throughput supply chain provisioning'}]},
    {id:'vpn_wifi_auth',title:'Are you using certificate-based auth for VPN or Wi-Fi?',sub:'EAP-TLS via private CA is the strongest network auth method.',opts:[{val:'eap_live',label:'Yes — EAP-TLS deployed',desc:'Private certs for network auth'},{val:'eap_psk',label:'No — using pre-shared keys',desc:'Want to move to cert-based'},{val:'eap_mixed',label:'Mixed — some cert, some password',desc:'Inconsistent coverage'},{val:'eap_no_need',label:'Not applicable',desc:'No VPN / managed Wi-Fi'}]},
    {id:'key_escrow',title:'Do you require key escrow or key recovery?',sub:'Required in regulated industries.',opts:[{val:'escrow_required',label:'Yes — legally / compliance required',desc:'eDiscovery, data recovery mandate'},{val:'escrow_desired',label:'Desired but not mandated',desc:'Want recovery capability'},{val:'no_escrow',label:'Not required',desc:'Zero-knowledge preferred'},{val:'unsure_escrow',label:'Unsure',desc:'Need to check with legal/compliance'}]},
    {id:'hsm_requirement',title:'Do you have an HSM requirement for private key storage?',sub:'Many compliance frameworks mandate HSM-backed CA roots.',opts:[{val:'hsm_required',label:'Yes — mandated by compliance',desc:'FIPS 140-2/3 Level 3 required'},{val:'hsm_preferred',label:'Preferred but not mandated',desc:'Best practice desired'},{val:'hsm_no',label:'No HSM requirement',desc:'Software keystores acceptable'},{val:'hsm_existing',label:'We already have an HSM',desc:'Need CA to integrate with it'}]},
    {id:'sub_ca_model',title:'Do you need a dedicated private subordinate CA?',sub:'A dedicated sub CA gives you complete policy control.',opts:[{val:'dedicated_sub_ca',label:'Yes — branded sub CA required',desc:'MyCompany CA policy control'},{val:'shared_sub_ca',label:'Shared sub CA acceptable',desc:'Simpler, faster to deploy'},{val:'bring_own_root',label:"We'll bring our own root CA",desc:'Existing PKI hierarchy'},{val:'unsure_sub_ca',label:'Unsure — need guidance',desc:"Haven't designed the hierarchy yet"}]},
    {id:'cert_templates',title:'How complex are your certificate policy requirements?',sub:'Custom templates and policy enforcement matter for enterprise PKI.',opts:[{val:'simple_templates',label:'Simple — standard TLS certs',desc:'No custom OIDs or policies'},{val:'custom_templates',label:'Custom templates needed',desc:'Custom SANs, OIDs, key usage'},{val:'complex_policies',label:'Complex policy enforcement',desc:'RBAC, department-based issuance'},{val:'cp_cps_required',label:'Formal CP/CPS documents required',desc:'Regulated or audited environment'}]},
    {id:'non_windows_devices',title:'What proportion of your endpoints are non-Windows?',sub:'AD CS alone cannot provision non-Windows devices.',opts:[{val:'mostly_windows',label:'< 20% non-Windows',desc:'Mostly Windows estate'},{val:'mixed',label:'20–50% non-Windows',desc:'Significant Mac/Linux/mobile estate'},{val:'majority_non_win',label:'> 50% non-Windows',desc:'Mac-heavy or diverse fleet'},{val:'byod_heavy',label:'Significant BYOD / personal devices',desc:'Employee-owned endpoints'}]},
    {id:'cert_enroll_method',title:'How do you want certificates delivered to devices and users?',sub:'Provisioning method affects deployment complexity.',opts:[{val:'scep_ndes',label:'SCEP / NDES',desc:'Automated push via MDM'},{val:'est_protocol',label:'EST protocol',desc:'Modern IETF standard'},{val:'manual_enroll',label:'Manual / self-service portal',desc:'Users request their own certs'},{val:'api_driven',label:'REST API / programmatic',desc:'Developer / DevOps driven'}]},
    {id:'revocation_speed',title:'How quickly must certificate revocation take effect?',sub:'Revocation speed affects CRL vs OCSP design decisions.',opts:[{val:'instant_revocation',label:'Near-instant (< 1 hour)',desc:'Security incident response'},{val:'same_day',label:'Same business day',desc:'Standard security response'},{val:'standard_crl',label:'Standard CRL refresh is fine',desc:'24–48 hours acceptable'},{val:'revocation_unknown',label:"Haven't considered this",desc:'Need guidance'}]},
    {id:'dr_requirements',title:'What are your disaster recovery requirements for the CA?',sub:'An offline CA equals broken authentication.',opts:[{val:'ha_required',label:'High availability — multi-region',desc:'No single point of failure'},{val:'backup_ca',label:'Backup CA with fast failover',desc:'< 4 hours RTO'},{val:'standard_dr',label:'Standard DR acceptable',desc:'Best effort, < 24 hours'},{val:'dr_not_defined',label:'DR not yet defined',desc:'Need help designing'}]},
    {id:'iot_supply_chain',title:'Do you need certificate provisioning during device manufacturing?',sub:'High-volume IoT PKI requires factory-floor provisioning pipelines.',opts:[{val:'supply_chain_yes',label:'Yes — factory provisioning needed',desc:'Certs baked in at manufacture time'},{val:'supply_chain_field',label:'No — provisioned in the field',desc:'Certs pushed when device activates'},{val:'supply_chain_no',label:'No IoT / device provisioning needed',desc:'Not applicable'},{val:'supply_chain_unsure',label:'Unsure / early stage',desc:'IoT PKI not yet designed'}]},
  ],
  smime:[
    {id:'email_attack_history',title:'What email-based threats are you most concerned about?',sub:'Shapes the urgency and depth of S/MIME deployment.',opts:[{val:'bec_attacks',label:'Business Email Compromise (BEC)',desc:'CFO fraud, wire transfer attacks'},{val:'phishing',label:'Phishing / spear-phishing',desc:'Credential theft, link-based attacks'},{val:'spoofing',label:'Email domain spoofing',desc:'Attackers impersonating your domain'},{val:'regulatory_email',label:'Regulatory email encryption mandate',desc:'HIPAA, GDPR, financial regulations'}]},
    {id:'email_client',title:'Which email platforms are in your organisation?',sub:'S/MIME support and deployment method varies by platform.',opts:[{val:'outlook_exchange',label:'Microsoft Outlook / Exchange / M365',desc:'Native S/MIME support'},{val:'gmail_workspace',label:'Google Workspace (Gmail)',desc:'S/MIME available in Business/Enterprise tiers'},{val:'mixed_email',label:'Mixed — Outlook + mobile clients',desc:'Needs cross-platform provisioning'},{val:'other_email',label:'Other / custom email platform',desc:'Thunderbird, Apple Mail, etc.'}]},
    {id:'smime_scope',title:'Which employees need S/MIME certificates?',sub:'Licensing scales with the number of mailboxes.',opts:[{val:'exec_only',label:'C-suite and senior executives only',desc:'High-value targets first'},{val:'finance_legal',label:'Finance, legal and HR teams',desc:'Teams handling sensitive communications'},{val:'all_employees',label:'All employees with corporate email',desc:'Org-wide protection'},{val:'external_facing',label:'All client-facing / external staff',desc:'Anyone emailing customers/partners'}]},
    {id:'dmarc_status',title:'What is your current DMARC deployment status?',sub:'DMARC enforcement is a prerequisite for S/MIME effectiveness.',opts:[{val:'dmarc_reject',label:'p=reject enforced',desc:'Full DMARC enforcement — excellent'},{val:'dmarc_quarantine',label:'p=quarantine',desc:'Partial protection'},{val:'dmarc_none_monitor',label:'p=none / monitoring only',desc:'Not yet enforced'},{val:'no_dmarc',label:'No DMARC record',desc:'Starting from scratch'}]},
    {id:'cert_delivery_smime',title:'How do you want S/MIME certs delivered to users?',sub:'Zero-touch deployment avoids IT helpdesk overload.',opts:[{val:'zero_touch_mdm',label:'Zero-touch via MDM (Intune / Jamf)',desc:'Silent, no user action needed'},{val:'auto_enroll_ad',label:'Auto-enroll via Active Directory',desc:'GPO-driven for Windows'},{val:'self_service',label:'Self-service portal',desc:'Users request their own certs'},{val:'manual_dist',label:'Manual distribution by IT',desc:'IT installs on each device'}]},
    {id:'cross_org_trust',title:'Do you need S/MIME to work for external email recipients?',sub:'Public trust is needed for cross-organisation encrypted email.',opts:[{val:'internal_only',label:'Internal only',desc:'Signing/encryption between employees'},{val:'partners_too',label:'Yes — partners and suppliers',desc:'B2B encrypted email'},{val:'all_external',label:'Yes — any external recipient',desc:'Customer-facing encryption'},{val:'not_sure_ext',label:'Not sure yet',desc:'Need to assess use cases'}]},
    {id:'smime_validation_level',title:'What level of S/MIME certificate validation do you require?',sub:'Higher validation levels provide stronger identity assurance.',opts:[{val:'mailbox_dv',label:'Mailbox-validated (email control only)',desc:'Fastest to issue, basic use'},{val:'org_validated',label:'Organisation-validated',desc:'Org identity verified by CA'},{val:'individual_val',label:'Individual / Sponsor-validated',desc:"Person's identity verified"},{val:'not_sure_val',label:'Unsure — need guidance',desc:"Haven't assessed this yet"}]},
    {id:'encrypted_at_rest',title:'Do you need email to be encrypted at rest?',sub:'S/MIME encrypts end-to-end — the server cannot read it.',opts:[{val:'e2e_required',label:"Yes — end-to-end, server can't decrypt",desc:'Zero-knowledge, strongest protection'},{val:'tls_enough',label:'TLS in transit is sufficient',desc:'Already use M365 TLS encryption'},{val:'compliance_driven',label:'Required by compliance',desc:'HIPAA, GDPR, financial regulations'},{val:'unsure_encryption',label:'Unsure',desc:'Need to assess requirements'}]},
    {id:'mobile_email',title:'Do employees access corporate email on personal mobile devices?',sub:'BYOD S/MIME deployment needs MDM or per-device provisioning.',opts:[{val:'corp_devices_only',label:'Corporate-managed devices only',desc:'Controlled estate'},{val:'byod_ios_android',label:'BYOD — iOS and/or Android',desc:'Personal phones, mixed OS'},{val:'mixed_byod',label:'Mixed — some corp, some BYOD',desc:'Uneven coverage'},{val:'mobile_not_used',label:'No mobile email access',desc:'Desktop only'}]},
    {id:'cert_archival',title:'Do you need historical email decryption (certificate archiving)?',sub:'Without archived keys, encrypted old emails cannot be recovered.',opts:[{val:'archival_required',label:'Yes — legal hold / eDiscovery required',desc:'Compliance mandate'},{val:'archival_desired',label:'Desired — want recovery option',desc:'Business risk concern'},{val:'archival_no',label:'Not required',desc:'Forward-looking encryption only'},{val:'archival_unsure',label:'Unsure — need legal guidance',desc:"Haven't assessed yet"}]},
    {id:'current_email_security',title:'What email security tools do you currently have in place?',sub:'S/MIME layers on top of these.',opts:[{val:'proofpoint_mimecast',label:'Proofpoint or Mimecast',desc:'Gateway filtering in place'},{val:'defender_for_365',label:'Microsoft Defender for M365',desc:'Native Microsoft security'},{val:'basic_spam_only',label:'Basic spam filtering only',desc:'No advanced email security'},{val:'nothing_email_sec',label:'No dedicated email security',desc:'Starting from scratch'}]},
    {id:'smime_automation_req',title:'How important is automated lifecycle management for S/MIME certs?',sub:'S/MIME certs expire — manual renewal at scale is unsustainable.',opts:[{val:'full_auto_smime',label:'Critical — must be fully automated',desc:'Zero IT touch after rollout'},{val:'semi_auto_smime',label:'Semi-automated with alerts',desc:'Reminders OK, some manual steps'},{val:'manual_ok_smime',label:'Manual acceptable for now',desc:'Small volume, IT can manage'},{val:'not_thought_smime',label:"Haven't considered this",desc:'Need guidance'}]},
    {id:'bimi_interest',title:'Are you interested in displaying your brand logo in email clients (BIMI/VMC)?',sub:'VMC certificates power the BIMI standard.',opts:[{val:'bimi_yes',label:'Yes — actively evaluating BIMI',desc:'Brand trust is a priority'},{val:'bimi_aware',label:'Aware but not prioritised yet',desc:'On the roadmap'},{val:'bimi_no',label:'Not interested currently',desc:'Not a priority'},{val:'bimi_what',label:'What is BIMI?',desc:'Need to learn more first'}]},
    {id:'smime_timeline',title:'What is your target timeline for S/MIME rollout?',sub:'Deployment timeline affects staging approach.',opts:[{val:'smime_urgent',label:'Urgent — active phishing campaign',desc:'Need protection now'},{val:'smime_this_q',label:'This quarter',desc:'3-month window'},{val:'smime_h2',label:'Second half of this year',desc:'6-month planning window'},{val:'smime_exploring',label:'Exploring / researching',desc:'No hard deadline'}]},
    {id:'smime_pilot_approach',title:'How would you prefer to roll out S/MIME?',sub:'Rollout strategy affects deployment complexity.',opts:[{val:'pilot_first',label:'Pilot group first, then org-wide',desc:'Risk-managed, phased rollout'},{val:'dept_by_dept',label:'Department by department',desc:'Structured staged approach'},{val:'big_bang',label:'Full org rollout at once',desc:'Fastest coverage'},{val:'top_down',label:'Executives first, then expand',desc:'Protect high-value targets first'}]},
  ],
  devops:[
    {id:'devops_stack',title:'What is your primary container / orchestration stack?',sub:'Determines the integration path for certificate automation.',opts:[{val:'kubernetes',label:'Kubernetes (self-managed)',desc:'cert-manager + Jetstack Venafi'},{val:'eks_aks_gke',label:'Managed K8s (EKS / AKS / GKE)',desc:'Cloud-managed control plane'},{val:'docker_swarm',label:'Docker / Docker Swarm',desc:'Container-native without K8s'},{val:'no_containers',label:'No containers — traditional VMs',desc:'CI/CD without containerisation'}]},
    {id:'cert_manager_deployed',title:'Have you deployed cert-manager in your Kubernetes cluster?',sub:'cert-manager is the de facto K8s certificate controller.',opts:[{val:'certmgr_yes',label:'Yes — cert-manager running',desc:'Looking for better CA backend'},{val:'certmgr_evaluating',label:'Evaluating cert-manager',desc:"Haven't deployed yet"},{val:'certmgr_no',label:'No — managing certs manually in K8s',desc:'Secret-based certs, no automation'},{val:'certmgr_na',label:'Not using Kubernetes',desc:'Not applicable'}]},
    {id:'cert_volume_devops',title:'How many certificates does your DevOps pipeline issue per month?',sub:'Volume cap avoidance is a critical decision factor.',opts:[{val:'under_100_month',label:'< 100 / month',desc:'Low volume, growing'},{val:'100_1k_month',label:'100 – 1,000 / month',desc:'Active pipeline'},{val:'1k_10k_month',label:'1,000 – 10,000 / month',desc:'High-volume CI/CD'},{val:'over_10k_month',label:'10,000+ / month',desc:'Very high throughput'}]},
    {id:'cert_lifespan_devops',title:'What certificate lifespans do your workloads require?',sub:'Short-lived certs eliminate CRL/OCSP dependency.',opts:[{val:'very_short',label:'Hours to days (ephemeral workloads)',desc:'Lambda, jobs, spot instances'},{val:'weeks',label:'Days to weeks',desc:'Container / microservice lifetime'},{val:'months_devops',label:'Months (standard short-lived)',desc:'Service-to-service mTLS'},{val:'mixed_lifespans',label:'Mixed — varies by workload',desc:'Heterogeneous pipeline'}]},
    {id:'mtls_usage',title:'Are you implementing mutual TLS (mTLS) for service-to-service communication?',sub:"mTLS requires a private CA — public CAs won't support it from 2027.",opts:[{val:'mtls_yes',label:'Yes — mTLS deployed across services',desc:'Zero Trust service mesh'},{val:'mtls_partial',label:'Partial — some services only',desc:'Inconsistent implementation'},{val:'mtls_planned',label:'Planning mTLS deployment',desc:'Roadmap item'},{val:'mtls_no',label:'No mTLS — using API keys or tokens',desc:'Not yet implemented'}]},
    {id:'ci_cd_tools',title:'Which CI/CD tools are you using?',sub:'Sectigo has pre-built integrations for each.',opts:[{val:'github_actions',label:'GitHub Actions',desc:'GitHub-native workflows'},{val:'jenkins',label:'Jenkins',desc:'Self-hosted automation server'},{val:'gitlab_ci',label:'GitLab CI/CD',desc:'GitLab pipelines'},{val:'multi_cicd',label:'Multiple / mixed tools',desc:'ArgoCD, Tekton, Azure DevOps'}]},
    {id:'iac_tools',title:'Are you using Infrastructure-as-Code tools for PKI provisioning?',sub:'IaC allows certificate requests to be version-controlled.',opts:[{val:'terraform_used',label:'Terraform / OpenTofu',desc:'Sectigo Terraform provider available'},{val:'ansible_used',label:'Ansible',desc:'Playbook-based cert automation'},{val:'helm_charts',label:'Helm charts (Kubernetes)',desc:'Chart-based deployment'},{val:'no_iac',label:'No IaC for PKI',desc:'Manual or scripted today'}]},
    {id:'service_mesh',title:'Are you using a service mesh?',sub:'Service mesh PKI integration allows fully transparent cert management.',opts:[{val:'istio',label:'Istio',desc:'Most common K8s service mesh'},{val:'linkerd',label:'Linkerd',desc:'Lightweight, Rust-based mesh'},{val:'consul_connect',label:'Consul Connect (HashiCorp)',desc:'HashiCorp service mesh'},{val:'no_service_mesh',label:'No service mesh',desc:'Direct service-to-service calls'}]},
    {id:'secrets_vault',title:'Where do you store secrets and private keys in your pipeline?',sub:'Vault integration allows PKI to be a secrets-aware system.',opts:[{val:'hashicorp_vault',label:'HashiCorp Vault',desc:'Dynamic secrets + PKI engine'},{val:'aws_secrets',label:'AWS Secrets Manager / KMS',desc:'AWS-native secrets'},{val:'azure_key_vault',label:'Azure Key Vault',desc:'Azure-native key management'},{val:'no_vault',label:'No centralised secrets vault',desc:'Environment variables / files'}]},
    {id:'self_signed_problem',title:'Do your developers use self-signed certificates?',sub:'Self-signed certs create trust gaps and often leak into production.',opts:[{val:'self_signed_heavy',label:'Yes — extensively used',desc:'Known risk, want to eliminate'},{val:'self_signed_some',label:'Some environments',desc:'Not consistent policy'},{val:'self_signed_forbidden',label:'Forbidden by policy',desc:'Already addressed'},{val:'self_signed_unknown',label:'Unknown — no visibility',desc:'Likely widespread'}]},
    {id:'private_ca_devops',title:'Are you operating a private CA today for DevOps workloads?',sub:'Private CA is required for mTLS and short-lived workload certificates.',opts:[{val:'private_ca_yes',label:'Yes — internal CA running',desc:'But struggling to scale it'},{val:'private_ca_cloud',label:'Cloud-managed private CA',desc:'AWS PCA, GCP CAS, Azure MSCA'},{val:'private_ca_no',label:'No private CA',desc:'Using public certs or self-signed'},{val:'private_ca_building',label:'Building one now',desc:'Looking for the right solution'}]},
    {id:'rate_limit_pain',title:'Have you hit rate limits or volume caps with your current CA?',sub:"Let's Encrypt rate limits stop CI/CD pipelines at scale.",opts:[{val:'hit_limits',label:'Yes — hit rate limits in production',desc:'Pipeline blocked, forced workarounds'},{val:'hit_dev_limits',label:'Hit limits in dev/staging',desc:'Impacting developer productivity'},{val:'approaching_limits',label:'Approaching limits, concerned',desc:'Expecting issues soon'},{val:'no_limit_issue',label:'No issues yet',desc:'Volume is still low'}]},
    {id:'cert_rotation_freq',title:'How frequently do you rotate certificates in your environment?',sub:'Frequent rotation reduces blast radius but increases automation dependency.',opts:[{val:'rotate_daily',label:'Daily or more frequently',desc:'High security, ephemeral workloads'},{val:'rotate_weekly',label:'Weekly',desc:'Short-lived service certs'},{val:'rotate_monthly',label:'Monthly / with deployments',desc:'Tied to release cycles'},{val:'rotate_manually',label:'Only when manually triggered',desc:'No automated rotation'}]},
    {id:'spiffe_svid',title:'Are you implementing workload identity standards like SPIFFE/SVID?',sub:'SPIFFE is the emerging standard for zero-trust workload identity.',opts:[{val:'spiffe_yes',label:'Yes — SPIFFE/SVID deployed',desc:'SPIRE or Istio-native'},{val:'spiffe_evaluating',label:'Evaluating SPIFFE',desc:'On the roadmap'},{val:'spiffe_no',label:'No — standard X.509 certs',desc:'Traditional certificate approach'},{val:'spiffe_what',label:'Unfamiliar with SPIFFE',desc:'Need to learn more'}]},
    {id:'devops_compliance',title:'Do your DevOps certificates need to meet compliance standards?',sub:'Regulated industries often have cert policy requirements for CI/CD.',opts:[{val:'fips_required',label:'FIPS 140-2/3 key storage required',desc:'Government / regulated industry'},{val:'audit_trail',label:'Audit trail required for all cert ops',desc:'SOX, PCI-DSS control evidence'},{val:'no_compliance_devops',label:'No specific compliance requirement',desc:'Speed is the priority'},{val:'compliance_unsure_devops',label:'Unsure — need to check',desc:"Security team hasn't assessed"}]},
  ],
  code_signing:[
    {id:'signing_artifacts',title:'What are you primarily signing?',sub:'Signing requirements differ significantly by artifact type.',opts:[{val:'windows_exe',label:'Windows executables / installers',desc:'.exe, .msi, .dll, .cab files'},{val:'macos_code',label:'macOS applications',desc:'App bundles, pkg, DMG files'},{val:'linux_packages',label:'Linux packages / containers',desc:'RPM, DEB, container images'},{val:'cross_platform',label:'Cross-platform / mixed artifacts',desc:'Multiple OS targets'}]},
    {id:'signing_volume',title:'How many software builds / artifacts do you sign per month?',sub:'Volume determines whether shared CA or dedicated signing service fits.',opts:[{val:'under_50_builds',label:'< 50 builds/month',desc:'Small team, infrequent releases'},{val:'50_500_builds',label:'50 – 500 builds/month',desc:'Active development pipeline'},{val:'500_plus_builds',label:'500+ builds/month',desc:'Continuous delivery at scale'},{val:'on_demand',label:'On-demand / release-based',desc:'Irregular cadence'}]},
    {id:'ov_ev_requirement',title:'Do your customers or distribution channels require EV code signing?',sub:'EV certificates give immediate SmartScreen reputation — no warm-up period.',opts:[{val:'ev_required',label:'Yes — EV required',desc:'Enterprise customers mandate it'},{val:'ev_preferred',label:'EV preferred but not mandated',desc:'Better UX, fewer warnings'},{val:'ov_enough',label:'OV is sufficient',desc:'Standard validation adequate'},{val:'not_sure_ev',label:'Unsure — need guidance',desc:"Haven't evaluated requirements"}]},
    {id:'hsm_signing',title:'How do you store code signing private keys?',sub:'Microsoft and Apple require hardware-protected keys for EV code signing.',opts:[{val:'hsm_cloud_sign',label:'Cloud HSM (AWS KMS, Azure Key Vault)',desc:'FIPS-backed cloud key storage'},{val:'physical_hsm_sign',label:'Physical HSM (YubiKey, nShield)',desc:'Hardware token-based signing'},{val:'software_key_sign',label:'Software keystore only',desc:'Keys in files — needs upgrading'},{val:'no_hsm_aware',label:"Haven't addressed key security yet",desc:'Need guidance'}]},
    {id:'ci_cd_signing',title:'Is code signing integrated into your CI/CD pipeline?',sub:'Unsigned builds in CI/CD create signature gaps.',opts:[{val:'full_cicd_sign',label:'Yes — fully integrated and automated',desc:'Sign every build automatically'},{val:'partial_cicd_sign',label:'Partial — some pipelines signed',desc:'Not consistent across all builds'},{val:'manual_sign_only',label:'Manual signing only',desc:'Developer signs before release'},{val:'no_signing_yet',label:'No signing in place yet',desc:'Starting from scratch'}]},
    {id:'timestamp_authority',title:'Are you using timestamping for long-term signature validity?',sub:'Without timestamping, signed code becomes invalid when the cert expires.',opts:[{val:'timestamp_yes',label:'Yes — RFC 3161 timestamping used',desc:'Signatures valid beyond cert expiry'},{val:'timestamp_no',label:'No timestamping',desc:'Signatures expire with cert'},{val:'timestamp_unknown',label:'Unsure if configured',desc:'Need to check'},{val:'timestamp_not_needed',label:'Short-lived artifacts — not needed',desc:'Builds replaced frequently'}]},
    {id:'smartscreen_reputation',title:'Are users seeing Windows SmartScreen or macOS Gatekeeper warnings?',sub:'These warnings are eliminated with EV certificates and timestamping.',opts:[{val:'smartscreen_always',label:'Yes — constant warnings',desc:'Significant customer friction'},{val:'smartscreen_sometimes',label:'Occasionally on new builds',desc:'Reputation warming period'},{val:'smartscreen_no',label:'No warnings currently',desc:'Already have EV or reputation'},{val:'smartscreen_unknown',label:'Unknown — no customer feedback',desc:"Haven't tracked this"}]},
    {id:'firmware_signing',title:'Are you signing firmware or embedded software?',sub:'Firmware signing has different requirements to application signing.',opts:[{val:'firmware_yes',label:'Yes — firmware/bootloader signing',desc:'Embedded systems, IoT devices'},{val:'firmware_no',label:'No — application-level only',desc:'Not applicable'},{val:'firmware_planned',label:'Planning firmware signing',desc:'Roadmap item'},{val:'firmware_unsure',label:'Unsure',desc:'Need to assess'}]},
    {id:'container_image_sign',title:'Are you signing container images?',sub:'Docker Hub and OCI registries support Notary v2 / Sigstore signing.',opts:[{val:'container_sign_yes',label:'Yes — container images signed',desc:'Notary v2, Cosign, Sigstore'},{val:'container_sign_no',label:'No — images are unsigned',desc:'Supply chain risk'},{val:'container_sign_planned',label:'Planning to implement',desc:'On roadmap'},{val:'container_sign_na',label:'Not using containers',desc:'Not applicable'}]},
    {id:'supply_chain_risk',title:'How concerned are you about software supply chain attacks?',sub:'SolarWinds, XZ Utils, and similar attacks target unsigned build pipelines.',opts:[{val:'supply_chain_critical',label:'Critical concern — top priority',desc:'Post-incident or under mandate'},{val:'supply_chain_high',label:'High concern — actively addressing',desc:'SBOM and signing in progress'},{val:'supply_chain_medium',label:'Moderate — on the roadmap',desc:'Aware but not yet acted'},{val:'supply_chain_low',label:'Low concern',desc:'Not a current priority'}]},
    {id:'signing_policy',title:'Do you have a formal code signing policy?',sub:'A signing policy defines who can sign, what, and under what conditions.',opts:[{val:'formal_policy_sign',label:'Yes — documented and enforced',desc:'Policy with technical controls'},{val:'informal_policy_sign',label:'Informal / undocumented',desc:'Practices exist but not formal'},{val:'no_policy_sign',label:'No policy',desc:'Ad-hoc signing decisions'},{val:'building_policy',label:'Building policy now',desc:'In progress'}]},
    {id:'multi_team_signing',title:'How many development teams need signing access?',sub:'Multi-team access requires role-based signing controls.',opts:[{val:'single_team_sign',label:'One team / centralised security',desc:'Single signing authority'},{val:'few_teams_sign',label:'2–5 teams',desc:'Department-level access'},{val:'many_teams_sign',label:'5+ teams / squads',desc:'Distributed development'},{val:'outsourced_sign',label:'Including external contractors',desc:'Third-party signing access needed'}]},
    {id:'existing_ca_sign',title:'Who currently issues your code signing certificates?',sub:'Determines migration path and timeline.',opts:[{val:'digicert_sign',label:'DigiCert',desc:'Migrating to Sectigo'},{val:'comodo_old',label:'Old Comodo / Sectigo account',desc:'Renewing or upgrading'},{val:'other_ca_sign',label:'Other CA',desc:'Looking to switch'},{val:'no_signing_ca',label:'No code signing certs yet',desc:'Starting fresh'}]},
    {id:'signing_audit',title:'Do you require a full audit log of every signing event?',sub:'Audit trails are required for SOX, PCI-DSS and supply chain security.',opts:[{val:'sign_audit_required',label:'Yes — compliance requires it',desc:'Full chain of custody logging'},{val:'sign_audit_desired',label:'Desired for security visibility',desc:'Not mandated but wanted'},{val:'sign_audit_no',label:'Not currently required',desc:'No audit obligation'},{val:'sign_audit_unsure',label:'Unsure',desc:'Need to check with compliance team'}]},
    {id:'sbom_requirement',title:'Are you building a Software Bill of Materials (SBOM)?',sub:'SBOMs + code signing = complete supply chain provenance.',opts:[{val:'sbom_yes',label:'Yes — SBOM required',desc:'Executive Order 14028 / customer mandate'},{val:'sbom_planned',label:'Planned for this year',desc:'In roadmap'},{val:'sbom_no',label:'No SBOM requirement',desc:'Not applicable today'},{val:'sbom_unsure',label:'Unsure',desc:'Need to assess'}]},
  ],
  pqc:[
    {id:'pqc_driver',title:'What is driving your post-quantum cryptography interest?',sub:'The driver shapes the urgency and type of PQC solution needed.',opts:[{val:'pqc_regulation',label:'Regulatory mandate (NIST, NSA, CISA)',desc:'Government / compliance requirement'},{val:'pqc_board_risk',label:'Board-level risk directive',desc:'Executive mandate to prepare'},{val:'pqc_long_lived',label:'Long-lived certificates / data',desc:'Harvest-now-decrypt-later risk'},{val:'pqc_curiosity',label:'Research / proactive exploration',desc:'Getting ahead of the curve'}]},
    {id:'current_crypto_inventory',title:'Have you completed a cryptographic inventory of your systems?',sub:'Discovery of all cryptographic assets is the first step in PQC migration.',opts:[{val:'full_crypto_inv',label:'Yes — full inventory completed',desc:'Know all algorithms in use'},{val:'partial_crypto_inv',label:'Partial inventory',desc:'Some systems mapped'},{val:'no_crypto_inv',label:'Not started yet',desc:"Don't know what we're using"},{val:'in_progress_inv',label:'In progress now',desc:'Actively cataloguing'}]},
    {id:'harvest_risk',title:'How concerned are you about harvest-now-decrypt-later attacks?',sub:'Adversaries collect encrypted data today to decrypt when quantum computers mature.',opts:[{val:'harvest_critical',label:'Critical — we protect long-lived secrets',desc:'National security, long-term IP'},{val:'harvest_high',label:'High — sensitive data with 5+ year value',desc:'Financial, medical, or legal data'},{val:'harvest_medium',label:'Moderate — some long-lived data',desc:'Mix of short and long-lived data'},{val:'harvest_low',label:'Low — mostly ephemeral data',desc:'Short-lived, frequently rotated'}]},
    {id:'pqc_timeline_target',title:'What is your target timeline for PQC migration?',sub:'NIST has finalised standards. NSA mandates full migration by 2030–2035.',opts:[{val:'pqc_2026_2027',label:'2026–2027 (immediate)',desc:'Early mover, regulatory pressure'},{val:'pqc_2028_2029',label:'2028–2029',desc:'Aligned with industry timelines'},{val:'pqc_2030_plus',label:'2030 or later',desc:'Following NIST final deadlines'},{val:'pqc_no_timeline',label:'No timeline defined yet',desc:'Still in assessment phase'}]},
    {id:'current_key_algorithms',title:'Which public-key algorithms are you currently using?',sub:'These are the algorithms that quantum computers will break.',opts:[{val:'rsa_2048_4096',label:'RSA 2048 / 4096',desc:'Most common today'},{val:'ecc_p256_p384',label:'ECDSA P-256 / P-384',desc:'Modern elliptic curve'},{val:'mixed_algorithms',label:'Mix of RSA and ECC',desc:'Heterogeneous estate'},{val:'unknown_algorithms',label:'Unknown — no inventory',desc:'Need cryptographic discovery first'}]},
    {id:'hybrid_cert_interest',title:'Are you interested in hybrid certificates (classical + PQC combined)?',sub:'Hybrid certs allow backward compatibility during the transition period.',opts:[{val:'hybrid_yes',label:'Yes — hybrid is ideal for us',desc:'Need backward compat during transition'},{val:'hybrid_pqc_only',label:'PQC-only where possible',desc:'Aggressive migration approach'},{val:'hybrid_unsure',label:'Unsure — need guidance',desc:"Haven't assessed compatibility"},{val:'hybrid_classical_now',label:'Classical for now, PQC later',desc:'Testing first, migrate when ready'}]},
    {id:'tls_pqc_priority',title:'Which systems are highest priority for PQC migration?',sub:'PQC migration should be risk-prioritised.',opts:[{val:'tls_public_web',label:'Public-facing TLS / web servers',desc:'Highest exposure surface'},{val:'internal_auth',label:'Internal authentication (VPN, Wi-Fi, AD)',desc:'High-value internal identities'},{val:'email_signing_pqc',label:'Email signing (S/MIME)',desc:'Long-lived signatures'},{val:'iot_firmware_pqc',label:'IoT devices / firmware signatures',desc:'Long-lived embedded systems'}]},
    {id:'pqc_skills',title:"What is your team's current PQC expertise level?",sub:'Expertise level determines how much advisory support is needed.',opts:[{val:'pqc_expert',label:'Expert — we understand NIST standards',desc:'ML-DSA, ML-KEM, SLH-DSA familiar'},{val:'pqc_intermediate',label:'Intermediate — aware of the basics',desc:'Know the concepts, need implementation help'},{val:'pqc_beginner',label:'Beginner — learning',desc:'Need foundational education first'},{val:'pqc_no_skills',label:'No PQC skills in-house',desc:'Need full advisory support'}]},
    {id:'pqc_testing_env',title:'Do you have an environment where you can safely test PQC certificates?',sub:'Sectigo Private PQC provides a live testing environment inside your existing SCM.',opts:[{val:'test_env_yes',label:'Yes — isolated test environment',desc:'Can test without production risk'},{val:'test_env_staging',label:'Staging environment available',desc:'Separate from production'},{val:'test_env_no',label:'No — testing would affect production',desc:'Need a sandbox solution'},{val:'test_env_cloud',label:'Cloud sandbox available',desc:'Dev/test cloud account'}]},
    {id:'pqc_vendor_ecosystem',title:'Have your key technology vendors communicated their PQC roadmap?',sub:"Your PQC timeline is bounded by your ecosystem's readiness.",opts:[{val:'vendors_pqc_ready',label:'Yes — most vendors are PQC-ready',desc:'Ecosystem is aligned'},{val:'vendors_pqc_partial',label:'Some vendors have roadmaps',desc:'Mixed ecosystem readiness'},{val:'vendors_pqc_silent',label:'No communication from vendors',desc:'Unknown ecosystem readiness'},{val:'vendors_pqc_unknown',label:"Haven't asked them yet",desc:'Need to assess'}]},
    {id:'pqc_protocol_support',title:'Which protocols need PQC support in your environment?',sub:'Protocol support is a key readiness constraint.',opts:[{val:'tls13_pqc',label:'TLS 1.3 (web / API)',desc:'Major browsers adding PQC KEM support'},{val:'ssh_pqc',label:'SSH',desc:'OpenSSH 9.0+ supports ML-KEM'},{val:'ipsec_vpn_pqc',label:'IPsec / VPN tunnels',desc:'IKEv2 with PQC support'},{val:'smime_pqc',label:'S/MIME email signing',desc:'Long-lived signature protection'}]},
    {id:'crypto_agility_stance',title:"Does your organisation have a crypto-agility strategy?",sub:'Crypto-agility means systems can swap algorithms without architectural rework.',opts:[{val:'crypto_agile_yes',label:'Yes — designed for crypto-agility',desc:'Can rotate algorithms on demand'},{val:'crypto_agile_partial',label:'Partially — some systems are agile',desc:'Mixed architecture'},{val:'crypto_agile_no',label:'No — algorithms are baked in',desc:'Architectural rework needed'},{val:'crypto_agile_unknown',label:'Unknown — needs assessment',desc:"Haven't evaluated"}]},
    {id:'pqc_regulatory_body',title:'Which regulatory or standards bodies are you aligned with for PQC?',sub:'Different bodies have different migration timelines.',opts:[{val:'nist_aligned',label:'NIST (US standard)',desc:'ML-DSA, ML-KEM, SLH-DSA'},{val:'enisa_etsi',label:'ENISA / ETSI (European)',desc:'EU quantum-safe standards'},{val:'nsa_cnss',label:'NSA CNSS Policy 15',desc:'US national security systems'},{val:'no_regulatory_pqc',label:'No regulatory alignment yet',desc:'Need to identify applicable standards'}]},
    {id:'migration_complexity',title:'How complex is your existing PKI hierarchy?',sub:'Migration complexity scales with hierarchy depth.',opts:[{val:'simple_pki',label:'Simple — 1 root, 1 issuing CA',desc:'Straightforward migration'},{val:'medium_pki',label:'Medium — 2 tiers, < 5 issuing CAs',desc:'Manageable migration'},{val:'complex_pki',label:'Complex — multi-tier, many CAs',desc:'Phased migration required'},{val:'unknown_pki',label:'Unknown — no full inventory',desc:'Discovery needed first'}]},
    {id:'pqc_budget_source',title:'How is PQC investment being funded?',sub:'Budget source affects timeline and scope of migration.',opts:[{val:'pqc_dedicated_budget',label:'Dedicated quantum readiness budget',desc:'Funded programme approved'},{val:'pqc_security_budget',label:'From existing security budget',desc:'Competing with other priorities'},{val:'pqc_no_budget',label:'No budget allocated yet',desc:'Need to build business case'},{val:'pqc_seeking_budget',label:'Seeking budget approval',desc:'In progress'}]},
  ],
  vmc_cmc:[
    {id:'bimi_awareness_depth',title:'How familiar are you with the BIMI standard?',sub:'Brand Indicators for Message Identification.',opts:[{val:'bimi_expert_level',label:'Expert — implementing BIMI now',desc:'Know the spec, need certs'},{val:'bimi_aware_level',label:'Aware — researching BIMI',desc:'Understand the basics'},{val:'bimi_heard_of',label:'Heard of it, need to learn more',desc:'Initial exploration'},{val:'bimi_new',label:'New to BIMI',desc:'Discovered it recently'}]},
    {id:'trademark_status',title:'Is your brand logo registered as a trademark?',sub:'VMC requires a registered trademark. CMC does not.',opts:[{val:'trademark_registered',label:'Yes — registered trademark',desc:'Eligible for VMC'},{val:'trademark_pending',label:'Trademark application pending',desc:'VMC after registration'},{val:'trademark_no',label:'No trademark registration',desc:'CMC is the right option'},{val:'trademark_unsure',label:'Unsure — need to check',desc:'Legal team needs to confirm'}]},
    {id:'dmarc_enforcement',title:'Have you enforced DMARC at p=reject or p=quarantine?',sub:'DMARC enforcement is a hard prerequisite for BIMI and VMC.',opts:[{val:'dmarc_p_reject',label:'p=reject (full enforcement)',desc:'BIMI ready — best position'},{val:'dmarc_p_quarantine',label:'p=quarantine',desc:'Partially ready'},{val:'dmarc_p_none',label:'p=none (monitoring only)',desc:'Not ready for BIMI'},{val:'dmarc_not_set',label:'No DMARC record',desc:'Significant work needed first'}]},
    {id:'email_volume',title:'What is your approximate monthly outbound email volume?',sub:'BIMI ROI scales with send volume.',opts:[{val:'email_under_10k',label:'< 10,000 emails/month',desc:'Low volume'},{val:'email_10k_100k',label:'10,000 – 100,000/month',desc:'Medium volume'},{val:'email_100k_1m',label:'100,000 – 1 million/month',desc:'High volume'},{val:'email_over_1m',label:'1 million+ emails/month',desc:'Very high volume — large BIMI ROI'}]},
    {id:'email_clients_target',title:'Which email clients are most important for your brand logo display?',sub:'BIMI support varies by client.',opts:[{val:'gmail_target',label:'Gmail / Google Workspace',desc:'Requires VMC'},{val:'apple_mail_target',label:'Apple Mail (iOS / macOS)',desc:'Requires VMC or CMC'},{val:'yahoo_target',label:'Yahoo / AOL Mail',desc:'VMC supported'},{val:'all_clients_target',label:'All supporting clients',desc:'Maximum reach'}]},
    {id:'spf_dkim_status',title:'What is your current SPF and DKIM configuration status?',sub:'SPF and DKIM alignment with DMARC is required for BIMI.',opts:[{val:'spf_dkim_both',label:'Both SPF and DKIM configured and aligned',desc:'BIMI-ready foundation'},{val:'spf_only',label:'SPF only, no DKIM',desc:'DKIM needed for BIMI'},{val:'dkim_only',label:'DKIM only, no SPF',desc:'SPF needed for BIMI'},{val:'neither_spf_dkim',label:'Neither configured',desc:'Significant prerequisite work needed'}]},
    {id:'logo_format',title:'Is your brand logo available in SVG format (SVG Tiny PS)?',sub:'BIMI requires a specific SVG profile.',opts:[{val:'svg_ready',label:'Yes — SVG file ready',desc:'Design team has produced it'},{val:'svg_needs_conversion',label:'SVG exists but needs reformatting',desc:'Need to create SVG Tiny PS version'},{val:'svg_no_file',label:'No SVG available',desc:'Only have PNG/JPEG'},{val:'svg_unsure',label:'Unsure of the format',desc:'Need to check with design team'}]},
    {id:'multi_brand',title:'Do you have multiple brands or sub-brands that need BIMI?',sub:'Each brand/domain requires its own VMC/CMC certificate.',opts:[{val:'single_brand',label:'Single brand / domain',desc:'One certificate needed'},{val:'few_brands',label:'2–5 brands / domains',desc:'Small multi-brand portfolio'},{val:'many_brands',label:'6+ brands / domains',desc:'Enterprise brand portfolio'},{val:'unsure_brands',label:'Unsure — need to map domains',desc:"Haven't assessed yet"}]},
    {id:'existing_email_auth',title:'Do you currently have an email authentication provider?',sub:'Many organisations use Proofpoint, Mimecast, or Valimail for DMARC monitoring.',opts:[{val:'proofpoint_email',label:'Proofpoint Email Fraud Defense',desc:'DMARC + BIMI support'},{val:'mimecast_email',label:'Mimecast',desc:'DMARC monitoring'},{val:'valimail_email',label:'Valimail or dmarcian',desc:'Specialist DMARC platforms'},{val:'no_email_auth',label:'No DMARC monitoring platform',desc:'Managing DNS records directly'}]},
    {id:'phishing_concern_bimi',title:'Have you seen phishing emails impersonating your brand?',sub:'BIMI reduces brand impersonation by verifying legitimate sender identity.',opts:[{val:'phishing_active',label:'Yes — active impersonation attacks',desc:'Customers receiving fake emails'},{val:'phishing_occasional',label:'Occasional incidents reported',desc:'Happens sometimes'},{val:'phishing_not_seen',label:'Not seen, but concerned',desc:'Proactive protection desired'},{val:'phishing_monitored',label:'Monitoring shows impersonation',desc:'DMARC reports show spoofing attempts'}]},
    {id:'open_rate_goal',title:'Is email open rate improvement a KPI alongside security?',sub:'BIMI logo display has been shown to increase open rates by up to 10%.',opts:[{val:'open_rate_kpi',label:'Yes — marketing cares about open rates',desc:'Brand + security dual benefit'},{val:'open_rate_secondary',label:'Interesting but secondary to security',desc:'Security is the primary driver'},{val:'open_rate_no',label:'No — purely a security decision',desc:'Marketing not involved'},{val:'open_rate_unknown',label:"Haven't considered this angle",desc:'Need to involve marketing team'}]},
    {id:'dns_hosting',title:'Who manages your DNS?',sub:'BIMI requires a TXT record in your DNS zone.',opts:[{val:'route53_dns',label:'AWS Route 53',desc:'AWS-managed DNS'},{val:'cloudflare_dns',label:'Cloudflare',desc:'Cloudflare DNS'},{val:'azure_dns',label:'Azure DNS',desc:'Microsoft Azure DNS'},{val:'internal_dns',label:'Self-managed / ISP DNS',desc:'Internal DNS team'}]},
    {id:'bimi_timeline_target',title:'What is your target timeline to go live with BIMI?',sub:'BIMI prerequisites (DMARC, trademark, SVG) determine realistic timelines.',opts:[{val:'bimi_under_90days',label:'< 90 days',desc:'Fast track — prerequisites mostly done'},{val:'bimi_this_half',label:'This half of the year',desc:'6-month window'},{val:'bimi_next_year',label:'Next 12 months',desc:'Longer runway acceptable'},{val:'bimi_no_timeline',label:'No specific timeline',desc:'Exploring and planning'}]},
    {id:'vmc_vs_cmc_choice',title:'Have you evaluated whether VMC or CMC is right for your brand?',sub:'VMC = registered trademark required. CMC = no trademark needed.',opts:[{val:'vmc_decided',label:'VMC — we have the trademark',desc:'Ready for full BIMI rollout'},{val:'cmc_decided',label:'CMC — no trademark yet',desc:'Apple Mail logo display first'},{val:'both_needed',label:'Both VMC and CMC across brands',desc:'Mixed portfolio'},{val:'vmc_cmc_unsure',label:'Unsure — need guidance',desc:"Haven't decided yet"}]},
    {id:'smime_alongside_bimi',title:'Are you planning to add S/MIME alongside your VMC/CMC deployment?',sub:'VMC + S/MIME together form the strongest possible email trust stack.',opts:[{val:'smime_with_bimi_yes',label:'Yes — both are planned',desc:'Complete email security posture'},{val:'smime_with_bimi_later',label:'VMC first, S/MIME later',desc:'Phased approach'},{val:'smime_already',label:'Already have S/MIME deployed',desc:'Adding VMC to existing stack'},{val:'smime_with_bimi_no',label:'VMC/CMC only for now',desc:'S/MIME not in scope'}]},
  ],
  ms_ca_mgmt:[
    {id:'adcs_version',title:'Which version of Microsoft Active Directory Certificate Services are you running?',sub:'Version affects feature support and migration complexity.',opts:[{val:'adcs_2022',label:'Windows Server 2022',desc:'Latest — full feature set'},{val:'adcs_2019_2016',label:'Windows Server 2016 / 2019',desc:'Modern, supported'},{val:'adcs_2012_older',label:'Windows Server 2012 or older',desc:'Legacy — upgrade recommended'},{val:'adcs_version_unknown',label:'Unknown',desc:'Need to check'}]},
    {id:'adcs_pain',title:'What is your biggest problem with your current AD CS deployment?',sub:"Pinpoints where Sectigo's value is greatest.",opts:[{val:'adcs_no_visibility',label:'No visibility into all issued certs',desc:"Can't see what's in the estate"},{val:'adcs_non_windows',label:"Can't cover non-Windows devices",desc:'Mac, Linux, IoT, mobile gaps'},{val:'adcs_manual_renewal',label:'Manual renewal processes',desc:'Constant expiry fire drills'},{val:'adcs_multi_ca',label:'Multiple disconnected CAs',desc:'No central management'}]},
    {id:'non_windows_scope',title:'What non-Windows systems need certificates from your AD CS environment?',sub:'These are the systems AD CS cannot natively provision.',opts:[{val:'mac_linux',label:'macOS and Linux workstations',desc:'Developer / mixed OS estate'},{val:'mobile_byod',label:'iOS and Android (mobile/BYOD)',desc:'Employee personal devices'},{val:'iot_ot',label:'IoT / OT devices',desc:'Embedded or specialised devices'},{val:'all_non_win',label:'All of the above',desc:'Heterogeneous estate'}]},
    {id:'ndes_scep_usage',title:'Are you using NDES (Network Device Enrollment Service) for SCEP?',sub:'NDES is the Windows-native SCEP endpoint for non-Windows devices.',opts:[{val:'ndes_yes',label:'Yes — NDES deployed and working',desc:'Want to extend/augment'},{val:'ndes_struggling',label:"Yes, but it's unstable / complex",desc:'Operational pain with NDES'},{val:'ndes_no',label:'No NDES — not yet deployed',desc:'Looking at alternative'},{val:'ndes_unknown',label:'Unsure',desc:'Need to check'}]},
    {id:'pki_hierarchy',title:'Describe your AD CS PKI hierarchy.',sub:'Hierarchy depth affects migration and integration complexity.',opts:[{val:'single_tier',label:'Single-tier (root issues directly)',desc:'Simple but less secure'},{val:'two_tier',label:'Two-tier (offline root, online issuing CA)',desc:'Best-practice hierarchy'},{val:'three_tier',label:'Three-tier or more',desc:'Complex enterprise hierarchy'},{val:'hierarchy_unknown',label:'Unsure',desc:'Need to audit'}]},
    {id:'adcs_templates',title:'How many custom certificate templates do you have in AD CS?',sub:'Custom templates indicate policy complexity and migration effort.',opts:[{val:'few_templates',label:'< 10 templates',desc:'Simple to migrate'},{val:'moderate_templates',label:'10 – 30 templates',desc:'Moderate migration effort'},{val:'many_templates',label:'30+ templates',desc:'Complex migration'},{val:'templates_unknown',label:'Unknown',desc:'Need to audit'}]},
    {id:'auto_enroll_gpo',title:'Are you using Group Policy auto-enrollment for certificates?',sub:'Auto-enrollment scope determines what Sectigo needs to complement.',opts:[{val:'autoenroll_yes',label:'Yes — GPO auto-enrollment configured',desc:'Windows domain members auto-enroll'},{val:'autoenroll_partial',label:'Partial — some cert types only',desc:'Not all templates auto-enroll'},{val:'autoenroll_no',label:'No — manual enrollment only',desc:'All enrollments are manual'},{val:'autoenroll_unknown',label:'Unsure',desc:'Need to check'}]},
    {id:'crl_ocsp_setup',title:'Is your CRL/OCSP infrastructure healthy?',sub:'Broken CRL/OCSP is one of the most common AD CS failure modes.',opts:[{val:'crl_healthy',label:'Yes — CRL and OCSP are healthy',desc:'Monitoring and alerts in place'},{val:'crl_issues',label:'Known CRL issues',desc:'Intermittent failures'},{val:'crl_unknown',label:'Unsure of current state',desc:'Not monitored'},{val:'crl_overhauling',label:'Currently overhauling CRL/OCSP',desc:'In progress'}]},
    {id:'adcs_ha',title:'Do you have high availability configured for your AD CS issuing CAs?',sub:'Single CA instances are a critical single point of failure.',opts:[{val:'adcs_ha_yes',label:'Yes — HA configured',desc:'Multiple issuing CAs with load balancing'},{val:'adcs_ha_no',label:'No HA — single issuing CA',desc:'Single point of failure'},{val:'adcs_ha_partial',label:'HA for some CAs',desc:'Inconsistent coverage'},{val:'adcs_ha_unknown',label:'Unknown',desc:'Need to verify'}]},
    {id:'intune_integration',title:'Are you integrating AD CS with Microsoft Intune for MDM?',sub:'Intune + SCEP/NDES is the standard for Windows MDM cert deployment.',opts:[{val:'intune_yes',label:'Yes — Intune + NDES/SCEP deployed',desc:'Working but want to extend'},{val:'intune_planned',label:'Planned — not yet deployed',desc:'On the roadmap'},{val:'intune_not_used',label:'Not using Intune',desc:'Different MDM or no MDM'},{val:'intune_unsure',label:'Unsure',desc:'Need to check MDM setup'}]},
    {id:'public_cert_gap',title:'How are you managing public SSL certificates today?',sub:'AD CS only issues private certs — public SSL is separate.',opts:[{val:'public_manual_adcs',label:'Manually, separate from AD CS',desc:'Different tool/process for public certs'},{val:'public_other_ca',label:'Via a different CA platform',desc:"DigiCert, Entrust, Let's Encrypt"},{val:'public_same_team',label:'Same team, but no integration',desc:'Siloed processes'},{val:'public_want_unified',label:'Want public + private unified',desc:'Seeking single platform'}]},
    {id:'forest_count',title:'How many Active Directory forests are in scope?',sub:'Multi-forest environments require cross-forest PKI considerations.',opts:[{val:'single_forest',label:'Single AD forest',desc:'Standard single-domain org'},{val:'two_forests',label:'2 forests (corp + DMZ or acquired)',desc:'Trust relationships in place'},{val:'multi_forest',label:'3+ forests',desc:'Complex M&A or global structure'},{val:'no_forest',label:'Not an AD environment',desc:'Azure AD only or non-Microsoft'}]},
    {id:'adcs_compliance_audit',title:'Has your AD CS deployment been audited for compliance?',sub:'Unaudited AD CS deployments often have significant security gaps.',opts:[{val:'adcs_audited',label:'Yes — recently audited',desc:'Findings addressed'},{val:'adcs_audit_gap',label:'Audited but gaps remain',desc:'Remediation in progress'},{val:'adcs_never_audited',label:'Never formally audited',desc:'Unknown risk exposure'},{val:'adcs_audit_scheduled',label:'Audit scheduled',desc:'Upcoming assessment'}]},
    {id:'migration_appetite',title:'What is your appetite for migrating away from AD CS?',sub:'Sectigo can augment AD CS or fully replace it.',opts:[{val:'augment_adcs',label:'Augment AD CS — keep it running',desc:'Add Sectigo on top, no migration'},{val:'partial_replace',label:'Gradually replace AD CS',desc:'Phased migration over 1–2 years'},{val:'full_replace',label:'Fully replace AD CS',desc:'Move to Sectigo Private PKI entirely'},{val:'replace_unsure',label:'Unsure — need guidance',desc:"Haven't decided strategy"}]},
    {id:'scm_connector_awareness',title:'Are you aware of the Sectigo Certificate Manager connector for Microsoft CA?',sub:'The SCM connector bridges AD CS into the Sectigo platform without migration.',opts:[{val:'connector_aware',label:'Yes — evaluating it now',desc:'Researching the integration'},{val:'connector_used',label:'Yes — already using it',desc:'Looking to expand usage'},{val:'connector_not_aware',label:'Not aware of it',desc:'Learning for the first time'},{val:'connector_demo_requested',label:'Would like a demo',desc:'Want to see it in action'}]},
  ],
}

// Routing
function routeProduct(triage) {
  const p = triage.primary_pain
  if (p === 'email_phishing')     return 'smime'
  if (p === 'code_trust')         return 'code_signing'
  if (p === 'pqc_readiness')      return 'pqc'
  if (p === 'bimi')               return 'vmc_cmc'
  if (p === 'devops_certs')       return 'devops'
  if (p === 'internal_visibility')
    return (triage.ms_ca === 'yes' || triage.ms_ca === 'partial') ? 'ms_ca_mgmt' : 'private_pki'
  if (triage.ms_ca === 'yes' || triage.ms_ca === 'partial') return 'ms_ca_mgmt'
  return 'scm_enterprise'
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function PKIDiscoveryPage() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const [view, setView] = useState('list')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [phase, setPhase] = useState('triage')
  const [triageStep, setTriageStep] = useState(0)
  const [triageAnswers, setTriageAnswers] = useState({})
  const [deepStep, setDeepStep] = useState(0)
  const [deepAnswers, setDeepAnswers] = useState({})
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [picked, setPicked] = useState(null)
  const [showLead, setShowLead] = useState(false)
  const [lead, setLead] = useState({ customer_name:'', company_name:'', email:'' })
  const [saving, setSaving] = useState(false)
  const [savedSession, setSavedSession] = useState(null)
  const cardRef = useRef(null)

  const totalTriage = TRIAGE_QS.length
  const totalDeep   = selectedProduct ? (DEEP_QS[selectedProduct]?.length || 15) : 15
  const totalQs     = totalTriage + totalDeep
  const globalStep  = phase === 'triage' ? triageStep : totalTriage + deepStep
  const progressPct = Math.round((globalStep / totalQs) * 100)
  const currentQ    = phase === 'triage' ? TRIAGE_QS[triageStep] : (selectedProduct ? DEEP_QS[selectedProduct]?.[deepStep] : null)

  useEffect(() => { if (currentOrg?.id) loadSessions() }, [currentOrg?.id])

  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase
      .from('pki_discovery_sessions')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!cardRef.current) return
    cardRef.current.style.opacity = '0'
    cardRef.current.style.transform = 'translateY(8px)'
    const t = setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.transition = 'opacity 0.18s ease, transform 0.18s ease'
        cardRef.current.style.opacity = '1'
        cardRef.current.style.transform = 'translateY(0)'
      }
    }, 40)
    return () => clearTimeout(t)
  }, [triageStep, deepStep, phase])

  function handleNext() {
    if (!picked) return
    if (phase === 'triage') {
      const na = { ...triageAnswers, [TRIAGE_QS[triageStep].id]: picked }
      setTriageAnswers(na)
      setPicked(null)
      if (triageStep < totalTriage - 1) { setTriageStep(s => s + 1) }
      else { const p = routeProduct(na); setSelectedProduct(p); setPhase('deep'); setDeepStep(0) }
    } else {
      const q = DEEP_QS[selectedProduct][deepStep]
      const na = { ...deepAnswers, [q.id]: picked }
      setDeepAnswers(na)
      setPicked(null)
      if (deepStep < totalDeep - 1) { setDeepStep(s => s + 1) }
      else { setShowLead(true) }
    }
  }

  function handleBack() {
    setPicked(null)
    if (phase === 'deep' && deepStep === 0) {
      setPhase('triage'); setTriageStep(totalTriage - 1)
      setPicked(triageAnswers[TRIAGE_QS[totalTriage - 1].id] || null)
    } else if (phase === 'deep') {
      const pq = DEEP_QS[selectedProduct][deepStep - 1]
      setDeepStep(s => s - 1); setPicked(deepAnswers[pq.id] || null)
    } else if (triageStep > 0) {
      setPicked(triageAnswers[TRIAGE_QS[triageStep - 1].id] || null)
      setTriageStep(s => s - 1)
    }
  }

  async function handleSave() {
    if (!lead.customer_name.trim() || !lead.company_name.trim() || !lead.email.trim()) return
    setSaving(true)
    const score = 85 + Math.floor(Object.keys(deepAnswers).length * 0.5)
    const { data, error } = await supabase.from('pki_discovery_sessions').insert({
      org_id: currentOrg.id, created_by: user.id,
      customer_name: lead.customer_name.trim(),
      company_name: lead.company_name.trim(),
      email: lead.email.trim(),
      product_routed: selectedProduct,
      triage_answers: triageAnswers,
      deep_answers: deepAnswers,
      match_score: score,
    }).select().single()
    setSaving(false)
    if (!error && data) { setSavedSession(data); setShowLead(false); setView('result'); await loadSessions() }
  }

  function startNew() {
    setPhase('triage'); setTriageStep(0); setDeepStep(0)
    setTriageAnswers({}); setDeepAnswers({})
    setSelectedProduct(null); setPicked(null)
    setLead({ customer_name:'', company_name:'', email:'' })
    setShowLead(false); setSavedSession(null); setView('wizard')
  }

  async function deleteSession(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this discovery session?')) return
    await supabase.from('pki_discovery_sessions').delete().eq('id', id)
    await loadSessions()
    if (savedSession?.id === id) { setSavedSession(null); setView('list') }
  }

  const phaseColor = phase === 'triage' ? '#1D9E75' : (PM[selectedProduct]?.color || '#1A4FBA')
  const isLast = phase === 'triage' ? triageStep === totalTriage - 1 : deepStep === totalDeep - 1
  const qNum = phase === 'triage' ? triageStep + 1 : deepStep + 1
  const totalInPhase = phase === 'triage' ? totalTriage : totalDeep
  const phaseLbl = phase === 'triage' ? 'Phase 1 · Triage' : `Phase 2 · ${PM[selectedProduct]?.label || 'Deep Discovery'}`

  // ─── LIST VIEW ────────────────────────────────────────────────────────────
  if (view === 'list') {
    const grouped = sessions.reduce((acc, s) => { (acc[s.company_name] = acc[s.company_name] || []).push(s); return acc }, {})
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:900 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1D9E75,#1A4FBA)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Cpu size={17} color="white" />
              </div>
              <h1 style={{ fontSize:'1.375rem', fontWeight:600, letterSpacing:'-0.02em', margin:0 }}>PKI Discovery</h1>
            </div>
            <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', margin:0, paddingLeft:44 }}>
              Sectigo solution discovery · {sessions.length} session{sessions.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <button onClick={startNew} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Plus size={15} /> New discovery
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--neutral-400)', fontSize:'0.875rem' }}>Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div style={{ background:'white', border:'1px dashed var(--neutral-200)', borderRadius:16, padding:'3rem 2rem', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-700)', marginBottom:6 }}>No discovery sessions yet</h3>
            <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', marginBottom:20 }}>Run a PKI discovery call to identify the right Sectigo solution for a customer.</p>
            <button onClick={startNew} className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Plus size={14} /> Start first discovery</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(grouped).map(([company, cSessions]) => (
              <div key={company} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
                <div
                  style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.25rem', cursor:'pointer' }}
                  onClick={() => setExpanded(expanded === company ? null : company)}
                >
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'var(--neutral-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:700, color:'var(--neutral-600)' }}>
                      {company.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>{company}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>{cSessions.length} session{cSessions.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {expanded === company ? <ChevronUp size={16} color="var(--neutral-400)" /> : <ChevronDown size={16} color="var(--neutral-400)" />}
                </div>

                {expanded === company && (
                  <div style={{ borderTop:'1px solid var(--neutral-100)' }}>
                    {cSessions.map((s, i) => {
                      const pm = PM[s.product_routed] || PM.scm_enterprise
                      return (
                        <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1.25rem 0.75rem 1.5rem', borderBottom: i < cSessions.length - 1 ? '1px solid var(--neutral-100)' : 'none', gap:12, flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:5, background:pm.bg, border:`1px solid ${pm.color}22`, borderRadius:8, padding:'4px 10px', flexShrink:0 }}>
                              <span style={{ fontSize:12 }}>{pm.icon}</span>
                              <span style={{ fontSize:'0.6875rem', fontWeight:600, color:pm.color }}>{pm.label}</span>
                            </div>
                            <div style={{ minWidth:0 }}>
                              <div style={{ fontSize:'0.875rem', fontWeight:500, color:'var(--neutral-800)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.customer_name}</div>
                              <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.email}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                            {s.match_score && <span style={{ fontSize:'0.75rem', fontWeight:600, color:'var(--success-600)', background:'var(--success-50)', padding:'2px 8px', borderRadius:6 }}>{s.match_score}%</span>}
                            <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.75rem', color:'var(--neutral-400)' }}><Clock size={11}/>{new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
                            <button onClick={() => { setSavedSession(s); setView('result') }} style={{ display:'flex', alignItems:'center', gap:4, background:'var(--neutral-50)', border:'1px solid var(--neutral-200)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:'0.75rem', color:'var(--neutral-600)', fontWeight:500 }}>View <ArrowRight size={11}/></button>
                            <button onClick={e => deleteSession(s.id, e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', padding:4, display:'flex', alignItems:'center' }} title="Delete"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── RESULT VIEW ─────────────────────────────────────────────────────────
  if (view === 'result' && savedSession) {
    const s = savedSession
    const pm = PM[s.product_routed] || PM.scm_enterprise
    const summary = PRODUCT_SUMMARIES[s.product_routed] || ''
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:860 }}>
        <button onClick={() => setView('list')} className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:5, color:'var(--neutral-600)', marginBottom:'1.25rem' }}>
          ← Back to sessions
        </button>

        <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          {/* Hero */}
          <div style={{ background:pm.color, padding:'1.5rem 1.75rem' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.09em', color:'rgba(255,255,255,0.55)', marginBottom:4 }}>Recommended Sectigo solution</div>
                <div style={{ fontSize:'1.375rem', fontWeight:700, color:'white', marginBottom:2 }}>{pm.icon} {pm.label}</div>
                <div style={{ fontSize:'0.8125rem', color:'rgba(255,255,255,0.7)' }}>Discovery: {s.customer_name} · {s.company_name}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:12, padding:'0.625rem 1rem', textAlign:'center', flexShrink:0 }}>
                <div style={{ fontSize:'1.5rem', fontWeight:700, color:'white', lineHeight:1 }}>{s.match_score}%</div>
                <div style={{ fontSize:'0.6875rem', color:'rgba(255,255,255,0.65)', marginTop:2 }}>match score</div>
              </div>
            </div>
          </div>

          <div style={{ padding:'1.25rem 1.75rem' }}>
            {/* Contact info */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              {[
                { icon:<User size={12}/>, label:'Contact', val:s.customer_name },
                { icon:<Building2 size={12}/>, label:'Company', val:s.company_name },
                { icon:<Mail size={12}/>, label:'Email', val:s.email },
                { icon:<Clock size={12}/>, label:'Date', val:new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) },
              ].map(f => (
                <div key={f.label} style={{ background:'var(--neutral-50)', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'7px 12px', minWidth:130 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.625rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-500)', marginBottom:3 }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-800)' }}>{f.val}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div style={{ background:'var(--neutral-50)', borderLeft:`3px solid ${pm.color}`, borderRadius:'0 8px 8px 0', padding:'10px 14px', fontSize:'0.8125rem', color:'var(--neutral-700)', lineHeight:1.7, marginBottom:16 }}>{summary}</div>

            {/* Triage findings */}
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:8, fontWeight:600 }}>Triage findings</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:16 }}>
              {Object.entries(s.triage_answers).map(([k,v]) => (
                <div key={k} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:'0.625rem', color:'var(--neutral-500)', marginBottom:2, textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-700)', textTransform:'capitalize' }}>{String(v).replace(/_/g,' ')}</div>
                </div>
              ))}
            </div>

            {/* Deep discovery answers */}
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:8, fontWeight:600 }}>Deep discovery answers ({Object.keys(s.deep_answers).length} questions)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8, marginBottom:16 }}>
              {Object.entries(s.deep_answers).map(([k,v]) => (
                <div key={k} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:'0.625rem', color:'var(--neutral-500)', marginBottom:2, textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-700)', textTransform:'capitalize' }}>{String(v).replace(/_/g,' ')}</div>
                </div>
              ))}
            </div>

            {/* Next steps */}
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:8, fontWeight:600 }}>Recommended next steps</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {NEXT_STEPS.map((step, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, background:'var(--neutral-50)', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'8px 12px', fontSize:'0.8125rem', color:'var(--neutral-700)' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:pm.color, color:'white', fontSize:'0.6875rem', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                  {step}
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" style={{ flex:1 }}>Schedule a demo</button>
              <button className="btn btn-secondary" style={{ flex:1 }} onClick={startNew}>New discovery</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── WIZARD VIEW ──────────────────────────────────────────────────────────
  if (view === 'wizard') {
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:740 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <button onClick={() => setView('list')} className="btn btn-ghost btn-sm" style={{ color:'var(--neutral-500)', display:'flex', alignItems:'center', gap:5 }}>← Back</button>
          <span style={{ fontSize:'0.8125rem', color:'var(--neutral-400)' }}>{globalStep + 1} / {totalQs} questions</span>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ height:4, background:'var(--neutral-150)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${progressPct}%`, background:`linear-gradient(90deg,${phaseColor},${phaseColor}bb)`, borderRadius:3, transition:'width 0.35s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.6875rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:phaseColor, background:`${phaseColor}15`, padding:'2px 8px', borderRadius:10 }}>{phaseLbl}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{progressPct}% complete</span>
          </div>
        </div>

        {/* Question card */}
        {currentQ && (
          <div ref={cardRef} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, padding:'1.5rem', marginBottom:'0.75rem', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-400)', marginBottom:6 }}>Q{qNum} of {totalInPhase}</div>
            <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)', marginBottom:4, lineHeight:1.4 }}>{currentQ.title}</div>
            <div style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', lineHeight:1.6, marginBottom:14 }}>{currentQ.sub}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {currentQ.opts.map(opt => {
                const isSel = picked === opt.val
                return (
                  <button key={opt.val} onClick={() => setPicked(opt.val)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: isSel ? `${phaseColor}0e` : 'var(--neutral-50)', border:`${isSel ? 2 : 1}px solid ${isSel ? phaseColor : 'var(--neutral-200)'}`, borderRadius:10, cursor:'pointer', textAlign:'left', transition:'all 0.1s' }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${isSel ? phaseColor : 'var(--neutral-300)'}`, background: isSel ? phaseColor : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {isSel && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--neutral-800)', marginBottom:1 }}>{opt.label}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', lineHeight:1.4 }}>{opt.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Nav */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={handleBack} className="btn btn-ghost btn-sm" style={{ color:'var(--neutral-500)', visibility:(phase === 'triage' && triageStep === 0) ? 'hidden' : 'visible' }}>← Back</button>
          <button onClick={handleNext} disabled={!picked} className="btn btn-primary" style={{ opacity: picked ? 1 : 0.35, display:'flex', alignItems:'center', gap:6 }}>
            {isLast ? 'Complete & save →' : <><span>Continue</span><ChevronRight size={15}/></>}
          </button>
        </div>

        {/* Lead capture modal */}
        {showLead && (
          <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:460, boxShadow:'var(--shadow-xl)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:PM[selectedProduct]?.bg || '#E8F7F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{PM[selectedProduct]?.icon || '🔐'}</div>
                <div>
                  <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Save discovery results</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>Routed to: {PM[selectedProduct]?.label}</div>
                </div>
              </div>
              <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', marginBottom:'1.25rem', lineHeight:1.6 }}>Enter the customer's details to save this session to your PKI Discovery history.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:'1.25rem' }}>
                {[
                  { icon:<User size={13}/>, label:'Customer name', key:'customer_name', placeholder:'Jane Smith' },
                  { icon:<Building2 size={13}/>, label:'Company name', key:'company_name', placeholder:'Acme Corporation' },
                  { icon:<Mail size={13}/>, label:'Email address', key:'email', placeholder:'jane@acme.com', type:'email' },
                ].map(f => (
                  <div key={f.key} className="form-group" style={{ margin:0 }}>
                    <label className="form-label" style={{ display:'flex', alignItems:'center', gap:5 }}>{f.icon} {f.label}</label>
                    <input className="input" type={f.type || 'text'} placeholder={f.placeholder} value={lead[f.key]} onChange={e => setLead(p => ({ ...p, [f.key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowLead(false)} style={{ flex:1 }}>Cancel</button>
                <button className={`btn btn-primary ${saving ? 'btn-loading' : ''}`} onClick={handleSave} disabled={saving || !lead.customer_name.trim() || !lead.company_name.trim() || !lead.email.trim()} style={{ flex:1, display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                  {saving ? '' : <><CheckCircle2 size={15}/> Save &amp; view results</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
