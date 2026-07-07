#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Resolve code root directory (assuming this script is in backend/scripts/deploy.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

ENV_FILE="$SCRIPT_DIR/.env.deploy"
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE"
fi

KEY_PATH="${KEY_PATH:-/Users/peigen/.ssh/hetzner_main_key}"

if [ -z "$SERVER_IP" ]; then
    read -p "Enter Target Production Server IP: " SERVER_IP
fi

if [ -z "$PASSPHRASE" ]; then
    read -s -p "Enter SSH Key Passphrase: " PASSPHRASE
    echo ""
fi

if [ -z "$DB_PASS" ]; then
    read -s -p "Enter Target Production DB Password: " DB_PASS
    echo ""
fi

echo "=========================================================="
echo "Starting LangStudy Automatic Secure Deployment Pipeline"
echo "Project Root: $PROJECT_ROOT"
echo "Target Host: root@$SERVER_IP"
echo "=========================================================="

# 1. Start ssh-agent and add key via expect
echo "Adding SSH key passphrase to agent..."
eval $(ssh-agent -s)

# Use expect to interactively add the key passphrase
/usr/bin/expect <<EOF
spawn ssh-add "$KEY_PATH"
expect "Enter passphrase for"
send "$PASSPHRASE\r"
expect eof
EOF

# Define helper for SSH commands
function run_ssh() {
    ssh -o StrictHostKeyChecking=no root@$SERVER_IP "$@"
}

# 2. Verify connection
echo "Verifying SSH connection..."
run_ssh "echo 'SSH Connection Successful! OS Info:' && cat /etc/os-release | grep PRETTY_NAME"

# 3. Compile and Pack Local Assets
echo "Packing frontend static assets..."
cd frontend
tar -czf ../frontend.tar.gz -C dist .
cd ..

echo "Compiling Go backend binaries for target OS (Linux amd64 cross-compilation)..."
cd backend
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o bin/server ./cmd/server
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o bin/migrate ./cmd/migrate
tar -czf ../backend.tar.gz bin configs/config.prod.yaml scripts
cd ..

echo "Assets packed successfully (frontend.tar.gz, backend.tar.gz)."

# 4. Prepare Remote Directory Structures & Dependencies
echo "Initializing dependencies and low-privileged users on target server..."
run_ssh 'bash -s' <<EOF
    # Set non-interactive debian frontend
    export DEBIAN_FRONTEND=noninteractive
    
    # 1. Update and install basic dependencies
    apt-get update -y
    apt-get install -y nginx postgresql postgresql-contrib redis-server python3 python3-venv python3-pip
    
    # 2. Create dedicated low-privileged system user 'langstudy'
    if ! id -u langstudy >/dev/null 2>&1; then
        useradd -r -s /bin/false langstudy
        echo "Created system user langstudy."
    fi

    # 3. Create required directory structure
    mkdir -p /opt/langstudy/backend
    mkdir -p /opt/langstudy/frontend
    mkdir -p /data/langstudy/log
    mkdir -p /etc/langstudy/secrets

    # 4. Configure PostgreSQL
    sudo -u postgres psql -c "CREATE DATABASE langstudy;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER lang_db_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE langstudy TO lang_db_user;" 2>/dev/null || true
    # PostgreSQL 15+ requires explicit CREATE privilege on public schema for non-superuser
    sudo -u postgres psql -d langstudy -c "GRANT ALL ON SCHEMA public TO lang_db_user;" 2>/dev/null || true
EOF

# 5. Secure Credentials Setup
echo "Configuring secure credential database pass file..."
run_ssh "echo -n '$DB_PASS' > /etc/langstudy/secrets/pg_pass"

# 6. Upload Assets
echo "Uploading application binaries and static files..."
scp -o StrictHostKeyChecking=no frontend.tar.gz root@$SERVER_IP:/tmp/
scp -o StrictHostKeyChecking=no backend.tar.gz root@$SERVER_IP:/tmp/

