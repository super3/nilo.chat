# Nilo.chat Server Setup

This directory contains a script for easily setting up a Digital Ocean VPS for nilo.chat deployment.

## Quick Start

1. Create a new Digital Ocean Droplet (Ubuntu 22.04 recommended)
2. SSH into your new server as root
3. Run the following commands:

```bash
# Download the setup script
curl -o setup.sh https://raw.githubusercontent.com/yourusername/nilo.chat/main/server-config/setup.sh

# Make it executable
chmod +x setup.sh

# Run the script
./setup.sh
```

## What the Setup Script Does

1. Updates the system
2. Installs Node.js, PM2, and Nginx
3. Creates a new sudo user
4. Configures firewall (UFW)
5. Sets up the application directory
6. Configures Nginx with WebSocket support
7. Sets up SSL with Certbot
8. Creates environment file
9. Generates deployment keys for GitHub Actions
10. Configures PM2 to start on boot

## After Running the Script

The script will display all the GitHub Actions secrets you need to add to your repository:

- `SSH_PRIVATE_KEY`
- `SSH_KNOWN_HOSTS`
- `SSH_USER`
- `SSH_HOST`
- `SSH_PATH`

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions).

## Troubleshooting

If you encounter any issues during deployment:

1. Check Nginx logs:
   ```bash
   sudo tail -f /var/log/nginx/nilo-chat.error.log
   ```

2. Check application logs:
   ```bash
   sudo -u <username> pm2 logs nilo-chat
   ```

3. Verify Nginx configuration:
   ```bash
   sudo nginx -t
   ``` 