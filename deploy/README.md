# Nilo.chat Server Configurations and Deployment

This directory contains server configuration and deployment instructions for nilo.chat.

## GitHub Pages Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. The deployment process is triggered whenever changes are pushed to the `main` branch. 

### GitHub Pages Setup

1. Fork this repository
2. Go to your repository's Settings
3. Navigate to "Pages" in the sidebar
4. Under "Source", select "Deploy from a branch"
5. Select the branch "gh-pages" and folder "/ (root)"
6. Click "Save"

The site will be available at: `https://<your-username>.github.io/nilo.chat/`

### Automatic Deployment

This repository includes a GitHub Actions workflow that automatically builds and deploys the app whenever you push to the main branch. To use it:

1. Ensure GitHub Actions is enabled in your repository settings
2. Make changes to your code and push to the main branch
3. GitHub Actions will automatically build and deploy to the gh-pages branch
4. You can view the deployment progress in the "Actions" tab of your repository

### Manual Deployment

If you prefer to deploy manually:

```bash
npm run deploy
```

This command builds the project and pushes the dist folder to the gh-pages branch.

## VPS Server Setup

This directory contains a script for easily setting up a VPS for nilo.chat deployment. We currently use Digital Ocean, but any VPS provider should work just fine.  

## Quick Start

1. Create a new VPS (Ubuntu 22.04 recommended)
2. SSH into your new server as root
3. Run the following commands:

```bash
# Download the setup script
curl -o setup.sh https://raw.githubusercontent.com/yourusername/nilo.chat/main/deploy/setup.sh

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