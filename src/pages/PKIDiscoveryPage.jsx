import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useOrg } from '../hooks/useOrg'
import { useAuth } from '../hooks/useAuth'
import { ChevronRight, CheckCircle2, User, Building2, Mail, ArrowRight, Clock, ChevronDown, ChevronUp, Trash2, Plus, Cpu } from 'lucide-react'

const PM = {
  scm_enterprise: { label:'SCM Enterprise',         color:'#0D6E56', bg:'#E8F7F2', icon:'🏢' },
  private_pki:    { label:'Private PKI',             color:'#1A4FBA', bg:'#EBF0FD', icon:'🔒' },
  smime:          { label:'S/MIME Solutions',        color:'#4E35C2', bg:'#EDEBFC', icon:'✉️' },
  devops:         { label:'DevOps PKI',              color:'#0F5C8A', bg:'#E6F2FA', icon:'⚙️' },
  code_signing:   { label:'Code Signing',            color:'#2D6B1A', bg:'#EBF5E6', icon:'📝' },
  pqc:            { label:'PQC / Quantum Labs',      color:'#3C2E99', bg:'#EDEAFB', icon:'⚛️' },
  vmc_cmc:        { label:'VMC / CMC (BIMI)',        color:'#854F0B', bg:'#FEF3E0', icon:'🏷️' },
  ms_ca_mgmt:     { label:'Microsoft CA Management',color:'#0F3A8A', bg:'#E8EFFB', icon:'🖥️' },
}
const SUMMARIES = {
  scm_enterprise:"Your environment needs a CA-agnostic CLM platform that consolidates public, private, and specialty certificates with full lifecycle automation — eliminating the manual renewal overhead and multi-CA sprawl you described.",
  private_pki:"Your gaps go beyond what AD CS can cover. You need a managed internal CA that provisions certificates to every identity type — non-Windows devices, IoT, mobile, and service workloads — under one policy engine.",
  smime:"The attack vectors you described are directly mitigated by S/MIME. Email signing eliminates domain impersonation; end-to-end encryption closes the data leakage exposure.",
  devops:"Your pipeline needs a CA with no rate limits, native cert-manager/Kubernetes integration, and short-lived cert issuance — so certificate management never blocks a deployment.",
  code_signing:"Every unsigned artifact is a trust gap. Sectigo Code Signing with HSM-backed EV certs closes the SmartScreen friction and gives you a tamper-evident chain of custody from build to distribution.",
  pqc:"Your cryptographic estate is exposed to harvest-now-decrypt-later risk. Sectigo PQC Labs gives you a structured migration path: inventory, hybrid testing, full ML-DSA rollout — without disrupting production.",
  vmc_cmc:"Your brand has the email authentication foundation for BIMI. A VMC/CMC certificate is the final piece that displays your verified logo in Gmail and Apple Mail — signalling legitimate sender identity to every recipient.",
  ms_ca_mgmt:"The Sectigo Certificate Manager connector sits on top of your AD CS hierarchy — adding full visibility, non-Windows coverage, and automated renewal without touching your existing CA infrastructure.",
}
const NEXT_STEPS = [
  'Schedule a live demo with a Sectigo solutions engineer',
  'Request a proof-of-concept / free trial environment',
  'Download the relevant datasheet and Forrester TEI study',
  'Have your PKI team review the integration documentation',
]

// Triage — only 4 questions, some conditional
const TRIAGE_QS = [
  { id:'primary_pain', title:'What is the single biggest PKI problem you need solved?', sub:'This routes the entire discovery — be direct.',
    opts:[
      {val:'outages',label:'Certificate outages & expirations',desc:'Sites down, trust errors, renewal fire drills'},
      {val:'email_phishing',label:'Email phishing & impersonation',desc:'Spoofed domain, BEC, unsigned email'},
      {val:'code_trust',label:'Unsigned / untrusted software',desc:'Tampered builds, supply chain risk'},
      {val:'internal_visibility',label:'No visibility into internal certs',desc:'Shadow PKI, unknown devices, rogue certs'},
      {val:'devops_certs',label:'DevOps cert chaos at scale',desc:'Kubernetes, CI/CD, ephemeral workloads'},
      {val:'pqc_readiness',label:'Quantum cryptography readiness',desc:'PQC migration, crypto-agility strategy'},
      {val:'bimi',label:'Brand trust in email (BIMI / VMC)',desc:'Verified logo in Gmail, Apple Mail'},
    ]},
  { id:'ms_ca', title:'Are you running Microsoft Active Directory Certificate Services (AD CS)?', sub:'Determines whether we focus on augmenting AD CS or a greenfield PKI.',
    showIf: t => ['outages','internal_visibility'].includes(t.primary_pain),
    opts:[
      {val:'yes',label:'Yes — our primary CA',desc:'Windows-centric environment'},
      {val:'partial',label:'Yes, but coverage gaps',desc:"Can't cover mobile, Linux, or IoT"},
      {val:'no',label:'No — different CA',desc:"DigiCert, Let's Encrypt, AWS PCA…"},
      {val:'unknown',label:'Unsure / no inventory',desc:'Need discovery first'},
    ]},
  { id:'infra', title:'Where does your infrastructure live?', sub:'Determines which automation protocols apply.',
    showIf: t => ['outages','internal_visibility','devops_certs'].includes(t.primary_pain),
    opts:[
      {val:'cloud',label:'Cloud-native',desc:'AWS / GCP / Azure'},
      {val:'onprem',label:'On-premises',desc:'Data centres, Windows Server'},
      {val:'hybrid',label:'Hybrid',desc:'Mix of cloud and on-prem'},
      {val:'complex',label:'Multi-cloud + legacy',desc:'Heterogeneous estate'},
    ]},
  { id:'org_size', title:'How large is your organisation?', sub:'Scales the licensing recommendation.',
    opts:[
      {val:'small',label:'< 500 employees',desc:'SMB / startup'},
      {val:'mid',label:'500 – 5,000',desc:'Mid-market'},
      {val:'large',label:'5,000 – 25,000',desc:'Large enterprise'},
      {val:'xlarge',label:'25,000+',desc:'Global / complex org'},
    ]},
]

