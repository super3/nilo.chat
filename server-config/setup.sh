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
echo "Enter your domain name (e.g., example.com): "
read DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
  print_error "Domain name cannot be empty!"
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

# Install Node.js
print_info "Installing Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
  print_info "Node.js $(node -v) installed"
else
  print_info "Node.js $(node -v) already installed"
fi

# Install PM2
print_info "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
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

# Create Nginx config file
cat > /etc/nginx/sites-available/nilo-chat << EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;
    
    # Logging
    access_log /var/log/nginx/nilo-chat.access.log;
    error_log /var/log/nginx/nilo-chat.error.log;

    # Reverse proxy configuration
    location / {
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
    }

    # Optional: Serve static files directly
    location /static/ {
        alias $APP_PATH/dist/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOF

# Enable site
print_info "Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/nilo-chat /etc/nginx/sites-enabled/
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
# Add any other environment variables your app needs
EOF
chown $NEW_USER:$NEW_USER $APP_PATH/.env
print_info "Environment file created"

# Generate deployment keys
print_section "Generating Deployment Keys"
print_info "Creating SSH key for GitHub Actions deployment..."

# Generate SSH key for the new user
mkdir -p /home/$NEW_USER/.ssh
SSH_KEY_FILE="/home/$NEW_USER/.ssh/github_actions_deploy"
if [ ! -f "$SSH_KEY_FILE" ]; then
  sudo -u $NEW_USER ssh-keygen -t ed25519 -f $SSH_KEY_FILE -N "" -C "github-actions-deploy"
  cat "$SSH_KEY_FILE.pub" >> /home/$NEW_USER/.ssh/authorized_keys
  chmod 600 /home/$NEW_USER/.ssh/authorized_keys
  print_info "SSH key generated"
else
  print_info "SSH key already exists"
fi

# Get IP for known_hosts
SERVER_IP=$(curl -s ifconfig.me)
KNOWN_HOSTS=$(ssh-keyscan $SERVER_IP 2>/dev/null)

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

# Setup PM2 to start on boot
print_section "Configuring PM2 Startup"
sudo -u $NEW_USER pm2 startup ubuntu -u $NEW_USER --hp /home/$NEW_USER
print_info "PM2 configured to start on boot"

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

print_section "Server is ready for deployment!" 