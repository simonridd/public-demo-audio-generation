# Demo Audio Studio walkthroughs

The guided tours are hosted with GitHub Pages. The standalone Ben/Maya call backend runs separately on Render.

## Repeat a walkthrough publication

Build the reviewed private `demo-resources` source with `npm ci`, `npm run validate`,
`npm test`, `npm run build`, `npm run walkthrough:export`, and `npm run walkthrough:test`.
For this release, include the private DSS1-PUBLISH acceptance patch, which adds retained
evidence to the outcome scene and fixes browser history and Escape handling. That patch
and its regression checks are retained with the private publication evidence.
Then, from this public checkout, run:

```sh
python3 scripts/merge-walkthrough-export.py /path/to/demo-resources/.cache/github-pages
```

The source export contains three tutorials: Cedar Home, single-turn audio and persona creation.
The merge copies only those generated HTML files and `.nojekyll`, adds the existing Twilio
card to the regenerated homepage and keeps its total at four. It fails if that retained
card or tour is missing or the source catalog structure changes. Repeating it is idempotent.
Do not replace the entire homepage with the three-card export or use a deleting directory sync.
Keep the call tour, backend, `render.yaml` and `call-backend.json` in place.

Review generated diffs, scan credentials, and test desktop/tablet/mobile opening, workflow
and outcome scenes plus all four public routes before committing to `main`.
A walkthrough publication does not authorize a backend deployment, configuration change,
phone call or paid voice generation.

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