// Deep question bank — each has optional showIf(triage, deepAnswersSoFar)
const DEEP_BANK = {
  scm_enterprise:[
    {id:'ca_count',title:'How many CAs are you currently working with?',sub:'CA sprawl is the primary driver of outages.',opts:[{val:'one',label:'One CA',desc:'Want more control'},{val:'two_three',label:'2–3 CAs',desc:'Consolidation needed'},{val:'four_plus',label:'4+ CAs',desc:'Significant sprawl'},{val:'unknown',label:'Unknown',desc:'No full inventory'}]},
    {id:'discovery_done',title:'Have you ever run a full certificate discovery scan?',sub:'Most enterprises find 30–40% more certs than expected.',opts:[{val:'never',label:'Never',desc:"Don't know our footprint"},{val:'partial',label:'Partial scan',desc:'Covered some segments'},{val:'yes',label:'Yes, regularly',desc:'But still fragmented'}]},
    {id:'renewal_pain',title:'How manual is your renewal process today?',sub:'47-day TLS lifespans are coming — urgency matters.',opts:[{val:'firefights',label:'Constant fire drills',desc:'Renewals take days, outages happen'},{val:'manageable',label:'Manageable but risky',desc:'Usually catch it in time'},{val:'scripted',label:'Scripts / reminders',desc:"Works now, won't scale"},{val:'automated',label:'Largely automated',desc:'Looking to extend'}]},
    {id:'key_storage',title:'Where are private keys stored?',sub:'Key protection is a critical audit control.',opts:[{val:'hsm',label:'HSM',desc:'Physical or cloud HSM'},{val:'cloud_kms',label:'Cloud KMS',desc:'AWS KMS, Azure Key Vault'},{val:'software',label:'Software keystore',desc:'OS store, JKS, PEM files'},{val:'ad_hoc',label:'No standard',desc:'Ad-hoc, team-dependent'}]},
    {id:'acme_ready',title:'Are your servers ACME-protocol capable?',sub:'ACME is the gold standard for automated renewal.',opts:[{val:'yes',label:'Yes, deployed',desc:'Certbot / acme.sh running'},{val:'partial',label:'Some servers',desc:'Not fully rolled out'},{val:'no',label:'No ACME',desc:'All manual today'},{val:'evaluating',label:'Evaluating',desc:'Planning rollout'}]},
    {id:'cloud_providers',title:'Which cloud providers are in your estate?',sub:'SCM has native integrations for each.',showIf:t=>['cloud','hybrid','complex'].includes(t.infra),opts:[{val:'aws',label:'AWS',desc:'ACM, AWS Private CA'},{val:'azure',label:'Azure / M365',desc:'Key Vault, Entra ID'},{val:'gcp',label:'GCP',desc:'Certificate Authority Service'},{val:'multi',label:'Multi-cloud',desc:'More than one'}]},
    {id:'integration_tools',title:'Which automation tools are you using?',sub:'Determines integration depth.',opts:[{val:'hashicorp',label:'HashiCorp Vault / Terraform',desc:'IaC + secrets'},{val:'k8s',label:'Kubernetes + cert-manager',desc:'Container cert automation'},{val:'servicenow',label:'ServiceNow',desc:'ITSM workflows'},{val:'acme_only',label:'ACME clients only',desc:'Certbot, acme.sh, Caddy'}]},
    {id:'team_size',title:'How many people manage certificates today?',sub:'Staffing shapes the automation ROI case.',opts:[{val:'one',label:'One person (part-time)',desc:'PKI is one of many duties'},{val:'small',label:'2–5',desc:'Small team'},{val:'medium',label:'5–15',desc:'Dedicated PKI function'},{val:'large',label:'15+',desc:'Enterprise PKI team'}]},
    {id:'incident_history',title:'Any certificate-related outage in the last 12 months?',sub:'Outages sharpen automation urgency.',opts:[{val:'p1',label:'Yes — P1 / major outage',desc:'Significant business impact'},{val:'near_miss',label:'Near-miss',desc:'Caught it just in time'},{val:'none',label:'No incidents',desc:'Risk is understood'},{val:'unknown',label:'Not tracked',desc:'No cert incident logging'}]},
    {id:'timeline',title:'What is your implementation timeline?',sub:'',opts:[{val:'urgent',label:'< 30 days',desc:'Active outage risk or mandate'},{val:'quarter',label:'This quarter',desc:'3-month window'},{val:'six_months',label:'3–6 months',desc:'Planned project'},{val:'exploring',label:'Exploring',desc:'No hard deadline'}]},
  ],
  private_pki:[
    {id:'current_ca',title:'What internal CA do you have today?',sub:'Migration path depends on starting point.',opts:[{val:'adcs_only',label:'AD CS only',desc:'Windows-centric, no mobile/IoT coverage'},{val:'adcs_gaps',label:'AD CS with coverage gaps',desc:'Mobile, IoT, Linux excluded'},{val:'none',label:'No internal CA',desc:'Self-signed or nothing'},{val:'legacy',label:'Legacy PKI',desc:'Old CA, hard to maintain'}]},
    {id:'identity_scope',title:'Which identities need private certificates?',sub:'This defines the CA architecture.',opts:[{val:'servers',label:'Internal servers / apps only',desc:'Intranet, internal APIs'},{val:'users_devices',label:'Users + endpoints',desc:'BYOD, smart card, Windows Hello'},{val:'iot',label:'IoT / OT devices',desc:'Embedded devices, sensors, gateways'},{val:'all',label:'All of the above',desc:'Full machine & human identity'}]},
    {id:'zero_trust',title:'Where are you on your Zero Trust journey?',sub:'Private PKI is the certificate engine of Zero Trust.',opts:[{val:'live',label:'Deployed and running',desc:'Need PKI to scale with it'},{val:'in_progress',label:'In progress',desc:'PKI is a dependency'},{val:'planned',label:'Planned',desc:'PKI will be required'},{val:'none',label:'Not started',desc:'Traditional perimeter today'}]},
    {id:'mdm_idp',title:'Which MDM / Identity Provider are you using?',sub:'Determines zero-touch certificate provisioning method.',opts:[{val:'intune',label:'Microsoft Intune + Entra ID',desc:'SCEP/NDES for cert push'},{val:'jamf',label:'Jamf (Apple fleet)',desc:'MDM profiles for cert deployment'},{val:'okta',label:'Okta / PingIdentity',desc:'IdP-driven provisioning'},{val:'none',label:'No MDM',desc:'Manual deployment today'}]},
    {id:'non_windows_pct',title:'What share of your endpoints are non-Windows?',sub:'AD CS cannot provision non-Windows devices natively.',showIf:(t,d)=>d.current_ca?.startsWith('adcs'),opts:[{val:'under_20',label:'< 20%',desc:'Mostly Windows'},{val:'20_50',label:'20–50%',desc:'Significant Mac/Linux estate'},{val:'over_50',label:'> 50%',desc:'Mac-heavy or diverse fleet'},{val:'byod',label:'Heavy BYOD',desc:'Employee-owned endpoints'}]},
    {id:'iot_volume',title:'How many IoT / connected devices need certificates?',sub:'Determines whether supply-chain provisioning is needed.',showIf:(t,d)=>['iot','all'].includes(d.identity_scope),opts:[{val:'hundreds',label:'Hundreds',desc:'Manageable'},{val:'thousands',label:'Thousands',desc:'Automation required'},{val:'tens_k',label:'Tens of thousands+',desc:'Factory provisioning likely needed'}]},
    {id:'hsm_req',title:'Do you need HSM-backed CA key storage?',sub:'Many compliance frameworks mandate FIPS 140-2/3 Level 3.',opts:[{val:'mandated',label:'Yes — mandated',desc:'FIPS 140-2/3 Level 3 required'},{val:'preferred',label:'Preferred',desc:'Best practice'},{val:'no',label:'Not required',desc:'Software keystores acceptable'},{val:'existing',label:'Have HSMs already',desc:'Need CA to integrate'}]},
    {id:'vpn_eap',title:'Are you using cert-based authentication for VPN or Wi-Fi?',sub:'EAP-TLS via private CA is the strongest network auth method.',opts:[{val:'yes',label:'Yes — EAP-TLS deployed',desc:'Working but incomplete'},{val:'no',label:'No — passwords / PSK',desc:'Want to move to cert-based'},{val:'mixed',label:'Mixed',desc:'Some cert, some password'},{val:'na',label:'Not applicable',desc:'No VPN / managed Wi-Fi'}]},
    {id:'sub_ca_model',title:"Do you need a branded subordinate CA under Sectigo's root?",sub:'A dedicated sub CA gives full policy control.',opts:[{val:'dedicated',label:'Yes — dedicated sub CA',desc:'Custom policies, your CA name'},{val:'shared',label:'Shared sub CA acceptable',desc:'Simpler, faster to deploy'},{val:'own_root',label:'Bring our own root',desc:'Existing PKI hierarchy'},{val:'unsure',label:'Unsure',desc:'Need guidance'}]},
    {id:'timeline_pki',title:'What is your deployment timeline?',sub:'',opts:[{val:'urgent',label:'< 30 days',desc:'Active incident or compliance deadline'},{val:'quarter',label:'This quarter',desc:'3-month window'},{val:'six_months',label:'3–6 months',desc:'Planned migration'},{val:'exploring',label:'Exploring',desc:'No hard deadline'}]},
  ],
  smime:[
    {id:'attack_type',title:'What email attack are you primarily trying to stop?',sub:'',opts:[{val:'bec',label:'Business Email Compromise',desc:'CEO/CFO fraud, wire transfer attacks'},{val:'phishing',label:'Phishing / spear-phishing',desc:'Credential theft, malicious links'},{val:'spoofing',label:'Domain spoofing / impersonation',desc:'Attackers sending as your domain'},{val:'compliance',label:'Regulatory encryption mandate',desc:'HIPAA, GDPR, financial data'}]},
    {id:'email_platform',title:'Which email platform are you on?',sub:'S/MIME zero-touch delivery depends on this.',opts:[{val:'m365',label:'Microsoft 365 / Exchange',desc:'Native S/MIME support'},{val:'google',label:'Google Workspace',desc:'S/MIME in Business/Enterprise'},{val:'mixed',label:'Mixed platforms',desc:'Outlook + mobile + other clients'},{val:'other',label:'Other',desc:'Thunderbird, Apple Mail, etc.'}]},
    {id:'smime_scope',title:'Which users need S/MIME certificates?',sub:'Licensing scales with mailbox count.',opts:[{val:'execs',label:'C-suite / senior executives only',desc:'Protect highest-value targets first'},{val:'sensitive_teams',label:'Finance, legal, HR',desc:'High-sensitivity comms'},{val:'all',label:'All employees',desc:'Org-wide protection'},{val:'external_facing',label:'All external-facing staff',desc:'Everyone emailing customers/partners'}]},
    {id:'dmarc',title:'What is your current DMARC enforcement status?',sub:'DMARC enforcement compounds the value of S/MIME.',opts:[{val:'reject',label:'p=reject enforced',desc:'Excellent foundation'},{val:'quarantine',label:'p=quarantine',desc:'Partial protection'},{val:'none_monitor',label:'p=none / monitoring',desc:'Not yet enforced'},{val:'no_dmarc',label:'No DMARC',desc:'Starting from scratch'}]},
    {id:'delivery_method',title:'How should S/MIME certs be delivered to users?',sub:'Zero-touch delivery avoids helpdesk overload at scale.',opts:[{val:'mdm',label:'Zero-touch via MDM (Intune / Jamf)',desc:'Silent push, no user action'},{val:'ad_gpo',label:'Active Directory auto-enroll',desc:'GPO-driven for Windows'},{val:'self_service',label:'Self-service portal',desc:'Users request their own'},{val:'manual',label:'Manual IT distribution',desc:'Small volume'}]},
    {id:'byod',title:'Do employees access corporate email on personal devices?',sub:'BYOD changes the provisioning architecture.',opts:[{val:'corp_only',label:'Corporate devices only',desc:'Controlled estate'},{val:'byod_heavy',label:'Heavy BYOD',desc:'Personal iOS / Android'},{val:'mixed',label:'Mixed',desc:'Some corp, some personal'},{val:'no_mobile',label:'No mobile email',desc:'Desktop only'}]},
    {id:'archival',title:'Do you need to decrypt historical emails (key archiving)?',sub:'Without archived private keys, old encrypted emails are permanently unreadable.',opts:[{val:'required',label:'Yes — legal hold / eDiscovery mandate',desc:'Compliance requirement'},{val:'desired',label:'Desired — risk mitigation',desc:'Want recovery option'},{val:'no',label:'Not required',desc:'Forward-looking only'}]},
    {id:'cross_org',title:'Does encryption need to work with external recipients?',sub:'Public trust is required for cross-organisation S/MIME.',opts:[{val:'internal',label:'Internal only',desc:'Between employees'},{val:'partners',label:'Yes — partners and suppliers',desc:'B2B encrypted email'},{val:'all_external',label:'Yes — any external recipient',desc:'Customer-facing encryption'}]},
    {id:'smime_timeline',title:'What is your rollout timeline?',sub:'',opts:[{val:'urgent',label:'Active phishing campaign — urgent',desc:'Need protection now'},{val:'quarter',label:'This quarter',desc:'3-month window'},{val:'h2',label:'Second half of year',desc:'6-month runway'},{val:'exploring',label:'Exploring',desc:'No hard deadline'}]},
  ],
  devops:[
    {id:'orchestration',title:'What container / orchestration platform are you running?',sub:'',opts:[{val:'k8s_self',label:'Kubernetes (self-managed)',desc:'cert-manager + Jetstack'},{val:'k8s_managed',label:'Managed K8s (EKS / AKS / GKE)',desc:'Cloud control plane'},{val:'docker',label:'Docker / Docker Swarm',desc:'No K8s'},{val:'vms_only',label:'Traditional VMs, no containers',desc:'CI/CD without containerisation'}]},
    {id:'cert_manager',title:'Have you deployed cert-manager?',sub:'cert-manager is the de facto K8s certificate controller.',showIf:(t,d)=>d.orchestration!=='vms_only',opts:[{val:'yes',label:'Yes — running',desc:'Want a better CA backend'},{val:'evaluating',label:'Evaluating',desc:"Haven't deployed yet"},{val:'no',label:'No — manual',desc:'Secret-based certs, no automation'}]},
    {id:'monthly_volume',title:'How many certificates does your pipeline issue per month?',sub:'Volume cap avoidance is often the primary switching driver.',opts:[{val:'under_100',label:'< 100',desc:'Low volume, growing'},{val:'100_1k',label:'100–1,000',desc:'Active pipeline'},{val:'1k_10k',label:'1,000–10,000',desc:'High-volume CI/CD'},{val:'over_10k',label:'10,000+',desc:'Very high throughput'}]},
    {id:'hit_rate_limits',title:"Have you hit rate limits with your current CA?",sub:"Let's Encrypt caps stop pipelines at scale.",opts:[{val:'yes_prod',label:'Yes — in production',desc:'Pipeline blocked'},{val:'yes_dev',label:'Yes — in dev/staging',desc:'Developer friction'},{val:'approaching',label:'Approaching limits',desc:'Concerned about growth'},{val:'no',label:'No issues yet',desc:'Volume still low'}]},
    {id:'mtls',title:'Are you implementing mTLS for service-to-service communication?',sub:'Public CAs are dropping TLS client auth support in 2027.',opts:[{val:'yes',label:'Yes — deployed',desc:'Zero Trust service mesh'},{val:'partial',label:'Partial',desc:'Inconsistent coverage'},{val:'planned',label:'Planned',desc:'On roadmap'},{val:'no',label:'Not yet',desc:'Using API keys or tokens'}]},
    {id:'cert_lifespan',title:'What certificate lifespans do your workloads require?',sub:'Short-lived certs eliminate revocation overhead.',opts:[{val:'ephemeral',label:'Hours to days',desc:'Lambda, jobs, spot instances'},{val:'weeks',label:'Days to weeks',desc:'Container / microservice lifetime'},{val:'months',label:'Months',desc:'Standard service certs'},{val:'mixed',label:'Mixed',desc:'Varies by workload'}]},
    {id:'ci_cd_tools',title:'Which CI/CD tools are you using?',sub:'Sectigo has pre-built integrations for each.',opts:[{val:'github',label:'GitHub Actions',desc:''},{val:'jenkins',label:'Jenkins',desc:''},{val:'gitlab',label:'GitLab CI/CD',desc:''},{val:'multi',label:'Multiple tools',desc:'ArgoCD, Tekton, Azure DevOps, etc.'}]},
    {id:'secrets_vault',title:'Where do you store secrets and private keys?',sub:'Vault integration makes PKI secrets-aware.',opts:[{val:'hashicorp',label:'HashiCorp Vault',desc:'Dynamic secrets + PKI engine'},{val:'aws_sm',label:'AWS Secrets Manager / KMS',desc:'AWS-native'},{val:'azure_kv',label:'Azure Key Vault',desc:'Azure-native'},{val:'none',label:'No centralised vault',desc:'Env vars / files'}]},
    {id:'devops_timeline',title:'When do you need this solved?',sub:'',opts:[{val:'now',label:'Now — pipeline is blocked',desc:'Urgent'},{val:'quarter',label:'This quarter',desc:'3-month window'},{val:'h2',label:'Later this year',desc:'Planned'},{val:'exploring',label:'Exploring',desc:'No deadline yet'}]},
  ],
  code_signing:[
    {id:'artifacts',title:'What are you signing?',sub:'',opts:[{val:'windows',label:'Windows executables / installers',desc:'.exe, .msi, .dll'},{val:'macos',label:'macOS applications',desc:'App bundles, pkg, DMG'},{val:'linux',label:'Linux packages / containers',desc:'RPM, DEB, OCI images'},{val:'mixed',label:'Cross-platform / mixed',desc:'Multiple OS targets'}]},
    {id:'has_ev',title:'Do you currently have EV code signing certificates?',sub:'EV certs give immediate SmartScreen reputation — no warm-up period.',opts:[{val:'yes_ev',label:'Yes — EV deployed',desc:'Looking to maintain or migrate'},{val:'ov_only',label:'OV only',desc:'Getting SmartScreen warnings'},{val:'nothing',label:'No code signing at all',desc:'Starting fresh'},{val:'expired',label:'Expired / lapsing',desc:'Urgent renewal needed'}]},
    {id:'smartscreen',title:'Are users seeing SmartScreen or Gatekeeper warnings?',sub:'Eliminated with EV + timestamping.',showIf:(t,d)=>d.artifacts!=='linux',opts:[{val:'always',label:'Yes — constantly',desc:'Significant customer friction'},{val:'sometimes',label:'Occasionally on new builds',desc:'Reputation warming period'},{val:'no',label:'No warnings',desc:'Already have EV or reputation'},{val:'unknown',label:'Unknown',desc:"Haven't tracked this"}]},
    {id:'key_storage_sign',title:'How are your code signing keys stored?',sub:'Microsoft and Apple require hardware-protected keys for EV.',opts:[{val:'cloud_hsm',label:'Cloud HSM (AWS KMS, Azure Key Vault)',desc:'FIPS-backed cloud storage'},{val:'hardware_token',label:'Physical HSM / YubiKey',desc:'Hardware token'},{val:'software',label:'Software keystore',desc:'Keys in files — needs upgrading'},{val:'nothing',label:"Haven't addressed key security",desc:'Need guidance'}]},
    {id:'ci_cd_sign',title:'Is signing integrated into your CI/CD pipeline?',sub:'Manual signing creates gaps and slows releases.',opts:[{val:'full',label:'Yes — fully automated',desc:'Every build signed'},{val:'partial',label:'Partial',desc:'Some pipelines only'},{val:'manual',label:'Manual only',desc:'Developer signs before release'},{val:'none',label:'No signing yet',desc:'Starting from scratch'}]},
    {id:'timestamp',title:'Are you using RFC 3161 timestamping?',sub:'Without it, signatures become invalid when the cert expires.',opts:[{val:'yes',label:'Yes',desc:'Signatures valid beyond cert expiry'},{val:'no',label:'No',desc:'Signatures expire with cert'},{val:'unsure',label:'Unsure',desc:'Need to check'}]},
    {id:'container_sign',title:'Are you signing container images?',sub:'OCI registries support Notary v2 / Cosign / Sigstore.',showIf:(t,d)=>['linux','mixed'].includes(d.artifacts),opts:[{val:'yes',label:'Yes',desc:'Notary v2, Cosign, Sigstore'},{val:'no',label:'No',desc:'Images unsigned — supply chain risk'},{val:'planned',label:'Planning to',desc:'On roadmap'}]},
    {id:'supply_chain',title:'How concerned are you about software supply chain attacks?',sub:'SolarWinds and XZ Utils both exploited unsigned pipelines.',opts:[{val:'critical',label:'Critical — top priority',desc:'Post-incident or under mandate'},{val:'high',label:'High — actively addressing',desc:'SBOM + signing in progress'},{val:'medium',label:'Moderate',desc:'On the roadmap'},{val:'low',label:'Low',desc:'Not prioritised yet'}]},
    {id:'sign_timeline',title:'When do you need code signing in place?',sub:'',opts:[{val:'urgent',label:'Urgent — customer / store mandate',desc:'Blocking distribution'},{val:'quarter',label:'This quarter',desc:'3-month window'},{val:'h2',label:'Later this year',desc:'Planned'},{val:'exploring',label:'Exploring',desc:'No deadline'}]},
  ],
  pqc:[
    {id:'pqc_driver',title:'What is driving your PQC initiative?',sub:'',opts:[{val:'regulation',label:'Regulatory mandate (NIST / NSA / CISA)',desc:'Government or compliance requirement'},{val:'board',label:'Board-level risk directive',desc:'Executive mandate'},{val:'harvest',label:'Harvest-now-decrypt-later data risk',desc:'Long-lived secrets at risk today'},{val:'proactive',label:'Proactive — getting ahead of the curve',desc:'No mandate yet'}]},
    {id:'crypto_inventory',title:'Have you completed a cryptographic inventory?',sub:'You cannot plan a migration without knowing what you are migrating.',opts:[{val:'full',label:'Full inventory done',desc:'All algorithms known'},{val:'partial',label:'Partial',desc:'Some systems mapped'},{val:'none',label:'Not started',desc:"Don't know what we're using"},{val:'in_progress',label:'In progress',desc:'Actively cataloguing'}]},
    {id:'harvest_concern',title:'How long do your most sensitive secrets need to remain confidential?',sub:'This defines your actual quantum exposure window.',opts:[{val:'years_10plus',label:'10+ years',desc:'Critical IP, government data'},{val:'years_5_10',label:'5–10 years',desc:'Financial, medical, legal'},{val:'years_1_5',label:'1–5 years',desc:'Standard business data'},{val:'ephemeral',label:'< 1 year',desc:'Short-lived, low risk'}]},
    {id:'algorithms_used',title:'Which public-key algorithms are currently deployed?',sub:'These are the algorithms quantum computers will break.',opts:[{val:'rsa',label:'RSA 2048 / 4096',desc:'Most common today'},{val:'ecc',label:'ECDSA P-256 / P-384',desc:'Modern elliptic curve'},{val:'mixed',label:'Mix of RSA and ECC',desc:'Heterogeneous estate'},{val:'unknown',label:'Unknown',desc:'Inventory needed first'}]},
    {id:'hybrid_interest',title:'Do you need hybrid certificates (classical + PQC combined)?',sub:'Hybrid certs maintain backward compatibility during transition.',opts:[{val:'yes',label:'Yes — hybrid preferred',desc:'Need backward compat'},{val:'pqc_only',label:'PQC-only where possible',desc:'Aggressive migration'},{val:'unsure',label:'Unsure',desc:'Need guidance'},{val:'classical_first',label:'Classical for now, PQC later',desc:'Test first'}]},
    {id:'pqc_target_systems',title:'Which systems are highest priority for PQC migration?',sub:'Prioritise by data lifetime and exposure surface.',opts:[{val:'tls_web',label:'Public TLS / web servers',desc:'Highest exposure'},{val:'auth',label:'Internal authentication (VPN, Wi-Fi, AD)',desc:'High-value identities'},{val:'email',label:'Email signing (S/MIME)',desc:'Long-lived signatures'},{val:'iot',label:'IoT / firmware',desc:'Long-lived embedded systems'}]},
    {id:'pqc_skills',title:"What is your team's PQC expertise today?",sub:'This determines advisory engagement depth.',opts:[{val:'expert',label:'Expert — know ML-DSA, ML-KEM, SLH-DSA',desc:'Need tooling, not education'},{val:'intermediate',label:'Understand the basics',desc:'Need implementation guidance'},{val:'beginner',label:'Just learning',desc:'Need foundational support first'},{val:'none',label:'No in-house PQC skills',desc:'Need full advisory engagement'}]},
    {id:'pqc_timeline',title:'What is your PQC migration target timeline?',sub:'NSA mandates full migration by 2030–2035.',opts:[{val:'immediate',label:'2026–2027',desc:'Early mover / regulatory pressure'},{val:'mid',label:'2028–2029',desc:'Aligned with industry'},{val:'later',label:'2030+',desc:'Following final NIST deadlines'},{val:'none',label:'No timeline yet',desc:'Still in assessment'}]},
  ],
  vmc_cmc:[
    {id:'trademark',title:'Is your brand logo registered as a trademark?',sub:'VMC requires a registered trademark. CMC does not.',opts:[{val:'yes',label:'Yes — registered',desc:'Eligible for VMC'},{val:'pending',label:'Application pending',desc:'VMC after registration'},{val:'no',label:'No trademark',desc:'CMC is the right route'},{val:'unsure',label:'Unsure',desc:'Need to confirm with legal'}]},
    {id:'dmarc_bimi',title:'What is your DMARC enforcement status?',sub:'p=reject or p=quarantine is mandatory for BIMI.',opts:[{val:'reject',label:'p=reject',desc:'BIMI ready'},{val:'quarantine',label:'p=quarantine',desc:'Partially ready'},{val:'none_monitor',label:'p=none / monitoring',desc:'Must enforce before BIMI'},{val:'no_dmarc',label:'No DMARC',desc:'Prerequisite work required'}]},
    {id:'spf_dkim',title:'Are SPF and DKIM configured and aligned with DMARC?',sub:'Both are required for BIMI to function.',opts:[{val:'both',label:'Both configured and aligned',desc:'BIMI-ready foundation'},{val:'spf_only',label:'SPF only',desc:'DKIM needed'},{val:'dkim_only',label:'DKIM only',desc:'SPF needed'},{val:'neither',label:'Neither',desc:'Significant prerequisite work needed'}]},
    {id:'svg_logo',title:'Is your brand logo available in SVG Tiny PS format?',sub:'BIMI requires a specific SVG profile — not all SVGs qualify.',opts:[{val:'ready',label:'Yes — SVG Tiny PS ready',desc:'Design team produced it'},{val:'svg_needs_work',label:'SVG exists but needs reformatting',desc:'Need to create SVG Tiny PS'},{val:'no_svg',label:'Only have PNG / JPEG',desc:'Design work needed'},{val:'unsure',label:'Unsure',desc:'Need to check with design team'}]},
    {id:'email_clients',title:'Which email clients matter most for your brand display?',sub:'BIMI support varies significantly by client.',opts:[{val:'gmail',label:'Gmail / Google Workspace',desc:'Requires VMC'},{val:'apple',label:'Apple Mail',desc:'VMC or CMC'},{val:'yahoo',label:'Yahoo / AOL Mail',desc:'VMC supported'},{val:'all',label:'All supporting clients',desc:'Maximum reach'}]},
    {id:'email_volume',title:'What is your monthly outbound email volume?',sub:'BIMI ROI scales directly with send volume.',opts:[{val:'low',label:'< 10,000 / month',desc:'Small volume'},{val:'mid',label:'10k–100k',desc:'Medium'},{val:'high',label:'100k–1M',desc:'High'},{val:'very_high',label:'1M+',desc:'Very high — strong BIMI ROI'}]},
    {id:'phishing_seen',title:'Have you seen phishing emails impersonating your brand?',sub:'Verified sender logos make impersonation immediately visible.',opts:[{val:'active',label:'Yes — active attacks',desc:'Customers receiving fake emails'},{val:'occasional',label:'Occasional incidents',desc:'Happens sometimes'},{val:'not_seen',label:'Not yet, but concerned',desc:'Proactive'},{val:'monitored',label:'DMARC reports show spoofing',desc:'Data-driven concern'}]},
    {id:'bimi_timeline',title:'When do you want BIMI live?',sub:'Prerequisites (DMARC, trademark, SVG) determine realistic timelines.',opts:[{val:'under_90',label:'< 90 days',desc:'Prerequisites mostly done'},{val:'h1',label:'This half of the year',desc:'6-month window'},{val:'year',label:'Next 12 months',desc:'Longer runway'},{val:'exploring',label:'Exploring',desc:'No deadline'}]},
  ],
  ms_ca_mgmt:[
    {id:'adcs_pain',title:'What is your biggest AD CS pain point?',sub:"Pinpoints where Sectigo's value is greatest.",opts:[{val:'no_visibility',label:'No visibility into issued certs',desc:"Can't see the full estate"},{val:'non_windows',label:"Can't cover non-Windows devices",desc:'Mac, Linux, IoT, mobile gaps'},{val:'manual_renewal',label:'Manual renewal fire drills',desc:'Constant expiry pressure'},{val:'multi_ca',label:'Multiple disconnected CAs',desc:'No central management'}]},
    {id:'adcs_version',title:'Which Windows Server version is your AD CS on?',sub:'Version affects feature support and migration options.',opts:[{val:'2022',label:'Windows Server 2022',desc:'Latest'},{val:'2019_2016',label:'2016 / 2019',desc:'Modern, supported'},{val:'2012_older',label:'2012 or older',desc:'Legacy — upgrade recommended'},{val:'unknown',label:'Unknown',desc:'Need to check'}]},
    {id:'non_win_scope',title:'What non-Windows systems need certificates?',sub:'These are the systems AD CS cannot natively provision.',showIf:(t,d)=>d.adcs_pain==='non_windows',opts:[{val:'mac_linux',label:'macOS and Linux workstations',desc:'Developer / mixed OS estate'},{val:'mobile',label:'iOS and Android (BYOD)',desc:'Employee personal devices'},{val:'iot',label:'IoT / OT devices',desc:'Embedded devices'},{val:'all',label:'All of the above',desc:'Heterogeneous estate'}]},
    {id:'ndes_status',title:'Are you using NDES for SCEP?',sub:'NDES is the standard Windows SCEP endpoint for non-Windows.',opts:[{val:'yes_working',label:'Yes — working',desc:'Want to extend'},{val:'yes_struggling',label:'Yes — unstable / complex',desc:'Operational pain'},{val:'no',label:'No NDES',desc:'Looking for alternative'},{val:'unknown',label:'Unsure',desc:'Need to check'}]},
    {id:'pki_hierarchy',title:'Describe your AD CS hierarchy.',sub:'Depth affects integration and migration complexity.',opts:[{val:'single',label:'Single-tier (root issues directly)',desc:'Simple but less secure'},{val:'two_tier',label:'Two-tier (offline root + online CA)',desc:'Best practice'},{val:'three_plus',label:'Three-tier or more',desc:'Complex enterprise'},{val:'unknown',label:'Unsure',desc:'Need to audit'}]},
    {id:'adcs_ha',title:'Is your issuing CA highly available?',sub:'A single CA instance is a critical single point of failure.',opts:[{val:'ha_yes',label:'Yes — HA configured',desc:'Load-balanced issuing CAs'},{val:'ha_no',label:'No — single issuing CA',desc:'SPOF'},{val:'partial',label:'HA for some CAs',desc:'Inconsistent'},{val:'unknown',label:'Unknown',desc:'Need to verify'}]},
    {id:'intune',title:'Are you integrating AD CS with Microsoft Intune?',sub:'Intune + SCEP/NDES is the standard Windows MDM cert pipeline.',opts:[{val:'yes',label:'Yes — Intune + NDES deployed',desc:'Working, want to extend'},{val:'planned',label:'Planned',desc:'Roadmap'},{val:'no',label:'Not using Intune',desc:'Different MDM or none'},{val:'unsure',label:'Unsure',desc:'Need to check'}]},
    {id:'public_ssl_gap',title:'How are you managing public SSL certificates today?',sub:'AD CS only issues private certs — public SSL is a separate gap.',opts:[{val:'manual_separate',label:'Manually, separate from AD CS',desc:'Different process'},{val:'other_ca',label:'Via a different CA',desc:"DigiCert, Let's Encrypt"},{val:'same_team_silo',label:'Same team but siloed',desc:'No integration'},{val:'want_unified',label:'Want public + private unified',desc:'Seeking single platform'}]},
    {id:'migration_stance',title:'What is your appetite for migrating away from AD CS?',sub:'Sectigo can augment AD CS or fully replace it.',opts:[{val:'augment',label:'Augment — keep AD CS running',desc:'Add Sectigo on top'},{val:'gradual',label:'Gradually replace',desc:'Phased over 1–2 years'},{val:'full_replace',label:'Fully replace AD CS',desc:'Move entirely to Sectigo Private PKI'},{val:'unsure',label:'Unsure',desc:'Need guidance'}]},
  ],
}

