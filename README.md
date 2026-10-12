# Demo Audio Studio walkthroughs

The guided tours are hosted with GitHub Pages. The standalone Ben/Maya call backend runs separately on Render.

## Choose the phone-test backend

Edit `call-backend.json` on GitHub:

```json
{ "active": "render" }
```

Use `"local"` to connect through the presenter’s configured ngrok endpoint instead. Commit the edit and wait for GitHub Pages to update; visitors should reload the tour. A connected call stays on the backend chosen when the page opened. No access code belongs in this file.

The tour permits only its declared Render and local HTTPS/WebSocket origins. If either endpoint address changes, update the tour’s declared backend address and republish its HTML. The flag itself needs no HTML rebuild.

## Render service

The root `render.yaml` describes a free Node web service with `rootDir: backend`, build `npm ci --omit=dev`, start `npm start`, and health check `/healthz`. Runtime secrets are set privately in Render: the Twilio account SID, Auth Token, voice-capable caller number, and demo PIN. `RENDER_EXTERNAL_URL` supplies the callback and WebSocket origin automatically. `PUBLIC_DEMO_ORIGIN` permits the GitHub Pages origin.

Daily and per-number call quotas are disabled for the hosted demo with `PUBLIC_DEMO_CALL_LIMITS=0`. The PIN, per-call browser tokens, signed Twilio hooks and fixed prepared recordings remain enforced. One call runs at a time and each call ends after four minutes. Incoming phone audio is discarded. The free instance can take roughly a minute to wake up after idle time.

Automatic backend deploys are off so a walkthrough-only commit does not restart an active call. Deploy backend updates manually from Render after ending any test call.
