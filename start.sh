#!/bin/bash
# ============================================================
# CTF Cyber Range - Container Entrypoint Script
# Starts: SSH server, Log Generator, Node.js Application
# ============================================================

set -e

echo "==========================================="
echo "  CTF Cyber Range - Starting Services"
echo "  Zone: feedback.admin.local"
echo "==========================================="

# ============================================================
# 1. Setup SSH Server
# ============================================================
echo "[*] Configuring SSH server on port 2275..."

# Generate SSH host keys if they don't exist
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    ssh-keygen -A
fi

# Configure SSH
cat > /etc/ssh/sshd_config << 'SSHEOF'
Port 2275
PermitRootLogin no
PasswordAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd yes
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
SSHEOF

# Create analyst user for Blue Team
if ! id "analyst" &>/dev/null; then
    useradd -m -s /bin/bash analyst
    echo "analyst:blue_team_rocks" | chpasswd
    echo "[+] Blue Team user 'analyst' created (password: blue_team_rocks)"
fi

# Set MOTD for Blue Team
cat > /etc/motd << 'MOTDEOF'

=====================================================
   CTF Cyber Range - Blue Team Forensics Terminal
=====================================================
   Role: Security Analyst (Blue Team)
   Mission: Analyze logs and reconstruct the attack
   
   Log Location: /opt/admin/logs/
   Files:
     - access.log (Nginx access log)
     - error.log  (Nginx error log)
   
   Tools available: grep, awk, sed, cat, less, head,
                    tail, wc, sort, uniq, base64, cut
   
   Good luck, analyst!
=====================================================

MOTDEOF

# Start SSH daemon
/usr/sbin/sshd -D &
SSH_PID=$!
echo "[+] SSH server started on port 2275 (PID: $SSH_PID)"

# ============================================================
# 2. Generate Mock Logs
# ============================================================
echo "[*] Generating forensic logs..."
python3 /opt/setup_logs.py

# Give analyst read access to logs
chmod -R 755 /opt/admin/logs/
chown -R analyst:analyst /opt/admin/logs/

echo "[+] Logs generated and accessible at /opt/admin/logs/"

# ============================================================
# 3. Start Node.js Application
# ============================================================
echo "[*] Starting Node.js application on port 3075..."
cd /opt/app

echo ""
echo "==========================================="
echo "  All services running!"
echo "  HTTP:  http://localhost:3075"
echo "  SSH:   ssh analyst@localhost -p 2275"
echo "  Logs:  /opt/admin/logs/"
echo "==========================================="
echo ""

# Run Node.js in foreground (keeps container alive)
exec node app.js
