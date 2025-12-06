# Implementation Plan - Finalize Vertex AI Reversion and Fix Smart Routing

We have successfully reverted the Genkit plugins to `vertexAI` and updated model references to `gemini-2.0-flash-001`. The `chatbot.ts` function has been updated to use dynamic model routing (`selectedModel`) instead of a hardcoded model. The Cloud Functions have been deployed.

## User Review Required

> [!IMPORTANT]
> Please verify the following:
> 1.  **Chat Functionality:** Test the chat interface in the application. Ask a simple question (e.g., "What time is service?") and a complex one (e.g., "How can I find peace?").
> 2.  **Logs:** Check the Firebase Cloud Functions logs for the `chat` function. Look for "Routing: Classified as..." and "Using model:..." to confirm that the routing logic is working and the correct model is being selected.
> 3.  **Vertex AI Usage:** Confirm that the requests are succeeding and that you are seeing usage in the Vertex AI console (if you wish to check).

## Proposed Changes

### `functions/src/ai/chatbot.ts`

-   [x] Updated `ai.generate` to use `model: selectedModel`.

### `functions/src/ai/router.ts`

-   [x] Confirmed `MODEL_FLASH` and `MODEL_PRO` are defined as `vertexai/gemini-2.0-flash-001`.
-   [ ] **[NEW]** Update routing logic: Visual queries (images) -> `MODEL_PRO`.

### Deployment

-   [x] Deployed updated Cloud Functions.

## Verification Plan

### Automated Tests
-   We ran `scripts/test-models.js` earlier to confirm `gemini-2.0-flash-001` is working.
-   We attempted to run `scripts/test-genkit-vertex.js` but encountered a module loading issue locally. The deployment to Cloud Functions is the definitive test.

### Manual Verification
-   **User Action:** Interact with the chatbot in the web app.
-   **Expected Result:** The chatbot should respond intelligently. Simple queries should be routed to Flash (logged as such), and complex queries should be routed to Pro (also mapped to Flash 2.0 currently, but the routing logic should execute).
