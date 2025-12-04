# Implementation Plan - Bethel Metropolitan Baptist Church Social Platform

## Goal
Create a custom social media-style web platform for Bethel Metropolitan Baptist Church. The platform will serve as a hub for the church community, featuring a unified social feed (Facebook, YouTube, manual posts), a sermon archive, and an AI chatbot trained on church content for bible study interactions.

## User Review Required
> [!IMPORTANT]
> **Facebook Integration Strategy**: "Scraping" Facebook is unreliable and often blocked. The plan proposes using the **Facebook Graph API** via a registered Meta App. The user will need to provide App Credentials (App ID, App Secret) and a Page Access Token.
>
> **AI Cost & Setup**: The AI chatbot will use **Firebase Genkit** and **Gemini**. This requires a billing-enabled Google Cloud project (though the free tier might suffice for low volume).
>
> **Hosting**: The user requested Netlify. We will configure the Next.js build for Netlify, but Firebase Functions (for API polling and AI) require the Firebase Blaze plan (pay-as-you-go).

## Proposed Architecture

### Tech Stack
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, Framer Motion (for "Instagram-like" animations).
- **Backend**: Firebase (Authentication, Firestore, Storage, Cloud Functions).
- **AI**: Firebase Genkit, Google Gemini, Firestore Vector Search.
- **Hosting**: Netlify (Frontend), Firebase (Backend/Functions).

### Data Model (Firestore)
- `posts`: Collection for all feed items.
    - `type`: 'manual', 'facebook', 'youtube'
    - `content`: Text body.
    - `mediaUrl`: Image/Video links.
    - `sourceId`: Original ID from FB/YT.
    - `timestamp`: Date posted.
    - `pinned`: Boolean.
- `sermons`: Collection for full sermon metadata (can be synced from YouTube).
- `users`: User profiles (admins vs. regular members).

## Proposed Changes

### 1. Project Initialization
#### [NEW] [bethel-social](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social)
- Initialize Next.js app with Tailwind CSS.
- Setup `firebase.json` and `netlify.toml`.

### 2. Backend & Integrations (Firebase Functions)
#### [MODIFY] [functions/src/social/facebook.ts](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/functions/src/social/facebook.ts)
- **[NEW] Webhook Endpoint**: `facebookWebhook` function to receive real-time updates.
    - Handles `GET` verification challenge from Facebook.
    - Handles `POST` change notifications (new posts).
- **[KEEP] Sync Function**: Retain `syncFacebookPosts` as a manual backfill/maintenance tool.

#### [NEW] [functions/src/social/youtube.ts](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/functions/src/social/youtube.ts)
- Scheduled function to check for new videos or active live streams.

#### [NEW] [functions/src/ai/chatbot.ts](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/functions/src/ai/chatbot.ts)
- Genkit flow for RAG.
- `ingestSermon`: Function to chunk and embed text.
- `chat`: Function to retrieve context and generate response.
- **[NEW] Google Chat Handoff**: Logic to detect "human needed" intent and trigger a Google Chat webhook/message to staff.

#### [NEW] [public/widget.js](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/public/widget.js)
- **[NEW] Embeddable Script**: Standalone JavaScript bundle to render the chat widget on external sites (Wix, etc.).
- Uses an iframe or Web Components to avoid style conflicts.

### 3. Frontend Development
#### [NEW] [components/Feed/SocialFeed.tsx](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/components/Feed/SocialFeed.tsx)
- Infinite scroll feed component.
- Renders `PostCard` components based on post type.

#### [NEW] [components/Chat/BibleBot.tsx](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/components/Chat/BibleBot.tsx)
- Floating chat widget or dedicated page.
- "Bible Study" mode UI.
- **[NEW] Handoff UI**: Visual indicator when chat is being routed to staff.

#### [NEW] [app/admin/page.tsx](file:///Users/ryansyffus_home/.gemini/antigravity/scratch/church_social_platform/bethel-social/app/admin/page.tsx)
- Dashboard for creating manual posts and pinning items.

## Verification Plan

### Automated Tests
- **Unit Tests**: Test data normalization functions (FB/YT -> Firestore format).
- **Integration Tests**: Emulate Firebase Functions locally to verify Firestore writes.

### Manual Verification
1.  **Social Feed**:
    - Run the Facebook poller (mocked response) and verify posts appear in the feed.
    - Create a manual post with an image and verify it appears at the top.
2.  **AI Chatbot**:
    - Ingest a sample sermon text.
    - Ask a question specific to that sermon and verify the bot references it.
3.  **Deployment**:
    - Build locally (`npm run build`) to ensure Netlify compatibility.
