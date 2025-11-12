# Argument Clarifier

A production-ready Chrome MV3 extension with Node.js backend that reorganizes reasoning on web pages without making truth judgments.

## What It Does

Argument Clarifier helps you understand the structure of arguments by identifying:

- **Main Claims**: Core assertions being made
- **Argument Structure**: Premises, warrants, and conclusions (Toulmin model)
- **Assumptions**: Unstated beliefs underlying the arguments
- **Language Cues**: Hedges ("maybe"), intensifiers ("definitely"), and ambiguous quantifiers ("many")
- **Logical Patterns**: Potential issues like correlation→causation or anecdote→generalization
- **Evidence**: Citations, URLs, DOIs, numbers, and dates
- **Questions to Consider**: Prompts for critical thinking

**Important**: This tool clarifies arguments, it does not judge their truth or validity.

## Architecture

```
bias-clarity-extension/
├── extension/           # Chrome MV3 extension
│   ├── manifest.json
│   ├── src/            # Panel UI and content scripts
│   ├── options/        # Settings page
│   └── public/icons/   # Extension icons
├── server/             # Node.js backend (TypeScript)
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── pipeline/   # Text processing
│   │   ├── llm/        # OpenAI integration
│   │   ├── cache/      # Redis caching
│   │   └── schema/     # Zod validation
│   └── package.json
└── tests/              # Test suites
```

## Features

### Extension
- ✅ **Hybrid Analysis System** - 4 analysis methods with intelligent fallback
  - 🔒 Chrome Built-in AI (local, private, free)
  - 💰 Bring Your Own Key (OpenAI API key)
  - ☁️ Cloud Service (hosted backend)
  - 🔧 Local Heuristics (always available)
- ✅ Manifest V3 compliant
- ✅ Side panel support (Chrome 114+) with fallback overlay
- ✅ Clickable spans for language cues and inferences
- ✅ Privacy-first: choose between local-only or cloud analysis
- ✅ Configurable API endpoint
- ✅ Secure API key storage (optional BYOK mode)

### Backend
- ✅ TypeScript with strict type checking
- ✅ Zod schema validation
- ✅ Redis caching (7 days TTL)
- ✅ Sentence-aware text chunking
- ✅ GPT-4 integration with JSON mode
- ✅ Heuristic fallback
- ✅ Rate limiting per IP
- ✅ CORS for chrome-extension:// origins

## Hybrid Analysis System

Argument Clarifier offers **4 analysis methods** with intelligent priority fallback:

