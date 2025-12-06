# Task: Finalize Vertex AI Reversion and Fix Smart Routing

## Objective
Complete the migration back to Vertex AI by ensuring the chatbot uses dynamic model routing instead of hardcoded models, and verify the deployment.

## Context
We have reverted the Genkit plugins to `vertexAI` and updated model references to `gemini-2.0-flash-001`. However, the `chatbot.ts` function currently hardcodes the model, ignoring the `routeQuery` logic. We need to fix this to respect the user's requirement for cost/complexity optimization via routing.

## Steps

1.  **Modify `functions/src/ai/chatbot.ts`**
    *   Change `ai.generate` to use `model: selectedModel` instead of `model: 'vertexai/gemini-2.0-flash-001'`.
    *   Ensure `selectedModel` is correctly populated from `routeQuery`.

2.  **Review `functions/src/ai/router.ts`**
    *   Confirm `MODEL_FLASH` and `MODEL_PRO` are defined.
    *   *Note:* Currently both are set to `gemini-2.0-flash-001` as it is the confirmed working model. We will keep this for stability but the architecture will support splitting them later.

3.  **Deploy Cloud Functions**
    *   Run `npm run build && firebase deploy --only functions`.

4.  **Verification**
    *   Test the chat interface to confirm it responds without errors.
    *   Verify in logs that "Using model: ..." reflects the routing decision.

## Status
- [ ] Fix `chatbot.ts` model usage
- [ ] Deploy functions
- [ ] Verify chat functionality
