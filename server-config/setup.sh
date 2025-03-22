#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print section headers
print_section() {
  echo -e "\n${GREEN}=== $1 ===${NC}\n"
}

# Function to print info messages
print_info() {
  echo -e "${YELLOW}$1${NC}"
}

# Function to print error messages
print_error() {
  echo -e "${RED}$1${NC}" >&2
}

# Error handling
handle_error() {
  print_error "Error occurred at line $1"
  exit 1
}

trap 'handle_error $LINENO' ERR

# Check if root
if [ "$(id -u)" -ne 0 ]; then
  print_error "This script must be run as root!"
  exit 1
fi

# Welcome message
clear
print_section "Nilo.chat Production Server Setup"
print_info "This script will set up your Digital Ocean server for nilo.chat deployment."
print_info "You'll be prompted for some information during the setup."
echo ""
echo "Press Enter to continue..."
read dummy

# Get domain name
echo ""
echo "Enter your domain name (e.g., api.example.com): "
read DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  print_error "Domain name cannot be empty!"
  exit 1
fi

# Get frontend domain for CORS
echo ""
echo "Enter your frontend domain (e.g., example.com): "
read FRONTEND_DOMAIN
if [ -z "$FRONTEND_DOMAIN" ]; then
  print_error "Frontend domain cannot be empty!"
  exit 1
fi

# Get username for new sudo user
echo ""
echo "Enter username for a new sudo user: "
read NEW_USER
if [ -z "$NEW_USER" ]; then
  print_error "Username cannot be empty!"
  exit 1
fi

# Create app directory path
APP_PATH="/var/www/nilo-chat"

# Update system
print_section "Updating System"
apt update && apt upgrade -y

# Install required software
print_section "Installing Required Software"

# Install Git
print_info "Installing Git..."
if ! command -v git &> /dev/null; then
  apt install -y git
  print_info "Git installed"
else
  print_info "Git already installed"
fi

# Install Node.js
print_info "Installing Node.js..."
if ! command -v node &> /dev/null || [ "$(node -v)" != "v22.14.0" ]; then
  # Remove any existing installations
  apt remove -y nodejs npm || true
  
  # Install dependencies
  apt install -y curl
  
  # Setup NodeSource repository for Node.js 22.x
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  
  # Install Node.js
  apt install -y nodejs
  
  # Make sure the binary is accessible to all users
  if [ -f /usr/local/bin/node ]; then
    chmod 755 /usr/local/bin/node
  fi
  
  if [ -f /usr/bin/node ]; then
    chmod 755 /usr/bin/node
  fi
  
  # Install n globally and set to specific version
  npm install -g n
  n 22.14.0
  
  # Ensure n-installed binaries have correct permissions
  chmod -R 755 /usr/local/n/versions
  
  # Force path to use the new version
  PATH="$PATH"
  hash -r
  
  print_info "Node.js $(node -v) installed"
else
  print_info "Node.js $(node -v) already installed"
fi

# Install PM2
print_info "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
  
  # Fix PM2 binary permissions
  if [ -f /usr/local/bin/pm2 ]; then
    chmod 755 /usr/local/bin/pm2
  fi
  
  if [ -f /usr/bin/pm2 ]; then
    chmod 755 /usr/bin/pm2
  fi
  
  # Fix global node_modules permissions
  chmod -R 755 /usr/local/lib/node_modules/pm2
  
  print_info "PM2 installed"
else
  print_info "PM2 already installed"
fi

# Install Nginx
print_info "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
  apt install -y nginx
  systemctl enable nginx
  systemctl start nginx
  print_info "Nginx installed and started"
else
  print_info "Nginx already installed"
fi

# Create new sudo user
print_section "Setting Up User"
if ! id "$NEW_USER" &>/dev/null; then
  print_info "Creating user $NEW_USER..."
  adduser $NEW_USER
  usermod -aG sudo $NEW_USER
  print_info "User $NEW_USER created with sudo privileges"
else
  print_info "User $NEW_USER already exists"
fi

# Configure UFW (firewall)
print_section "Configuring Firewall"
if command -v ufw &> /dev/null; then
  print_info "Setting up firewall rules..."
  ufw allow OpenSSH
  ufw allow 'Nginx Full'
  
  # Only enable if not already enabled
  if ! ufw status | grep -q "Status: active"; then
    print_info "Enabling firewall..."
    echo "y" | ufw enable
  fi
  
  print_info "Firewall configured"
else
  print_info "UFW not installed, skipping firewall setup"
fi

# Set up application directory
print_section "Setting Up Application Directory"
print_info "Creating $APP_PATH..."
mkdir -p $APP_PATH
chown -R $NEW_USER:$NEW_USER $APP_PATH
print_info "Application directory created and permissions set"

# Configure Nginx
print_section "Configuring Nginx"
print_info "Creating Nginx configuration for $DOMAIN_NAME..."

