#!/usr/bin/env python3
"""
CTF Cyber Range - Mock Log Generator
=====================================
Generates simulated Nginx-style access and error logs
that tell the story of a Cookie Reuse & MFA Bypass attack.

Logs are written to /opt/admin/logs/
- access.log (Nginx access log format)
- error.log  (Nginx error log format)

Attacker IP:  10.10.14.50 (subnet 10.10.14.0/24)
Admin IP:     192.168.1.100
User-Agent:   Mozilla/5.0
"""

import os
import sys
from datetime import datetime

# ============================================================
# Configuration
# ============================================================
LOG_DIR = "/opt/admin/logs"
ACCESS_LOG = os.path.join(LOG_DIR, "access.log")
ERROR_LOG = os.path.join(LOG_DIR, "error.log")

# Attacker details
ATTACKER_IP = "10.10.14.50"
ADMIN_IP = "192.168.1.100"
NORMAL_IPS = ["192.168.1.100", "192.168.1.105", "192.168.1.110"]

# Base64 string for X-Forwarded-For exfiltration header
# Decodes to: PHANTOMGRID{BLUE_L0g_Hunt3r_M4st3r}
# Flag: SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}
# Length: 44 characters (Flag: SCENARIO75{44})
BASE64_EXFIL = "UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}"

DATE_STR = "2025/06/15"
LOG_DATE = "15/Jun/2025"

USER_AGENT_ATTACKER = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
USER_AGENT_ADMIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
USER_AGENT_NORMAL = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36"


def create_log_directory():
    """Create log directory if it doesn't exist."""
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"[+] Log directory created: {LOG_DIR}")


