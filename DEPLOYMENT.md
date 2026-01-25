# Deployment Guide: Bethel Social (Multi-Church)

## Overview
This update introduces a **Multi-Church Tenant Architecture**.
- **Data Isolation**: All data is partitioned by `churchId`.
- **Dynamic Resolution**: The app automatically detects the church based on the **Subdomain** (e.g. `bethel.myapp.com`).
- **Security**: Firestore Rules enforce strict data isolation.

## 1. Prerequisites
Ensure you have the Firebase CLI installed and logged in.
```bash
npm install -g firebase-tools
firebase login
```

## 2. Deploy Firestore Rules & Indexes
This is critical to secure the database before updating the app.
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

## 3. **SAFE APPLICATION DEPLOYMENT (SOP)**
Use this procedure to ensure a clean, reliable build.

### A. Clean Build Artifacts
```bash
rm -rf .next out
```

### B. Verify Build Locally
```bash
npm run build
```
*(Ensure this passes with no errors before proceeding)*

### C. Deploy to Netlify
We send the production build to Netlify with increased memory allocation to prevent OOM errors.
```bash
NODE_OPTIONS=--max-old-space-size=4096 npx netlify deploy --prod
```

## 4. Configure Tenants (Churches)
Use the **Super Admin Onboarding Form** at `/super-admin/onboard` to create new churches.
This will:
1. Create the Church Config (`churches/{id}`).
2. Set up Integration Keys (Facebook/YouTube).
3. Invite the initial Admin.

## 5. Migration (Legacy Data Only)
If you have legacy data, run the backfill script:
```bash
npx tsx scripts/migrate_church_id.ts
```
