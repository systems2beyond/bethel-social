---
description: robustly deploy to netlify by cleaning and rebuilding, handling memory issues
---

1. Clean build artifacts
// turbo
rm -rf .next out

2. Build the project locally (verification step)
npm run build

3. Deploy to Netlify Production with increased memory
// turbo
NODE_OPTIONS=--max-old-space-size=4096 npx netlify deploy --prod
