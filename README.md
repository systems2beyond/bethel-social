# Bethel Metropolitan Social Platform

A comprehensive social media platform for Bethel Metropolitan Baptist Church, featuring a unified social feed, admin dashboard, and AI-powered Bible chatbot.

## Features

*   **Unified Feed**: Aggregates posts from Facebook (Webhooks), YouTube (API), and manual announcements.
*   **Admin Dashboard**: Secure interface for staff to manage content.
*   **AI Chatbot**: RAG-based assistant trained on sermons, with Google Chat handoff.
*   **Embeddable Widget**: Standalone script for external sites (Wix, etc.).

## Documentation

Detailed documentation can be found in the `docs/` directory:

*   [Walkthrough](./docs/walkthrough.md): Feature overview and usage guide.
*   [Implementation Plan](./docs/implementation_plan.md): Technical architecture and design.
*   [Task List](./docs/task.md): Development progress tracker.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Copy `.env.local.example` to `.env.local` and fill in your keys (Firebase, Facebook, Google AI).

3.  **Run Locally**:
    ```bash
    npm run dev
    ```

4.  **Deploy**:
    *   **Frontend**: Netlify (configured via `netlify.toml`).
    *   **Backend**: Firebase Functions (`firebase deploy --only functions`).