# Create Nginx config file with CORS support
cat > /etc/nginx/sites-available/nilo-chat << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # Logging
    access_log /var/log/nginx/nilo-chat.access.log;
    error_log /var/log/nginx/nilo-chat.error.log;

    # Specific config for OPTIONS preflight requests
    location ~ ^/(socket\.io/|)$ {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://$FRONTEND_DOMAIN' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        # Pass to the main location rules
        try_files \$uri @node;
    }

    # Specific config for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Important for Socket.IO long-polling and WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 7d;
        proxy_buffers 8 32k;
        proxy_buffer_size 64k;
        
        # CORS headers for Socket.IO
        add_header 'Access-Control-Allow-Origin' 'https://$FRONTEND_DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }

    # Reverse proxy configuration for everything else
    location @node {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Additional WebSocket support
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket timeout settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # CORS headers for proxied requests
        add_header 'Access-Control-Allow-Origin' 'https://$FRONTEND_DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }

    # Main location for regular requests
    location / {
        try_files \$uri @node;
    }

    # Optional: Serve static files directly
    location /static/ {
        alias $APP_PATH/dist/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
        
        # CORS headers for static files
        add_header 'Access-Control-Allow-Origin' 'https://$FRONTEND_DOMAIN' always;
        add_header 'Access-Control-Allow-Methods' 'GET, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
    }
}
EOF

# Enable site
print_info "Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/nilo-chat /etc/nginx/sites-enabled/

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
  print_info "Removing default Nginx site..."
  rm -f /etc/nginx/sites-enabled/default
fi

# Test and reload nginx
nginx -t && systemctl reload nginx
print_info "Nginx configured successfully"

# Set up SSL with Certbot
print_section "Setting Up SSL"
print_info "Installing Certbot..."
apt install -y certbot python3-certbot-nginx

print_info "Obtaining SSL certificate for $DOMAIN_NAME..."
print_info "(This might fail if your domain is not yet pointing to this server)"
print_info "If it fails, you can run 'sudo certbot --nginx -d $DOMAIN_NAME' later"
certbot --nginx -d $DOMAIN_NAME || print_info "SSL setup failed. You can run it manually later."

# Create environment file
print_section "Setting Up Environment"
print_info "Creating .env file..."
cat > $APP_PATH/.env << EOF
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://$FRONTEND_DOMAIN
# Add any other environment variables your app needs
EOF
chown $NEW_USER:$NEW_USER $APP_PATH/.env
print_info "Environment file created"

# Generate deployment keys
print_section "Generating Deployment Keys"
print_info "Creating SSH key for GitHub Actions deployment..."

# Generate SSH key for the new user - with fixed permissions
SSH_DIR="/home/$NEW_USER/.ssh"
SSH_KEY_FILE="$SSH_DIR/github_actions_deploy"

# Create SSH directory with proper permissions
mkdir -p $SSH_DIR
chown $NEW_USER:$NEW_USER $SSH_DIR
chmod 700 $SSH_DIR

# Generate the SSH key as root but for the new user
if [ ! -f "$SSH_KEY_FILE" ]; then
  ssh-keygen -t ed25519 -f $SSH_KEY_FILE -N "" -C "github-actions-deploy"
  
  # Set up authorized_keys if it doesn't exist
  touch $SSH_DIR/authorized_keys
  cat "$SSH_KEY_FILE.pub" >> $SSH_DIR/authorized_keys
  
  # Fix ownership of all generated files
  chown $NEW_USER:$NEW_USER $SSH_KEY_FILE
  chown $NEW_USER:$NEW_USER "$SSH_KEY_FILE.pub"
  chown $NEW_USER:$NEW_USER $SSH_DIR/authorized_keys
  
  # Fix permissions
  chmod 600 $SSH_KEY_FILE
  chmod 644 "$SSH_KEY_FILE.pub"
  chmod 600 $SSH_DIR/authorized_keys
  
  print_info "SSH key generated"
else
  print_info "SSH key already exists"
fi

# Get IP for known_hosts
SERVER_IP=$(curl -s ifconfig.me)
KNOWN_HOSTS=$(ssh-keyscan $SERVER_IP 2>/dev/null)

# Create PM2 ecosystem file
print_section "Setting Up PM2 Configuration"
print_info "Creating PM2 ecosystem file..."

cat > $APP_PATH/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'nilo-chat',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      CORS_ORIGIN: 'https://$FRONTEND_DOMAIN'
    }
  }]
};
EOF

chown $NEW_USER:$NEW_USER $APP_PATH/ecosystem.config.js
print_info "PM2 ecosystem file created"

# Setup PM2 for the new user
print_section "Setting Up PM2 for User $NEW_USER"

# Create and set proper permissions for .pm2 directory
print_info "Setting up PM2 home directory..."
PM2_HOME="/home/$NEW_USER/.pm2"
mkdir -p $PM2_HOME
chown -R $NEW_USER:$NEW_USER $PM2_HOME
chmod -R 700 $PM2_HOME

# Create required PM2 subdirectories with correct permissions
mkdir -p $PM2_HOME/{logs,pids}
chown -R $NEW_USER:$NEW_USER $PM2_HOME/{logs,pids}
chmod -R 700 $PM2_HOME/{logs,pids}