# 7. Unpack and configure application
echo "Extracting assets and configuring permissions..."
run_ssh 'bash -s' <<EOF
    # Extract Frontend
    rm -rf /opt/langstudy/frontend/*
    tar -xzf /tmp/frontend.tar.gz -C /opt/langstudy/frontend
    
    # Create absolute audio storage directory
    mkdir -p /data/langstudy/audio
    
    # Extract Backend (preserving virtual environment)
    find /opt/langstudy/backend -mindepth 1 -maxdepth 1 ! -name '.venv' -exec rm -rf {} +
    tar -xzf /tmp/backend.tar.gz -C /opt/langstudy/backend
    
    # Configure production config.yaml
    cp /opt/langstudy/backend/configs/config.prod.yaml /opt/langstudy/backend/config.yaml
    
    # Ensure JWT secret exists persistently on the server to prevent logging out users on redeploy
    if [ ! -f "/etc/langstudy/secrets/jwt_secret" ]; then
        openssl rand -hex 18 > /etc/langstudy/secrets/jwt_secret
        chmod 400 /etc/langstudy/secrets/jwt_secret
        chown langstudy:langstudy /etc/langstudy/secrets/jwt_secret
    fi
    REMOTE_JWT_SECRET=\$(cat /etc/langstudy/secrets/jwt_secret)
    
    # Replace JWT secret and PG user in configuration
    sed -i "s/replace-this-with-a-secure-random-32-character-secret/\$REMOTE_JWT_SECRET/g" /opt/langstudy/backend/config.yaml
    sed -i "s/user: postgres/user: lang_db_user/g" /opt/langstudy/backend/config.yaml
    # Disable redis password since it is a local host connection (or configure if redis.conf demands password)
    sed -i 's/password_file: "\/etc\/langstudy\/secrets\/redis_pass"/password_file: ""/g' /opt/langstudy/backend/config.yaml
    
    # Build Python virtual environment for edge-tts if not exists
    cd /opt/langstudy/backend
    if [ ! -d ".venv" ]; then
        python3 -m venv .venv
        .venv/bin/pip install --upgrade pip
        .venv/bin/pip install edge-tts
    fi
    
    # Correct all directory ownerships
    chown -R langstudy:langstudy /opt/langstudy
    chown -R langstudy:langstudy /data/langstudy
    chown -R langstudy:langstudy /etc/langstudy
    
    # Set proper directory and file execution permissions
    chmod 750 /opt/langstudy/backend
    chmod 755 /opt/langstudy/frontend
    chmod 770 /data/langstudy/log
    chmod 755 /data/langstudy/audio
    chmod 700 /etc/langstudy/secrets
    chmod 400 /etc/langstudy/secrets/pg_pass
    
    # Cleanup temp archives
    rm -f /tmp/frontend.tar.gz /tmp/backend.tar.gz
EOF

# 8. Setup Systemd Service
echo "Configuring Systemd service..."
run_ssh 'bash -s' <<EOF
    # Copy unit file to systemd directory
    cp /opt/langstudy/backend/scripts/langstudy.service /etc/systemd/system/langstudy.service
    
    # Reload and start service
    systemctl daemon-reload
    systemctl enable langstudy
    systemctl restart langstudy
EOF

# 9. Setup Nginx Configuration
echo "Configuring Nginx reverse proxy..."
run_ssh 'bash -s' <<EOF
    cat > /etc/nginx/sites-available/langstudy <<'NGINX_CONF'
server {
    listen 80;
    
    # Host settings
    server_name _;

    location / {
        root /opt/langstudy/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        
        # Extended timeout for LLM generation
        proxy_read_timeout 180s;
        proxy_connect_timeout 180s;
    }

    location /static/ {
        alias /data/langstudy/audio/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }
}
NGINX_CONF

    # Enable site and restart nginx
    ln -sf /etc/nginx/sites-available/langstudy /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    nginx -t
    systemctl restart nginx
EOF

# 10. Clean up local archives
rm -f frontend.tar.gz backend.tar.gz

echo "=========================================================="
echo "LangStudy Deployment Completed Successfully!"
echo "Server Status:"
run_ssh "systemctl status langstudy --no-pager"
echo "=========================================================="
