# FacelessFlow

## ⚠️ Important — read before deploying

This app's "Generate Script" and "Generate Calendar" buttons call Claude's API to write content.
That API call only works automatically inside Claude.ai's artifact preview — it does NOT work
once deployed to Vercel, because there's no API key wired in.

**To make the AI generation work on your live Vercel site, you have two options:**

### Option A (easiest): Keep using it inside Claude
Don't deploy — just reopen this app in your Claude conversation any time you want to generate
scripts. It already works there for free.

### Option B: Add your own Anthropic API key (costs money per use)
1. Get an API key at https://console.anthropic.com
2. You'll need a small backend (e.g. a Vercel serverless function) to safely call the API —
   never put your API key directly in frontend code, anyone could steal it and rack up charges.
3. Replace the `callClaude` function in `src/App.jsx` to call your own backend route instead of
   `api.anthropic.com` directly.

This is a more advanced step — let your developer (or Claude, in a fresh chat) know if you want
help building that backend route.

## Running locally
```
npm install
npm run dev
```

## Deploying to Vercel
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. Vercel auto-detects Vite, click Deploy
