---
description: Manual deployment workflow for Netlify Frontend and Firebase Backend
---

# Deploy Frontend (Netlify)

1. Build the project
// turbo
npm run build

2. Deploy to Netlify Production
npx netlify deploy --prod --dir=out

# Deploy Backend (Firebase)

3. Deploy Firestore Rules (if changed)
firebase deploy --only firestore:rules

4. Deploy Functions (if changed)
firebase deploy --only functions

# Troubleshooting
If you encounter "Missing permissions" errors, ensure you have deployed the Firestore rules (Step 3).
If Netlify deploy fails with "Page Not Found" or 404s, ensure Step 1 (build) completed and Step 2 points to `--dir=out`.
