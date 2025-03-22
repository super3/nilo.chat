# nilo.chat

A self improving chat application. (test deploy again 3)

## Deployment

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

```
npm run deploy
```

This command builds the project and pushes the dist folder to the gh-pages branch.

## Local Development

To run this project locally:

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run serve
   ```
4. Open your browser to `http://localhost:8080`

## Build for Production

To build the project for production:
```
npm run build
```

## Technologies Used

- Vue.js 3
- Tailwind CSS
- GitHub Pages
- GitHub Actions