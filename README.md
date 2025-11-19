<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1qv0wCjGCrfYasmwsnm_QZbjAQdWOTVxF

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file (copy from `.env.local.example`) and set:
   - `GEMINI_API_KEY` - Your Gemini API key for document parsing
   - `K2_CYBER_ENV` - Environment: `test` or `prod` (defaults to `prod`)
   - `K2_CYBER_CLIENT_ID_TEST` - Your K2 Cyber API test client ID
   - `K2_CYBER_CLIENT_SECRET_TEST` - Your K2 Cyber API test client secret
   - `K2_CYBER_CLIENT_ID_PROD` - Your K2 Cyber API production client ID
   - `K2_CYBER_CLIENT_SECRET_PROD` - Your K2 Cyber API production client secret
3. Run the app:
   `npm run dev`