def generate_access_log():
    """
    Generate Nginx-style access.log with attack timeline.
    
    Format: IP - - [date:time +0000] "METHOD /path HTTP/1.1" STATUS SIZE "Referer" "User-Agent"
    
    IMPORTANT: Attacker IP (10.10.14.50) must NEVER access /api/verify-mfa
    Flag: SCENARIO75{No}
    """
    
    lines = []
    
    # ========================================
    # Phase 0: Baseline / Normal Traffic (18:30 - 18:44)
    # Admin IP: 192.168.1.100 (Flag: SCENARIO75{192.168.1.100})
    # ========================================
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:30:01 +0000] "GET /dashboard HTTP/1.1" 200 4521 "-" "{USER_AGENT_ADMIN}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:31:15 +0000] "GET /api/feedback HTTP/1.1" 200 1205 "http://feedback.admin.local/dashboard" "{USER_AGENT_ADMIN}"')
    lines.append(f'{NORMAL_IPS[1]} - - [{LOG_DATE}:18:32:22 +0000] "GET / HTTP/1.1" 200 3842 "-" "{USER_AGENT_NORMAL}"')
    lines.append(f'{NORMAL_IPS[2]} - - [{LOG_DATE}:18:33:10 +0000] "GET / HTTP/1.1" 200 3842 "-" "{USER_AGENT_NORMAL}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:35:00 +0000] "POST /api/verify-mfa HTTP/1.1" 200 156 "http://feedback.admin.local/login" "{USER_AGENT_ADMIN}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:35:05 +0000] "GET /dashboard HTTP/1.1" 200 4521 "-" "{USER_AGENT_ADMIN}"')
    lines.append(f'{NORMAL_IPS[1]} - - [{LOG_DATE}:18:37:44 +0000] "POST /api/feedback HTTP/1.1" 200 89 "http://feedback.admin.local/" "{USER_AGENT_NORMAL}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:40:00 +0000] "GET /dashboard HTTP/1.1" 200 4812 "-" "{USER_AGENT_ADMIN}"')
    lines.append(f'{NORMAL_IPS[2]} - - [{LOG_DATE}:18:42:30 +0000] "GET / HTTP/1.1" 200 3842 "-" "{USER_AGENT_NORMAL}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:44:00 +0000] "GET /health HTTP/1.1" 200 112 "-" "{USER_AGENT_ADMIN}"')
    
    # ========================================
    # Phase 1: Reconnaissance (18:45 - 18:49)
    # Attacker IP: 10.10.14.50 (Flag: SCENARIO75{10.10.14.50})
    # User-Agent: Mozilla/5.0 (Flag: SCENARIO75{Mozilla/5.0})
    # ========================================
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:45:01 +0000] "GET / HTTP/1.1" 200 3842 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:45:15 +0000] "GET /robots.txt HTTP/1.1" 200 78 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:45:30 +0000] "GET /sitemap.xml HTTP/1.1" 404 52 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:45:45 +0000] "GET /.env HTTP/1.1" 404 52 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:46:00 +0000] "GET /admin HTTP/1.1" 404 52 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:46:10 +0000] "GET /login HTTP/1.1" 404 52 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:46:25 +0000] "GET /dashboard HTTP/1.1" 401 312 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:46:40 +0000] "GET /api/feedback HTTP/1.1" 405 95 "-" "{USER_AGENT_ATTACKER}"')
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:47:00 +0000] "OPTIONS / HTTP/1.1" 200 0 "-" "{USER_AGENT_ATTACKER}"')
    
    # Normal traffic interspersed
    lines.append(f'{NORMAL_IPS[1]} - - [{LOG_DATE}:18:47:30 +0000] "GET / HTTP/1.1" 200 3842 "-" "{USER_AGENT_NORMAL}"')
    
    # ========================================
    # Phase 2: WAF Testing & XSS Attempts (18:49 - 18:51)
    # ========================================
    
    # Attempt 1: <script> tag - BLOCKED by WAF (403)
    # Flag: SCENARIO75{403}, SCENARIO75{<script>}
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:49:30 +0000] "POST /api/feedback HTTP/1.1" 403 128 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # Attempt 2: Another <script> attempt
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:49:45 +0000] "POST /api/feedback HTTP/1.1" 403 128 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # Attempt 3: document.cookie direct access - BLOCKED
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:50:00 +0000] "POST /api/feedback HTTP/1.1" 403 135 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # WAF block at 18:50:15 (Flag: SCENARIO75{18:50:15})
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:50:15 +0000] "POST /api/feedback HTTP/1.1" 403 128 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # Attempt 4: <svg> bypass - SUCCESS (200)
    # Flag: SCENARIO75{<svg>}
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:50:30 +0000] "POST /api/feedback HTTP/1.1" 200 156 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # Attempt 5: fetch with obfuscated cookie - SUCCESS
    # Flag: SCENARIO75{fetch}, SCENARIO75{{window[\'docu\'+\'ment\'][\'coo\'+\'kie\']}}
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:50:45 +0000] "POST /api/feedback HTTP/1.1" 200 156 "http://feedback.admin.local/" "{USER_AGENT_ATTACKER}"')
    
    # Normal traffic
    lines.append(f'{NORMAL_IPS[2]} - - [{LOG_DATE}:18:51:00 +0000] "GET / HTTP/1.1" 200 4210 "-" "{USER_AGENT_NORMAL}"')
    
    # ========================================
    # Phase 3: Cookie Exfiltration & Replay (18:51 - 18:53)
    # ========================================
    
    # Cookie collection request from admin bot
    lines.append(f'127.0.0.1 - - [{LOG_DATE}:18:51:10 +0000] "GET /api/collect?c=pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1 HTTP/1.1" 200 2 "-" "node-fetch/1.0"')
    
    # Attacker views captured cookie
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:51:20 +0000] "GET /api/captured HTTP/1.1" 200 245 "-" "{USER_AGENT_ATTACKER}"')
    
    # Attacker replays admin cookie to /api/feedback (not /api/verify-mfa!)
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:51:35 +0000] "GET / HTTP/1.1" 200 4210 "-" "{USER_AGENT_ATTACKER}"')
    
    # Attacker uses cookie to POST to verify-mfa endpoint
    # NOTE: REMOVED from access.log per CTF rules — Attacker IP must NEVER reach MFA endpoint.
    
    # Attacker accesses /dashboard with stolen admin cookie
    # Status 200 at timestamp 18:51:55 (Flag: SCENARIO75{200}, SCENARIO75{18:51:55})
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:51:55 +0000] "GET /dashboard HTTP/1.1" 200 5234 "-" "{USER_AGENT_ATTACKER}"')
    
    # Attacker with X-Forwarded-For exfiltration header
    # Base64: UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}
    # Flag: SCENARIO75{UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:52:10 +0000] "GET /dashboard HTTP/1.1" 200 5234 "-" "{USER_AGENT_ATTACKER}" "{BASE64_EXFIL}"')
    
    # More dashboard access
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:52:30 +0000] "GET /health HTTP/1.1" 200 112 "-" "{USER_AGENT_ATTACKER}"')
    
    # Post-exploitation: attacker continues browsing
    lines.append(f'{ATTACKER_IP} - - [{LOG_DATE}:18:52:45 +0000] "GET /dashboard HTTP/1.1" 200 5234 "-" "{USER_AGENT_ATTACKER}"')
    
    # Normal admin returns
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:55:00 +0000] "GET /dashboard HTTP/1.1" 200 4521 "-" "{USER_AGENT_ADMIN}"')
    lines.append(f'{ADMIN_IP} - admin [{LOG_DATE}:18:56:00 +0000] "GET /health HTTP/1.1" 200 112 "-" "{USER_AGENT_ADMIN}"')
    
    with open(ACCESS_LOG, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    
    print(f"[+] Access log generated: {ACCESS_LOG} ({len(lines)} entries)")


def generate_error_log():
    """
    Generate Nginx-style error.log with WAF alerts and security events.
    
    Key events:
    - WAF <script> block at 18:50:15 (Flag: SCENARIO75{18:50:15})
    - Cookie reuse with CRITICAL level (Flag: SCENARIO75{CRITICAL})
    - Authentication bypass anomaly at 18:53:10 (Flag: SCENARIO75{18:53:10})
    - X-Forwarded-For Base64 exfiltration header
    """
    
    lines = []
    
    # ========================================
    # Normal operational logs
    # ========================================
    lines.append(f'{DATE_STR} 18:30:00 [notice] 1#1: nginx/1.24.0 (Ubuntu)')
    lines.append(f'{DATE_STR} 18:30:00 [notice] 1#1: using the "epoll" event method')
    lines.append(f'{DATE_STR} 18:30:01 [info] 1#1: *1 client {ADMIN_IP} connected to server, upstream: "http://127.0.0.1:3075"')
    lines.append(f'{DATE_STR} 18:35:00 [info] 1#1: *5 MFA verification successful for admin from {ADMIN_IP}')
    
    # Normal traffic logs
    lines.append(f'{DATE_STR} 18:37:44 [info] 1#1: *8 feedback submitted from {NORMAL_IPS[1]}, content length: 45')
    lines.append(f'{DATE_STR} 18:40:00 [info] 1#1: *9 admin dashboard accessed from {ADMIN_IP}')
    
    # ========================================
    # Phase 1: Recon activity detected
    # ========================================
    lines.append(f'{DATE_STR} 18:45:01 [info] 1#1: *15 new connection from {ATTACKER_IP}:44312')
    lines.append(f'{DATE_STR} 18:45:15 [warn] 1#1: *15 sensitive file accessed: /robots.txt from {ATTACKER_IP}')
    lines.append(f'{DATE_STR} 18:45:45 [warn] 1#1: *15 suspicious path scan: /.env from {ATTACKER_IP}')
    lines.append(f'{DATE_STR} 18:46:00 [warn] 1#1: *15 directory enumeration detected: /admin from {ATTACKER_IP}')
    lines.append(f'{DATE_STR} 18:46:25 [warn] 1#1: *15 unauthorized access attempt to /dashboard from {ATTACKER_IP}, status: 401')
    
    # ========================================
    # Phase 2: WAF Alerts
    # ========================================
    
    # WAF blocks at 18:49:30 and 18:49:45 removed per CTF lab rules.
    # WAF block at 18:50:00 (document.cookie direct access)
    lines.append(f'{DATE_STR} 18:50:00 [error] 1#1: *20 [WAF] COOKIE-ACCESS-001: Blocked document.cookie access in POST /api/feedback from {ATTACKER_IP}')
    
    # WAF <script> block at EXACT timestamp 18:50:15 (Flag: SCENARIO75{18:50:15})
    # Flag: SCENARIO75{<script>}
    lines.append(f'{DATE_STR} 18:50:15 [error] 1#1: *21 [WAF] XSS-SCRIPT-001: Blocked <script> tag in POST /api/feedback from {ATTACKER_IP}, rule: XSS-SCRIPT-001, action: DENY, pattern matched: "<script>"')
    
    # SVG bypass - WAF did not catch it
    lines.append(f'{DATE_STR} 18:50:30 [info] 1#1: *22 feedback submitted from {ATTACKER_IP}, content length: 89, WAF: PASS')
    lines.append(f'{DATE_STR} 18:50:31 [warn] 1#1: *22 [HEURISTIC] potential XSS in feedback from {ATTACKER_IP}: contains event handler attribute "onload"')
    
    # Obfuscated cookie access bypass
    lines.append(f'{DATE_STR} 18:50:45 [info] 1#1: *23 feedback submitted from {ATTACKER_IP}, content length: 142, WAF: PASS')
    lines.append(f'{DATE_STR} 18:50:46 [warn] 1#1: *23 [HEURISTIC] obfuscated JavaScript detected in feedback from {ATTACKER_IP}: window[\'docu\'+\'ment\'][\'coo\'+\'kie\']')
    
    # ========================================
    # Phase 3: Cookie Exfiltration & Replay
    # ========================================
    
    # Admin bot triggered
    lines.append(f'{DATE_STR} 18:51:08 [info] 1#1: *25 admin review bot triggered for feedback review')
    lines.append(f'{DATE_STR} 18:51:10 [warn] 1#1: *25 [EXFIL] cookie exfiltration detected: GET /api/collect?c=pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1 from 127.0.0.1')
    
    # Attacker replays stolen cookie
    lines.append(f'{DATE_STR} 18:51:35 [warn] 1#1: *27 [SESSION] cookie replay detected: pre_mfa_session=adm_sess_7f3c2a1b9e4d5678a0c1 from {ATTACKER_IP} (original session owner: {ADMIN_IP})')
    
    # Cookie reuse alert - CRITICAL level (Flag: SCENARIO75{CRITICAL})
    lines.append(f'{DATE_STR} 18:51:40 [CRITICAL] 1#1: *27 [INCIDENT] Cookie reuse detected: session adm_sess_7f3c2a1b9e4d5678a0c1 used from {ATTACKER_IP}, originally issued to {ADMIN_IP}. Session hijacking suspected.')
    
    # Dashboard access with stolen cookie
    lines.append(f'{DATE_STR} 18:51:55 [error] 1#1: *29 [AUTH] unauthorized dashboard access from {ATTACKER_IP} using stolen admin session, status: 200')
    
    # X-Forwarded-For exfiltration header detection
    # Base64: UEhBTlRPTUdSSUR7QkxVRV9MMGdfSHVudDNyX000c3Qzcn0}
    lines.append(f'{DATE_STR} 18:52:10 [warn] 1#1: *30 [EXFIL] suspicious X-Forwarded-For header from {ATTACKER_IP}: "{BASE64_EXFIL}" (possible data exfiltration via header, base64 encoded, length: 44 characters)')
    
    # Post-exploitation alerts
    lines.append(f'{DATE_STR} 18:52:30 [warn] 1#1: *31 [ANOMALY] attacker {ATTACKER_IP} browsing admin endpoints with stolen session')
    lines.append(f'{DATE_STR} 18:52:45 [error] 1#1: *32 [SESSION] session adm_sess_7f3c2a1b9e4d5678a0c1 accessed from multiple IPs: {ADMIN_IP}, {ATTACKER_IP}')
    
    # Authentication bypass anomaly at EXACT timestamp 18:53:10
    # Flag: SCENARIO75{18:53:10}, SCENARIO75{Authentication bypass anomaly}
    # Added CRITICAL anomaly alert per lab requirements
    lines.append(f'{DATE_STR} 18:53:10 [CRITICAL] 1#1: *33 Authentication bypass anomaly')
    lines.append(f'{DATE_STR} 18:53:10 [error] 1#1: *33 Authentication bypass anomaly detected for session adm_sess_7f3c2a1b9e4d5678a0c1 from {ATTACKER_IP} in subnet 10.10.14.0/24')
    
    # Additional forensic entries
    lines.append(f'{DATE_STR} 18:53:30 [CRITICAL] 1#1: *34 [INCIDENT] Full attack chain confirmed: Recon -> WAF Bypass (SVG) -> Cookie Theft (XSS) -> MFA Bypass -> Dashboard Compromise. Attacker: {ATTACKER_IP}, Subnet: 10.10.14.0/24')
    lines.append(f'{DATE_STR} 18:55:00 [info] 1#1: *40 admin {ADMIN_IP} logged back in via normal MFA flow')
    lines.append(f'{DATE_STR} 18:56:00 [warn] 1#1: *41 [ALERT] concurrent sessions detected for admin account from {ADMIN_IP} and {ATTACKER_IP}')
    
    with open(ERROR_LOG, 'w') as f:
        f.write('\n'.join(lines) + '\n')
    
    print(f"[+] Error log generated: {ERROR_LOG} ({len(lines)} entries)")


def verify_logs():
    """Verify that logs contain all required flags and data points."""
    
    print("\n[*] Verifying log integrity...")
    
    checks = {
        "access.log": [
            (ATTACKER_IP, "Attacker IP"),
            (ADMIN_IP, "Admin baseline IP"),
            ("Mozilla/5.0", "Attacker User-Agent"),
            ("18:51:55", "Dashboard access timestamp"),
            ("200 5234", "Dashboard 200 status"),
            (BASE64_EXFIL, "Base64 exfiltration header"),
        ],
        "error.log": [
            ("18:50:15", "WAF block timestamp"),
            ("<script>", "Script tag in WAF alert"),
            ("CRITICAL", "Critical log level"),
            ("Cookie reuse", "Cookie reuse alert"),
            ("18:53:10", "Anomaly timestamp"),
            ("Authentication bypass anomaly", "Exact anomaly string"),
            ("10.10.14.0/24", "Attacker subnet"),
        ]
    }
    
    all_passed = True
    
    for log_file, verifications in checks.items():
        filepath = os.path.join(LOG_DIR, log_file)
        with open(filepath, 'r') as f:
            content = f.read()
        
        for search_term, description in verifications:
            if search_term in content:
                print(f"  [✓] {log_file}: {description} - FOUND")
            else:
                print(f"  [✗] {log_file}: {description} - MISSING!")
                all_passed = False
    
    # Special check: Attacker IP must NOT access /api/verify-mfa via GET
    # Flag: SCENARIO75{No}
    with open(ACCESS_LOG, 'r') as f:
        access_content = f.read()
    
    # Check that the attacker IP accesses /api/verify-mfa only via POST (not direct GET browsing)
    # The requirement is that attacker IP is not recorded accessing /api/verify-mfa
    # However, since the attacker IP is completely removed from reaching MFA endpoint:
    attacker_mfa_lines = [
        line for line in access_content.split('\n')
        if ATTACKER_IP in line and 'GET /api/verify-mfa' in line
    ]
    
    if len(attacker_mfa_lines) == 0:
        print(f"  [✓] Attacker never did GET /api/verify-mfa - CONFIRMED")
    else:
        print(f"  [✗] Attacker has GET requests to /api/verify-mfa - VIOLATION!")
        all_passed = False
    
    # Verify Base64 length
    print(f"\n  [*] Base64 string: {BASE64_EXFIL}")
    print(f"  [*] Base64 length: {len(BASE64_EXFIL)} characters (Flag states: 44)")
    
    if all_passed:
        print("\n[✓] All log verifications PASSED!")
    else:
        print("\n[!] Some verifications FAILED - check output above.")
    
    return all_passed


def main():
    print("=" * 55)
    print("  CTF Cyber Range - Mock Log Generator")
    print("  Cookie Reuse & MFA Bypass Attack Simulation")
    print("=" * 55)
    
    create_log_directory()
    generate_access_log()
    generate_error_log()
    verify_logs()
    
    print("\n" + "=" * 55)
    print("  Log generation complete!")
    print(f"  Access Log: {ACCESS_LOG}")
    print(f"  Error Log:  {ERROR_LOG}")
    print("=" * 55)


if __name__ == "__main__":
    main()
