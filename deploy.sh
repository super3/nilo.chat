#!/usr/bin/env sh

# abort on errors
set -e

# build
echo "Building application..."
npm run build

# create 404.html
echo "Creating 404.html for SPA routing..."
cp dist/index.html dist/404.html

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
echo "Adding CNAME..."
echo 'nilo.chat' > CNAME

echo "Preparing for git deployment..."
git init
git add -A
git commit -m 'Deploy to GitHub Pages'

# get the repository URL
REPO_URL=$(git config --get remote.origin.url)
echo "Repository URL: $REPO_URL"

# if you are deploying to https://<USERNAME>.github.io/<REPO>
echo "Pushing to gh-pages branch..."
if [[ $REPO_URL == *"github.com"* ]]; then
  # For GitHub repositories
  git push -f $REPO_URL master:gh-pages
else
  echo "Error: Not a GitHub repository"
  exit 1
fi

cd -

echo "Deployment complete!" 