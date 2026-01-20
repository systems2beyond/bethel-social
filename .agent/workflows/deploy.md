---
description: Manual deployment workflow for Netlify Frontend and Firebase Backend
---

# Deploy Frontend (Netlify)

**PRE-DEPLOY SAFETY CHECK:**
1. **Verify Site:** Run `npx netlify status` to confirm Site ID: `65340481-649f-47b5-ab6f-239a37c3f3b9`.
2. **Link if needed:** `npx netlify link --id 65340481-649f-47b5-ab6f-239a37c3f3b9`
3. **Local Build:** Run `npm run build` to check for errors.

1. Build and Deploy to Netlify Production
npx netlify deploy --prod --build


# Deploy Backend (Firebase)

3. Deploy Firestore Rules (if changed)
firebase deploy --only firestore:rules

4. Deploy Functions (if changed)
firebase deploy --only functions

# Troubleshooting
If you encounter "Missing permissions" errors, ensure you have deployed the Firestore rules (Step 3).
If Netlify deploy fails with "Page Not Found" or 404s, ensure Step 1 (build) completed and Step 2 points to `--dir=out`.
