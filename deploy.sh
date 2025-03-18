#!/usr/bin/env sh

# abort on errors
set -e

# build
echo "Building application..."
npm run build

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
echo 'nilo.chat' > CNAME

echo "Preparing for git deployment..."
git init
git add -A
git commit -m 'Deploy to GitHub Pages'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:$(git config --get remote.origin.url | cut -d: -f2 | cut -d. -f1) master:gh-pages

cd -

echo "Deployment complete!" 