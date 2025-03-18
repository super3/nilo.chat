# nilo.chat

A self improving chat application, built by AI agents.

## Deployment

This project is automatically deployed to GitHub Pages using GitHub Actions. The deployment process is triggered whenever changes are pushed to the `main` branch.

### Setup Instructions

1. Fork this repository
2. Go to your repository's Settings
3. Navigate to "Pages" in the sidebar
4. Under "Source", select "GitHub Actions"
5. Push changes to the `main` branch to trigger deployment

The site will be available at: `https://<your-username>.github.io/<repository-name>/`

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

To deploy to GitHub Pages manually:
```
npm run deploy
```

## Technologies Used

- Vue.js 3
- Tailwind CSS
- GitHub Pages
- GitHub Actions