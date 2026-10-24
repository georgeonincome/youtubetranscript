# Reverse-Engineer & Clone a Web App (REA MCP + Build)

Use this when replicating a web app end-to-end: capture, analyze, then build.

## Trigger
User wants a clone of a live web app built from scratch after understanding the original.

## Workflow

### Phase 1: REA Browser Capture
1. Search for REA web tools: `tool_search(query="reverse engineer web")`
2. Load the `reverse-engineer-anything` skill: `skill_view(name='reverse-engineer-anything')`
3. Find browser: check `/snap/bin/chromium`, Edge at `/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`
4. Capture the page:
```
capture_browser_scenario(
    url="https://example.com/tool",
    browser_exe="/snap/bin/chromium",
    wait_ms=5000,
    capture_dom=True,
    capture_screenshot=True,
    capture_network=True,
)
```
5. Save the capture file path for later reference.

### Phase 2: Parse the Capture
```python
import json
with open(capture_path) as f:
    raw = f.read()
# Handle control characters with strict=False decoder
data = json.JSONDecoder(strict=False).raw_decode(raw)[0]
# Navigate: data['normalized_result']['final_capture']
```

Extract:
- **HTML**: `base64.b64decode(request_body)` from network log
- **Form structure**: `action`, `method`, `input name`
- **API endpoints**: Look for `fetch()` calls, XHR requests
- **JS chunks**: `_astro/` script URLs

### Phase 3: Analyze JS (if needed)
Download JS chunks directly with `curl`/`urllib`:
```python
import urllib.request
urllib.request.urlretrieve(js_url, local_path)
```
Search for:
- API base URL function (e.g., `Rn()` returns `https://api.example.com`)
- Transcript fetcher function (e.g., `HS()` posts to `POST /transcript`)
- Video ID extractor (e.g., regex `/([a-zA-Z0-9_-]{11})/`)
- Format: `{videoUrl, langCode}` → `{title, captions: [{text, start, dur}]}`

### Phase 4: Test the API
```bash
curl -X POST https://api.example.com/transcript \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://youtube.com/watch?v=VIDEO_ID","langCode":"en"}'
```
- If it returns 401, look for auth headers (Firebase AppCheck, API keys)
- Find alternatives: `youtube-transcript` npm package, YouTube IFrame API, oEmbed

### Phase 5: Build the Clone
1. `npx create-next-app@latest` (or init manually)
2. Project structure:
```
app/
  layout.tsx          # Root layout
  page.tsx            # Landing page (form)
  api/transcript/
    route.ts          # API endpoint
  tools/run/<slug>/
    page.tsx          # Results page
lib/utils.ts          # Video ID, timestamp, text formatting
types/global.d.ts     # Third-party API types
styles/globals.css    # Tailwind CSS
```

Key patterns from the Tactiq clone:
- Video ID regex: `/(?<=[=&/])[a-zA-Z0-9_-]{11}(?=[=&/?#\n\r]|$)/`
- Timestamp format: `new Date(seconds * 1000).toISOString().substring(11, 23)`
- YouTube IFrame API for video player
- `Suspense` wrapper for `useSearchParams()` in Next.js App Router
- `export const dynamic = 'force-dynamic'` for pages using `useSearchParams`

### Phase 6: Test
1. `npm run build` — production build must pass clean
2. `npm run start` — test in production mode
3. API test: `curl -X POST ... -d '{"videoUrl":"...","langCode":"en"}'`
4. Page test: `curl -s <url> | grep -c "expected_element"`
5. End-to-end: browser test or curl-based element verification

### Phase 7: Git + Push
```bash
# Authenticate (if needed)
gh auth login --web -s repo
# Init + commit
git init
git add -A
git commit -m "first commit"
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

## Pitfalls to Avoid
1. `json.loads()` fails on raw REA captures — use `json.JSONDecoder(strict=False).raw_decode()`
2. `export_web_scripts` may fail on re-serialized JSON — pivot to direct URL probing
3. Next.js 15 `useSearchParams()` needs `<Suspense>` boundary or `export const dynamic = 'force-dynamic'`
4. PostCSS config must use string plugin names: `['tailwindcss', 'autoprefixer']` not `require()` calls
5. CSS imports from `app/` need `../styles/` path (not `./styles/`)
6. `youtube-transcript` npm exports `fetchTranscript` (not `YouTubeTranscript.fetchTranscript`)
7. YouTube AppCheck/Firebase tokens block direct API access — use fallback packages
8. `yt-dlp` gets 429'd by YouTube — use `youtube-transcript` npm package instead
9. `gh auth login --protocol https` fails — use `-p https` / `--git-protocol https`
10. Background process exit code 0 doesn't mean success — always check status and output
