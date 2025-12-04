# Bethel Metropolitan Social Platform - Walkthrough

This document outlines the features and components built for the Bethel Metropolitan Baptist Church social platform.

## 1. Unified Social Feed
The core of the platform is an "Instagram-style" feed that aggregates content from multiple sources.

-   **Location**: `/` (Home Page)
-   **Features**:
    -   **Facebook Integration**: Auto-syncs posts from the church's Facebook page (via Webhooks for real-time updates).
    -   **YouTube Integration**: Auto-syncs latest videos and live streams from the church's channel.
    -   **Manual Posts**: Staff can create custom announcements.
    -   **Pinned Posts**: Important announcements stay at the top.
    -   **Interactions**: Users can "Like" posts (local state for demo).

![Social Feed](https://placehold.co/600x400/png?text=Social+Feed+Preview)

## 2. Admin Dashboard
A dedicated interface for church staff to manage content.

-   **Location**: `/admin`
-   **Features**:
    -   Create text-based posts.
    -   (Future) Upload images/videos directly.
    -   (Future) Pin/Unpin posts.

## 3. AI Bible Chatbot
An intelligent assistant trained on church sermons and the Bible.

-   **Location**: Floating widget on all pages.
-   **Features**:
    -   **RAG Pipeline**: Uses Firebase Genkit + Firestore Vector Search to retrieve relevant sermon excerpts.
    -   **Google Chat Handoff**: Detects when a user wants to speak to a human (e.g., "talk to pastor") and triggers a handoff flow.
    -   **Contextual Answers**: Answers questions using specific sermon context.

## 4. Embeddable Widget
A standalone widget that can be added to external websites (like Wix).

-   **Script**: `public/widget.js`
-   **Usage**:
    Add the following code to your external site's `<body>`:
    ```html
    <script src="https://bethel-metro-social.web.app/widget.js"></script>
    ```
-   **How it works**:
    -   Injects a fixed "Chat" button.
    -   Opens an iframe pointing to `/chat-embed`.
    -   Communicates via `postMessage` to resize the iframe when opened/closed.

## 5. Setup & Deployment

### Prerequisites
-   Node.js 18+
-   Firebase CLI (`npm install -g firebase-tools`)
-   Google Cloud Project with Billing Enabled (for Genkit/Gemini)

### Environment Variables
Create a `.env.local` file with the following:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bethel-metro-social
# ... other Firebase config
FB_PAGE_ID=...
FB_ACCESS_TOKEN=...
FB_VERIFY_TOKEN=...
FB_APP_SECRET=...
YOUTUBE_CHANNEL_ID=...
GOOGLE_AI_API_KEY=...
```

### Running Locally
```bash
npm run dev
```

### Deploying
**Frontend (Netlify)**:
Connect the repository to Netlify and set the build command to `npm run build`.

**Backend (Firebase)**:
```bash
firebase deploy --only functions,firestore
```

## Next Steps
1.  **YouTube Integration**: Implement the `syncYoutubePosts` function.
2.  **Real Auth**: Secure the `/admin` route with Firebase Auth.
3.  **Production Keys**: Obtain permanent Facebook Graph API tokens and Google AI keys.