function getTriageQuestions(answers) {
  return TRIAGE_QS.filter(q => !q.showIf || q.showIf(answers))
}

function getDeepQuestions(product, triageAnswers, deepAnswersSoFar) {
  const bank = DEEP_BANK[product] || []
  return bank.filter(q => {
    if (!q.showIf) return true
    try { return q.showIf(triageAnswers, deepAnswersSoFar) } catch { return true }
  })
}

function routeProduct(triage) {
  const p = triage.primary_pain
  if (p === 'email_phishing') return 'smime'
  if (p === 'code_trust')     return 'code_signing'
  if (p === 'pqc_readiness')  return 'pqc'
  if (p === 'bimi')           return 'vmc_cmc'
  if (p === 'devops_certs')   return 'devops'
  if (p === 'internal_visibility')
    return (triage.ms_ca === 'yes' || triage.ms_ca === 'partial') ? 'ms_ca_mgmt' : 'private_pki'
  if (triage.ms_ca === 'yes' || triage.ms_ca === 'partial') return 'ms_ca_mgmt'
  return 'scm_enterprise'
}

export function PKIDiscoveryPage() {
  const { currentOrg } = useOrg()
  const { user } = useAuth()
  const [view, setView] = useState('list')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [phase, setPhase] = useState('triage')
  const [triageAnswers, setTriageAnswers] = useState({})
  const [triageIndex, setTriageIndex] = useState(0)
  const [deepAnswers, setDeepAnswers] = useState({})
  const [deepIndex, setDeepIndex] = useState(0)
  const [product, setProduct] = useState(null)
  const [deepQs, setDeepQs] = useState([])
  const [picked, setPicked] = useState(null)
  const [showLead, setShowLead] = useState(false)
  const [lead, setLead] = useState({ customer_name:'', company_name:'', email:'' })
  const [saving, setSaving] = useState(false)
  const [savedSession, setSavedSession] = useState(null)
  const cardRef = useRef(null)

  const triaQs = getTriageQuestions(triageAnswers)
  const currentTriageQ = triaQs[triageIndex]
  const currentDeepQ = deepQs[deepIndex]
  const totalQs = triaQs.length + deepQs.length
  const globalStep = phase === 'triage' ? triageIndex : triaQs.length + deepIndex
  const progressPct = totalQs > 0 ? Math.round((globalStep / totalQs) * 100) : 0
  const phaseColor = phase === 'triage' ? '#1D9E75' : (PM[product]?.color || '#1A4FBA')
  const isLast = phase === 'triage' ? triageIndex === triaQs.length - 1 : deepIndex === deepQs.length - 1

  useEffect(() => { if (currentOrg?.id) loadSessions() }, [currentOrg?.id])
  async function loadSessions() {
    setLoading(true)
    const { data } = await supabase.from('pki_discovery_sessions').select('*').eq('org_id', currentOrg.id).order('created_at', { ascending: false })
    setSessions(data || []); setLoading(false)
  }

  useEffect(() => {
    if (!cardRef.current) return
    cardRef.current.style.opacity = '0'
    cardRef.current.style.transform = 'translateY(6px)'
    const t = setTimeout(() => {
      if (cardRef.current) { cardRef.current.style.transition = 'opacity 0.15s ease, transform 0.15s ease'; cardRef.current.style.opacity = '1'; cardRef.current.style.transform = 'translateY(0)' }
    }, 40)
    return () => clearTimeout(t)
  }, [triageIndex, deepIndex, phase])

  function handleNext() {
    if (!picked) return
    if (phase === 'triage') {
      const na = { ...triageAnswers, [currentTriageQ.id]: picked }
      setTriageAnswers(na); setPicked(null)
      const nextTriaQs = getTriageQuestions(na)
      if (triageIndex + 1 < nextTriaQs.length) {
        setTriageIndex(i => i + 1)
      } else {
        const p = routeProduct(na)
        const dqs = getDeepQuestions(p, na, {})
        setProduct(p); setDeepQs(dqs); setDeepIndex(0); setPhase('deep')
      }
    } else {
      const na = { ...deepAnswers, [currentDeepQ.id]: picked }
      setDeepAnswers(na); setPicked(null)
      const updatedDqs = getDeepQuestions(product, triageAnswers, na)
      setDeepQs(updatedDqs)
      if (deepIndex + 1 < updatedDqs.length) { setDeepIndex(d => d + 1) }
      else { setShowLead(true) }
    }
  }

  function handleBack() {
    setPicked(null)
    if (phase === 'deep' && deepIndex === 0) {
      setPhase('triage'); setTriageIndex(triaQs.length - 1)
      setPicked(triageAnswers[triaQs[triaQs.length - 1].id] || null)
    } else if (phase === 'deep') {
      const pq = deepQs[deepIndex - 1]
      setDeepIndex(d => d - 1); setPicked(deepAnswers[pq.id] || null)
    } else if (triageIndex > 0) {
      setPicked(triageAnswers[triaQs[triageIndex - 1].id] || null); setTriageIndex(i => i - 1)
    }
  }

  async function handleSave() {
    if (!lead.customer_name.trim() || !lead.company_name.trim() || !lead.email.trim()) return
    setSaving(true)
    const score = 82 + Math.floor((Object.keys(deepAnswers).length / Math.max(deepQs.length, 1)) * 15)
    const { data, error } = await supabase.from('pki_discovery_sessions').insert({
      org_id: currentOrg.id, created_by: user.id,
      customer_name: lead.customer_name.trim(), company_name: lead.company_name.trim(), email: lead.email.trim(),
      product_routed: product, triage_answers: triageAnswers, deep_answers: deepAnswers, match_score: score,
    }).select().single()
    setSaving(false)
    if (!error && data) { setSavedSession(data); setShowLead(false); setView('result'); await loadSessions() }
  }

  function startNew() {
    setPhase('triage'); setTriageIndex(0); setDeepIndex(0)
    setTriageAnswers({}); setDeepAnswers({}); setProduct(null); setDeepQs([]); setPicked(null)
    setLead({ customer_name:'', company_name:'', email:'' }); setShowLead(false); setSavedSession(null); setView('wizard')
  }

  async function deleteSession(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this discovery session?')) return
    await supabase.from('pki_discovery_sessions').delete().eq('id', id)
    await loadSessions()
    if (savedSession?.id === id) { setSavedSession(null); setView('list') }
  }

  // LIST
  if (view === 'list') {
    const grouped = sessions.reduce((acc, s) => { (acc[s.company_name] = acc[s.company_name] || []).push(s); return acc }, {})
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:900 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.5rem', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#1D9E75,#1A4FBA)', display:'flex', alignItems:'center', justifyContent:'center' }}><Cpu size={17} color="white"/></div>
              <h1 style={{ fontSize:'1.375rem', fontWeight:600, letterSpacing:'-0.02em', margin:0 }}>PKI Discovery</h1>
            </div>
            <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', margin:0, paddingLeft:44 }}>Sectigo solution discovery · {sessions.length} session{sessions.length !== 1 ? 's' : ''} saved</p>
          </div>
          <button onClick={startNew} className="btn btn-primary" style={{ display:'flex', alignItems:'center', gap:6 }}><Plus size={15}/> New discovery</button>
        </div>
        {loading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--neutral-400)', fontSize:'0.875rem' }}>Loading…</div>
        : sessions.length === 0 ? (
          <div style={{ background:'white', border:'1px dashed var(--neutral-200)', borderRadius:16, padding:'3rem 2rem', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-700)', marginBottom:6 }}>No discovery sessions yet</h3>
            <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', marginBottom:20 }}>Run a PKI discovery call to find the right Sectigo solution for a customer.</p>
            <button onClick={startNew} className="btn btn-primary" style={{ display:'inline-flex', alignItems:'center', gap:6 }}><Plus size={14}/> Start first discovery</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(grouped).map(([company, cSessions]) => (
              <div key={company} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-xs)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.25rem', cursor:'pointer' }} onClick={() => setExpanded(expanded === company ? null : company)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'var(--neutral-100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:700, color:'var(--neutral-600)' }}>{company.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize:'0.9375rem', fontWeight:600, color:'var(--neutral-800)' }}>{company}</div>
                      <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>{cSessions.length} session{cSessions.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  {expanded === company ? <ChevronUp size={16} color="var(--neutral-400)"/> : <ChevronDown size={16} color="var(--neutral-400)"/>}
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
                            <button onClick={e => deleteSession(s.id, e)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--neutral-400)', padding:4, display:'flex', alignItems:'center' }}><Trash2 size={14}/></button>
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

  // RESULT
  if (view === 'result' && savedSession) {
    const s = savedSession; const pm = PM[s.product_routed] || PM.scm_enterprise
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:860 }}>
        <button onClick={() => setView('list')} className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:5, color:'var(--neutral-600)', marginBottom:'1.25rem' }}>← Back to sessions</button>
        <div style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, overflow:'hidden', boxShadow:'var(--shadow-sm)' }}>
          <div style={{ background:pm.color, padding:'1.5rem 1.75rem' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.09em', color:'rgba(255,255,255,0.55)', marginBottom:4 }}>Recommended Sectigo solution</div>
                <div style={{ fontSize:'1.375rem', fontWeight:700, color:'white', marginBottom:2 }}>{pm.icon} {pm.label}</div>
                <div style={{ fontSize:'0.8125rem', color:'rgba(255,255,255,0.7)' }}>{s.customer_name} · {s.company_name}</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:12, padding:'0.625rem 1rem', textAlign:'center', flexShrink:0 }}>
                <div style={{ fontSize:'1.5rem', fontWeight:700, color:'white', lineHeight:1 }}>{s.match_score}%</div>
                <div style={{ fontSize:'0.6875rem', color:'rgba(255,255,255,0.65)', marginTop:2 }}>match score</div>
              </div>
            </div>
          </div>
          <div style={{ padding:'1.25rem 1.75rem' }}>
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              {[{icon:<User size={12}/>,label:'Contact',val:s.customer_name},{icon:<Building2 size={12}/>,label:'Company',val:s.company_name},{icon:<Mail size={12}/>,label:'Email',val:s.email},{icon:<Clock size={12}/>,label:'Date',val:new Date(s.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}].map(f=>(
                <div key={f.label} style={{ background:'var(--neutral-50)', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'7px 12px', minWidth:130 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.625rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-500)', marginBottom:3 }}>{f.icon} {f.label}</div>
                  <div style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-800)' }}>{f.val}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'var(--neutral-50)', borderLeft:`3px solid ${pm.color}`, borderRadius:'0 8px 8px 0', padding:'10px 14px', fontSize:'0.8125rem', color:'var(--neutral-700)', lineHeight:1.7, marginBottom:16 }}>{SUMMARIES[s.product_routed]}</div>
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:8, fontWeight:600 }}>Discovery answers ({Object.keys(s.triage_answers).length + Object.keys(s.deep_answers).length} total)</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))', gap:8, marginBottom:16 }}>
              {[...Object.entries(s.triage_answers),...Object.entries(s.deep_answers)].map(([k,v])=>(
                <div key={k} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:'0.625rem', color:'var(--neutral-500)', marginBottom:2, textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</div>
                  <div style={{ fontSize:'0.8125rem', fontWeight:500, color:'var(--neutral-700)', textTransform:'capitalize' }}>{String(v).replace(/_/g,' ')}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--neutral-500)', marginBottom:8, fontWeight:600 }}>Recommended next steps</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
              {NEXT_STEPS.map((step,i)=>(
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

  // WIZARD
  if (view === 'wizard') {
    const currentQ = phase === 'triage' ? currentTriageQ : currentDeepQ
    const qNum = phase === 'triage' ? triageIndex + 1 : deepIndex + 1
    const totalInPhase = phase === 'triage' ? triaQs.length : deepQs.length
    const phaseLbl = phase === 'triage' ? 'Triage' : `Deep · ${PM[product]?.label || ''}`
    return (
      <div style={{ padding:'1.5rem 2rem', maxWidth:700 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem' }}>
          <button onClick={() => setView('list')} className="btn btn-ghost btn-sm" style={{ color:'var(--neutral-500)', display:'flex', alignItems:'center', gap:5 }}>← Back</button>
          <span style={{ fontSize:'0.8125rem', color:'var(--neutral-400)' }}>{globalStep + 1} / {totalQs > 0 ? totalQs : '…'}</span>
        </div>
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ height:4, background:'var(--neutral-150)', borderRadius:3, overflow:'hidden', marginBottom:8 }}>
            <div style={{ height:'100%', width:`${progressPct}%`, background:`linear-gradient(90deg,${phaseColor},${phaseColor}bb)`, borderRadius:3, transition:'width 0.3s ease' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'0.6875rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em', color:phaseColor, background:`${phaseColor}15`, padding:'2px 8px', borderRadius:10 }}>{phaseLbl}</span>
            <span style={{ fontSize:'0.75rem', color:'var(--neutral-400)' }}>{progressPct}%</span>
          </div>
        </div>
        {currentQ && (
          <div ref={cardRef} style={{ background:'white', border:'1px solid var(--neutral-150)', borderRadius:16, padding:'1.5rem', marginBottom:'0.75rem', boxShadow:'var(--shadow-xs)' }}>
            <div style={{ fontSize:'0.6875rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--neutral-400)', marginBottom:6 }}>Q{qNum} of {totalInPhase}</div>
            <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)', marginBottom: currentQ.sub ? 4 : 14, lineHeight:1.4 }}>{currentQ.title}</div>
            {currentQ.sub && <div style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', lineHeight:1.6, marginBottom:14 }}>{currentQ.sub}</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {currentQ.opts.map(opt => {
                const isSel = picked === opt.val
                return (
                  <button key={opt.val} onClick={() => setPicked(opt.val)} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: isSel ? `${phaseColor}0e` : 'var(--neutral-50)', border:`${isSel ? 2 : 1}px solid ${isSel ? phaseColor : 'var(--neutral-200)'}`, borderRadius:10, cursor:'pointer', textAlign:'left', transition:'all 0.1s' }}>
                    <div style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${isSel ? phaseColor : 'var(--neutral-300)'}`, background: isSel ? phaseColor : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {isSel && <div style={{ width:6, height:6, borderRadius:'50%', background:'white' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize:'0.875rem', fontWeight:600, color:'var(--neutral-800)', marginBottom: opt.desc ? 1 : 0 }}>{opt.label}</div>
                      {opt.desc && <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)', lineHeight:1.4 }}>{opt.desc}</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={handleBack} className="btn btn-ghost btn-sm" style={{ color:'var(--neutral-500)', visibility:(phase==='triage'&&triageIndex===0)?'hidden':'visible' }}>← Back</button>
          <button onClick={handleNext} disabled={!picked} className="btn btn-primary" style={{ opacity:picked?1:0.35, display:'flex', alignItems:'center', gap:6 }}>
            {isLast ? 'Save & get recommendation →' : <><span>Continue</span><ChevronRight size={15}/></>}
          </button>
        </div>
        {showLead && (
          <div style={{ position:'fixed', inset:0, background:'rgba(14,22,36,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
            <div style={{ background:'white', borderRadius:20, padding:'1.75rem', width:'100%', maxWidth:440, boxShadow:'var(--shadow-xl)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:PM[product]?.bg||'#E8F7F2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{PM[product]?.icon||'🔐'}</div>
                <div>
                  <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--neutral-800)' }}>Save discovery results</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--neutral-500)' }}>Recommendation: {PM[product]?.label}</div>
                </div>
              </div>
              <p style={{ fontSize:'0.8125rem', color:'var(--neutral-500)', marginBottom:'1.25rem', lineHeight:1.6 }}>Enter the customer details to save this session.</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:'1.25rem' }}>
                {[{icon:<User size={13}/>,label:'Customer name',key:'customer_name',placeholder:'Jane Smith'},{icon:<Building2 size={13}/>,label:'Company name',key:'company_name',placeholder:'Acme Corporation'},{icon:<Mail size={13}/>,label:'Email',key:'email',placeholder:'jane@acme.com',type:'email'}].map(f=>(
                  <div key={f.key} className="form-group" style={{ margin:0 }}>
                    <label className="form-label" style={{ display:'flex', alignItems:'center', gap:5 }}>{f.icon} {f.label}</label>
                    <input className="input" type={f.type||'text'} placeholder={f.placeholder} value={lead[f.key]} onChange={e=>setLead(p=>({...p,[f.key]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-secondary" onClick={() => setShowLead(false)} style={{ flex:1 }}>Cancel</button>
                <button className={`btn btn-primary ${saving?'btn-loading':''}`} onClick={handleSave} disabled={saving||!lead.customer_name.trim()||!lead.company_name.trim()||!lead.email.trim()} style={{ flex:1, display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                  {saving?'':<><CheckCircle2 size={15}/> Save &amp; view results</>}
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
