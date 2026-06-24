# ============================================================
# CTF Cyber Range - Dockerfile
# Admin Feedback System (Cookie Reuse & MFA Bypass)
# ============================================================
# Services:
#   - Node.js application (port 3075)
#   - Puppeteer admin bot (headless Chromium)
#   - SSH server for Blue Team (port 2275)
#   - Log directory at /opt/admin/logs
# ============================================================

FROM node:18-slim

LABEL maintainer="CTF Cyber Range"
LABEL description="Red vs Blue CTF - Cookie Reuse & MFA Bypass Lab"

# Install system dependencies + Chromium for Puppeteer bot
RUN apt-get update && apt-get install -y \
    openssh-server \
    python3 \
    sudo \
    grep \
    gawk \
    sed \
    less \
    curl \
    net-tools \
    procps \
    # Chromium and dependencies for Puppeteer admin bot
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Puppeteer
ENV CHROMIUM_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create SSH run directory
RUN mkdir -p /run/sshd

# ============================================================
# Setup Application
# ============================================================
WORKDIR /opt/app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production

# Copy application source
COPY app.js bot.js ./

# ============================================================
# Setup Log Generator
# ============================================================
COPY setup_logs.py /opt/setup_logs.py
RUN chmod +x /opt/setup_logs.py

# Create log directory (Flag: SCENARIO75{/opt/admin/logs})
RUN mkdir -p /opt/admin/logs

# ============================================================
# Setup Entrypoint
# ============================================================
COPY start.sh /opt/start.sh
RUN chmod +x /opt/start.sh

# ============================================================
# Expose Ports
# ============================================================
# HTTP - Node.js Application
EXPOSE 3075
# SSH - Blue Team Access
EXPOSE 2275

# ============================================================
# Start Services
# ============================================================
ENTRYPOINT ["/opt/start.sh"]