# Ensure binary permissions are correct
print_info "Setting correct permissions for Node.js and PM2 binaries..."
chmod 755 /usr/bin/node /usr/local/bin/node /usr/bin/npm /usr/local/bin/npm /usr/bin/pm2 /usr/local/bin/pm2 2>/dev/null || true

# Find and fix permissions for all node binaries
find /usr/local -name "node" -type f -exec chmod 755 {} \; 2>/dev/null || true
find /usr/local -name "npm" -type f -exec chmod 755 {} \; 2>/dev/null || true

# Setup PM2 to start on boot for the new user
print_info "Configuring PM2 startup for user $NEW_USER..."

# First run PM2 as the new user to initialize its files
sudo -u $NEW_USER PM2_HOME=$PM2_HOME /usr/local/bin/pm2 list || true

# Setup PM2 to start on boot
sudo -u $NEW_USER PM2_HOME=$PM2_HOME env PATH=$PATH:/usr/bin:/usr/local/bin pm2 startup systemd -u $NEW_USER --hp /home/$NEW_USER || true

# Give sudo permission to manage the PM2 service
cat > /etc/sudoers.d/${NEW_USER}-pm2 << EOF
$NEW_USER ALL=(ALL) NOPASSWD: /bin/systemctl start pm2-$NEW_USER, /bin/systemctl stop pm2-$NEW_USER, /bin/systemctl restart pm2-$NEW_USER, /bin/systemctl status pm2-$NEW_USER
EOF
chmod 440 /etc/sudoers.d/${NEW_USER}-pm2

print_info "PM2 configured to start on boot for user $NEW_USER"

# Additional security: Ensure app directory is owned by the new user
print_info "Setting final permissions on application directory..."
chown -R $NEW_USER:$NEW_USER $APP_PATH
chmod -R 755 $APP_PATH

print_info "PM2 setup complete"

# Display GitHub Actions secrets info
print_section "GitHub Actions Secrets"
print_info "Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):"
echo
echo "SSH_PRIVATE_KEY:"
cat $SSH_KEY_FILE
echo
echo "SSH_KNOWN_HOSTS:"
echo "$KNOWN_HOSTS"
echo
echo "SSH_USER:"
echo "$NEW_USER"
echo
echo "SSH_HOST:"
echo "$SERVER_IP"
echo
echo "SSH_PATH:"
echo "$APP_PATH"

# Final instructions
print_section "Setup Complete!"
print_info "Your server is now configured for nilo.chat deployment."
print_info "Important next steps:"

echo "1. Make sure your domain ($DOMAIN_NAME) is pointing to this server ($SERVER_IP)"
echo "2. Add the GitHub Actions secrets shown above to your repository"
echo "3. Push to your main branch to trigger deployment"

print_info "You can monitor your application with:"
echo "  sudo -u $NEW_USER pm2 status"
echo "  sudo -u $NEW_USER pm2 logs nilo-chat"

# Final permission fix specifically for the Node.js binary EACCES error
print_section "Final Permission Fix"

# Ensure NODE_PATH is accessible and executable
print_info "Fixing Node.js binary permissions for PM2..."

# 1. Fix /usr/local/bin/node specifically (the one causing the issue)
if [ -f /usr/local/bin/node ]; then
  chmod 755 /usr/local/bin/node
  # Also ensure it's owned by root (system binary)
  chown root:root /usr/local/bin/node
  print_info "Fixed permissions for /usr/local/bin/node"
fi

# 2. Find all Node.js binaries and fix permissions
find /usr -name "node" -type f -exec chmod 755 {} \; 2>/dev/null || true
find /usr/local -name "node" -type f -exec chmod 755 {} \; 2>/dev/null || true

# 3. Check if node is a symlink and fix the target
if [ -L /usr/local/bin/node ]; then
  NODE_TARGET=$(readlink -f /usr/local/bin/node)
  chmod 755 "$NODE_TARGET"
  chown root:root "$NODE_TARGET"
  print_info "Fixed permissions for Node.js symlink target: $NODE_TARGET"
fi

# 4. As a last resort, add deploy to the same group as node binary
if [ -f /usr/local/bin/node ]; then
  NODE_GROUP=$(stat -c '%G' /usr/local/bin/node)
  usermod -aG "$NODE_GROUP" "$NEW_USER"
  print_info "Added $NEW_USER to group $NODE_GROUP for Node.js access"
fi

# 5. Special fix: give the deploy user full access to Node.js through sudoers
cat > /etc/sudoers.d/${NEW_USER}-node << EOF
$NEW_USER ALL=(ALL) NOPASSWD: /usr/bin/node, /usr/local/bin/node, /usr/bin/npm, /usr/local/bin/npm, /usr/bin/pm2, /usr/local/bin/pm2
EOF
chmod 440 /etc/sudoers.d/${NEW_USER}-node
print_info "Added sudoers entry for Node.js and PM2 access"

# 6. Verify the deployment user can execute Node
sudo -u $NEW_USER bash -c "node -v" || print_error "User $NEW_USER still cannot execute Node.js"

print_section "Server is ready for deployment!" 