### 1. 🔒 Chrome Built-in AI (Priority 1 - Recommended)
- **Privacy:** 100% local, no data leaves your device
- **Cost:** Completely free
- **Speed:** Fast (3-8 seconds)
- **Requirements:** Chrome 127+ with AI features enabled
- **Quality:** Good for most use cases
- **How to enable:** See [Chrome AI Setup](#chrome-ai-setup)

### 2. 💰 Bring Your Own Key - BYOK (Priority 2)
- **Privacy:** Direct connection to OpenAI, not through third parties
- **Cost:** You pay OpenAI directly (~$0.02-0.05 per article)
- **Speed:** Medium (5-15 seconds)
- **Requirements:** OpenAI API key with credits
- **Quality:** Excellent (GPT-4 Turbo)
- **How to enable:** Enter your API key in extension settings

### 3. ☁️ Cloud Service (Priority 3)
- **Privacy:** Text sent to hosted backend server
- **Cost:** Free tier available, or self-host
- **Speed:** Medium to slow (5-20 seconds)
- **Requirements:** Backend server running
- **Quality:** Excellent (GPT-4 via server)
- **How to enable:** Set API base URL in settings

### 4. 🔧 Local Heuristics (Priority 4 - Always Available)
- **Privacy:** 100% local
- **Cost:** Free
- **Speed:** Very fast (<1 second)
- **Requirements:** None
- **Quality:** Basic pattern matching
- **Automatically used:** When all other methods fail

### How Fallback Works

The extension tries each method in order until one succeeds:

```
1. Try Chrome AI → Available? ✓ Use it! → ✗ Try next
2. Try BYOK → Key valid? ✓ Use it! → ✗ Try next
3. Try Cloud → Server up? ✓ Use it! → ✗ Try next
4. Use Heuristics → Always works ✓
```

You can disable any method in settings. The extension will skip disabled methods and move to the next available option.

## Privacy & Security

- **No tracking**: The extension doesn't track your browsing
- **Choose your privacy level**:
  - Maximum privacy: Chrome AI only (100% local)
  - Balanced: BYOK (you control the API)
  - Convenience: Cloud service (hosted)
- **Secure storage**: API keys stored in Chrome's encrypted sync storage
- **Limited text**: Maximum 120,000 characters per analysis (Chrome AI: 8,000)
- **Cached results**: Cloud mode reuses cached analysis (7 days TTL)
- **Transparent**: Mode indicator shows which method was used

## Setup

### Prerequisites
- Node.js 20+
- Redis 7+ (optional, for caching)
- OpenAI API key (for cloud analysis)

### Server Setup

1. **Install dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

3. **Start Redis** (optional):
   ```bash
   docker run -d -p 6379:6379 redis:7
   # or use your existing Redis instance
   ```

4. **Run the server**:
   ```bash
   npm run dev      # Development
   npm run build    # Build for production
   npm start        # Production
   ```

   Server will start on `http://localhost:3000`

### Chrome AI Setup (Recommended)

For the best privacy and performance, enable Chrome's built-in AI:

1. **Requirements**:
   - Chrome 127 or later (check `chrome://version`)
   - Available on: Windows, Mac, Linux (ChromeOS support coming)

2. **Enable the feature**:
   ```
   1. Go to chrome://flags/#optimization-guide-on-device-model
   2. Set to "Enabled BypassPerfRequirement"
   3. Go to chrome://flags/#prompt-api-for-gemini-nano
   4. Set to "Enabled"
   5. Restart Chrome
   ```

3. **Download the AI model**:
   ```
   1. Go to chrome://components/
   2. Find "Optimization Guide On Device Model"
   3. Click "Check for update"
   4. Wait for download (200-300 MB, takes 5-10 minutes)
   5. Verify version is NOT "0.0.0.0"
   ```

4. **Verify it works**:
   ```javascript
   // Open DevTools Console and run:
   (await window.ai.languageModel.capabilities()).available
   // Should return: "readily"
   ```

5. **Configure in extension**:
   - Extension settings → Enable "Chrome Built-in AI" (enabled by default)
   - That's it! No API keys needed

### BYOK Setup (Power Users)

Use your own OpenAI API key for unlimited, high-quality analysis:

1. **Get an OpenAI API key**:
   - Go to https://platform.openai.com/api-keys
   - Create new key
   - Add credits to your account ($5-10 recommended)

2. **Configure in extension**:
   - Extension settings → Enable "Use My Own API Key"
   - Enter your API key (starts with `sk-...`)
   - Save settings

3. **Cost estimate**: ~$0.02-0.05 per article analysis

### Extension Setup

1. **Load unpacked extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` directory

2. **Configure analysis method** (in order of recommendation):
   - **Option 1 (Best):** Enable Chrome AI (see above)
   - **Option 2:** Use your own API key (see BYOK setup)
   - **Option 3:** Use hosted cloud service (requires server setup)
   - **Option 4:** Local heuristics only (automatic fallback, limited quality)

3. **Open extension options**:
   - Right-click the extension icon → Options
   - Choose which analysis methods to enable
   - Configure API keys/URLs as needed
   - Click "Save Settings"

## Usage

1. Navigate to any article or web page with text content
2. Click the Argument Clarifier extension icon
3. Click "Analyze This Page" in the side panel
4. Review the structured analysis:
   - Claims and their confidence levels
   - Argument structure (premises → warrant → conclusion)
   - Assumptions underlying the arguments
   - Language cues with clickable highlights
   - Potential logical inference issues
   - Evidence citations
   - Questions for critical reflection

### Analysis Modes

The extension shows which analysis mode is active in the top-right indicator:

- **✓ Chrome Built-in AI (private, local)** - Using Chrome's on-device AI
- **✓ Your API Key (custom)** - Using your OpenAI API key
- **✓ Cloud Analysis (GPT-4)** - Using hosted backend
- **⚠ Local Heuristics (fallback)** - Basic pattern matching

Hover over the indicator for more details about the current mode.

## API Endpoints

### `POST /analyze`

Analyzes text and returns structured clarifier data.

**Request**:
```json
{
  "url": "https://example.com/article",
  "text": "The article text content..."
}
```

**Response**:
```json
{
  "url": "https://example.com/article",
  "hash": "sha256_hash_of_text",
  "merged": {
    "claims": [...],
    "toulmin": [...],
    "assumptions": [...],
    "cues": [...],
    "inferences": [...],
    "evidence": [...],
    "consider_questions": [...]
  },
  "model": {
    "name": "gpt-4-turbo-preview",
    "mode": "LLM",
    "token_usage": { "input": 1234, "output": 567 }
  }
}
```

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Development

### Running Tests

```bash
cd server
npm test
```

### Linting

```bash
cd server
npm run lint
```

### Building Extension Package

```bash
cd extension
zip -r extension.zip . -x "*.git*"
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR:
- Installs dependencies
- Runs ESLint
- Runs test suite
- Builds TypeScript
- Creates extension.zip artifact

## Configuration

### Environment Variables (Server)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment |
| `OPENAI_API_KEY` | - | **Required** for LLM analysis |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `MAX_TEXT_LENGTH` | `120000` | Maximum text length |
| `EXTENSION_ID` | - | Chrome extension ID for CORS |

### Extension Settings

Available in extension options page (right-click icon → Options):

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Chrome Built-in AI** | Use Chrome's local AI (Privacy 1st priority) | Enabled |
| **Use My Own API Key** | BYOK mode with OpenAI key (Privacy 2nd priority) | Disabled |
| **OpenAI API Key** | Your `sk-...` key (only if BYOK enabled) | - |
| **Enable hosted cloud service** | Use backend server (Privacy 3rd priority) | Enabled |
| **API Base URL** | Backend server URL (only if cloud enabled) | `https://api.kasra.one` |

**Privacy Tip:** For maximum privacy, enable only "Chrome Built-in AI" and disable all other options.

## Limitations

- Maximum text length: 120,000 characters
- Rate limited: 100 requests per 15 minutes per IP
- Large texts are chunked (may take 10-30 seconds)
- Heuristic mode provides reduced detail
- Requires Chrome 114+ for side panel (fallback available)

## Tech Stack

- **Extension**: Vanilla JavaScript, Chrome MV3 APIs
- **Backend**: Node.js, TypeScript, Express
- **LLM**: OpenAI GPT-4 with JSON mode
- **Validation**: Zod
- **Cache**: Redis
- **Testing**: Jest, ts-jest
- **CI**: GitHub Actions

## License

Apache License 2.0 - See LICENSE file for details.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure CI passes
5. Submit a pull request

## Troubleshooting

### Chrome AI Issues

**"Chrome AI unavailable" message**

1. Verify Chrome version ≥ 127: `chrome://version`
2. Check flags are enabled:
   - `chrome://flags/#optimization-guide-on-device-model` → Enabled
   - `chrome://flags/#prompt-api-for-gemini-nano` → Enabled
3. Download the model:
   - Go to `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Click "Check for update"
   - Wait for download (can take 5-10 min)
4. Verify in console:
   ```javascript
   (await window.ai.languageModel.capabilities()).available
   // Should return: "readily"
   ```

**Chrome AI returns invalid format**

- The model is still experimental and may occasionally fail
- Extension will automatically fall back to next available method
- Check console logs for details

### BYOK Issues

**"OpenAI API error: 401"**

- Verify your API key is correct (starts with `sk-`)
- Check key status: https://platform.openai.com/api-keys
- Ensure your account has credits
- Key might have been revoked - generate a new one

**"OpenAI API error: 429"**

- You've hit OpenAI's rate limit
- Wait a few minutes and try again
- Or upgrade your OpenAI account tier

**High costs with BYOK**

- Each analysis costs ~$0.02-0.05
- Switch to Chrome AI (free) for most analyses
- Use BYOK only for important/long articles

### Cloud Service Issues

**"Server error: Failed to fetch"**

- Check server is running: `curl http://localhost:3000/health`
- Verify API Base URL in settings matches server
- Check firewall isn't blocking connection
- Try `http://localhost:3000` instead of `https://`

**"Server error: 500"**

- Check server logs for details
- Ensure `OPENAI_API_KEY` is set in server `.env`
- Verify Redis is running (or disable in code)
- Server might be out of OpenAI credits

### General Issues

**Extension doesn't load**

- Check manifest.json is valid
- Verify all files exist in extension directory
- Reload extension: `chrome://extensions/` → Reload

**Analysis fails completely**

1. Check browser console for errors (F12)
2. Verify at least one analysis method is enabled
3. Try disabling all methods except Chrome AI
4. If still fails, open an issue with console logs

**Slow analysis**

- Chrome AI: 3-8 seconds (normal)
- BYOK: 5-15 seconds (depends on OpenAI)
- Cloud: 5-20 seconds (depends on server location)
- Heuristics: <1 second

If slower than expected:
- Large texts take longer (chunked processing)
- Check your internet connection
- Server might be under load

**Empty or incomplete results**

- Page might not have enough text (need >50 characters)
- Check which mode was used (mode indicator)
- Try a different article
- Heuristics mode provides limited results (by design)

**For complete testing guide, see [TESTING.md](TESTING.md)**

## Support

For issues, questions, or contributions, please open an issue on GitHub.
