# Nilo.chat Deployment Guide

This guide covers deployment for both the frontend (static site) and backend (API server).

## Frontend Deployment (GitHub Pages)

The frontend is automatically deployed to GitHub Pages using GitHub Actions.

### GitHub Pages Setup

1. Fork this repository
2. Go to your repository's Settings
3. Navigate to "Pages" in the sidebar
4. Under "Source", select "Deploy from a branch"
5. Select the branch "gh-pages" and folder "/ (root)"
6. Click "Save"

The site will be available at: `https://<your-username>.github.io/nilo.chat/`

### Automatic Deployment

This repository includes a GitHub Actions workflow that automatically builds and deploys the frontend whenever you push to the main branch. The workflow is located at `.github/workflows/deploy-front.yml`.

### Manual Deployment

If you prefer to deploy manually:

```bash
npm run deploy
```

This command builds the project and pushes the dist folder to the gh-pages branch.

---

## Backend API Deployment (Railway)

The backend API is deployed to [Railway](https://railway.app), a modern platform-as-a-service that simplifies deployment.

### Quick Start

1. **Create a Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with your GitHub account

2. **Create a New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `nilo.chat` repository
   - Railway will automatically detect it's a Node.js project

3. **Configure Environment Variables**

   Add these environment variables in the Railway dashboard:

   ```
   NODE_ENV=production
   PORT=3000
   ```

   Note: Railway automatically provides a `PORT` environment variable, but we set it explicitly for consistency.

4. **Deploy**
   - Railway will automatically build and deploy your application
   - You'll get a public URL like: `https://your-app.railway.app`
   - Every push to your main branch will trigger an automatic deployment

### Environment Variables

Required environment variables for Railway:

| Variable | Value | Description |
|----------|-------|-------------|
| `NODE_ENV` | `production` | Sets the app to production mode |
| `PORT` | `3000` | Port the server listens on (Railway manages this automatically) |

### Custom Domain (Optional)

To use a custom domain like `api.nilo.chat`:

1. Go to your Railway project settings
2. Click on "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter your domain (e.g., `api.nilo.chat`)
5. Add the CNAME record to your DNS provider as shown by Railway
6. Update your frontend's `.env.production` file:
   ```
   VUE_APP_SOCKET_URL=https://api.nilo.chat
   ```

### Monitoring and Logs

Railway provides built-in monitoring and logging:

- **View Logs**: Click on "Deployments" → Select your deployment → View logs in real-time
- **Metrics**: Railway shows CPU, Memory, and Network usage automatically
- **Deployment History**: View all past deployments and rollback if needed

### Manual Deployment Trigger

If you need to manually trigger a deployment:

1. Go to your Railway project
2. Click "Deployments"
3. Click "Deploy" → "Deploy from main"

### Troubleshooting

**Build Fails:**
- Check the build logs in Railway dashboard
- Ensure all dependencies are in `package.json`
- Verify the start script is correctly defined

**Application Crashes:**
- Check the application logs in Railway
- Verify all required environment variables are set
- Ensure the PORT environment variable is being used correctly

**Connection Issues:**
- Verify the frontend is using the correct Railway URL
- Check CORS settings if you have custom CORS configuration
- Ensure Socket.IO connection URLs are correct

### Railway CLI (Optional)

For advanced users, you can use the Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Link to your project
railway link

# View logs
railway logs

# Run commands in Railway environment
railway run npm start
```

### Cost

Railway offers:
- **Free Tier**: $5 of usage per month (sufficient for small projects)
- **Developer Plan**: $20/month for more resources
- Automatic scaling based on usage

For most chat applications with moderate traffic, the free tier should be sufficient to get started.

---

## Architecture

- **Frontend**: Vue.js SPA hosted on GitHub Pages
- **Backend**: Node.js/Express with Socket.IO hosted on Railway
- **Communication**: WebSocket connections via Socket.IO for real-time chat

---

## Complete Deployment Checklist

- [ ] Fork and clone the repository
- [ ] Set up GitHub Pages (automatic via Actions)
- [ ] Create Railway account
- [ ] Deploy backend to Railway
- [ ] Configure environment variables on Railway
- [ ] Update frontend `.env.production` with Railway URL
- [ ] Push to main branch to trigger deployments
- [ ] Test the application end-to-end
- [ ] (Optional) Set up custom domain on Railway
- [ ] (Optional) Set up custom domain on GitHub Pages

---

## Need Help?

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Pages Docs: https://docs.github.com/pages
