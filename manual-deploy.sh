#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# create 404.html for SPA routing
cp dist/index.html dist/404.html

# navigate into the build output directory
cd dist

# add CNAME file
echo 'nilo.chat' > CNAME

# initialize git and commit
git init
git checkout -b main
git add -A
git commit -m 'Deploy to GitHub Pages'

# Get the repository name from remote URL
REPO_URL=$(git config --get remote.origin.url)
echo "Detected repository URL: $REPO_URL"

# Extract username and repo name
USERNAME=$(echo $REPO_URL | sed -e 's/https:\/\/github.com\///g' -e 's/git@github.com://g' -e 's/\.git//g' | cut -d '/' -f 1)
REPO=$(echo $REPO_URL | sed -e 's/https:\/\/github.com\///g' -e 's/git@github.com://g' -e 's/\.git//g' | cut -d '/' -f 2)

echo "Pushing to gh-pages branch on $USERNAME/$REPO"
git push -f "https://github.com/$USERNAME/$REPO.git" main:gh-pages

cd -
echo "Manual deployment complete!" 