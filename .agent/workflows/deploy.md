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
# Note: FIREBASE_TOKEN is stored in .env.local — load it before running

3. Load Firebase token
// turbo
export FIREBASE_TOKEN=$(grep FIREBASE_TOKEN .env.local | cut -d '=' -f2)

4. Deploy Firestore Rules (if changed)
// turbo
npx firebase-tools deploy --only firestore:rules --token "$FIREBASE_TOKEN"

5. Deploy Storage Rules (if changed)
// turbo
npx firebase-tools deploy --only storage --token "$FIREBASE_TOKEN"

6. Deploy Firestore Indexes (if changed)
// turbo
npx firebase-tools deploy --only firestore:indexes --token "$FIREBASE_TOKEN"

7. Deploy Functions (if changed)
npx firebase-tools deploy --only functions --token "$FIREBASE_TOKEN"

# Troubleshooting
If you encounter "Missing permissions" errors, ensure you have deployed the Firestore rules (Step 4).
If Netlify deploy fails with "Page Not Found" or 404s, ensure Step 1 (build) completed and Step 2 points to `--dir=out`.
If Firebase token is expired, run `npx firebase-tools login:ci` to get a new one and update `.env.local`.
