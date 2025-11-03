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
- ✅ Manifest V3 compliant
- ✅ Side panel support (Chrome 114+) with fallback overlay
- ✅ Clickable spans for language cues and inferences
- ✅ Local heuristics fallback when server is unreachable
- ✅ Configurable API endpoint
- ✅ No API keys in extension (all keys on server)

### Backend
- ✅ TypeScript with strict type checking
- ✅ Zod schema validation
- ✅ Redis caching (7 days TTL)
- ✅ Sentence-aware text chunking
- ✅ GPT-4 integration with JSON mode
- ✅ Heuristic fallback
- ✅ Rate limiting per IP
- ✅ CORS for chrome-extension:// origins

## Privacy & Security

- **No tracking**: The extension doesn't track your browsing
- **API keys on server only**: Extension never holds sensitive keys
- **Limited text**: Maximum 120,000 characters per analysis
- **Cached results**: Identical text reuses cached analysis
- **Local mode**: Analyze without sending data to server

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

### Extension Setup

1. **Load unpacked extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/` directory

2. **Configure API endpoint**:
   - Right-click the extension icon → Options
   - Set API Base URL (default: `https://api.kasra.one`)
   - Toggle "Enable cloud analysis" as needed
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

### Local Mode

If the server is unreachable or cloud analysis is disabled:
- Extension falls back to local heuristics
- Provides basic cue detection and inference patterns
- Works entirely in-browser without network requests
- Shows "Local mode (reduced detail)" indicator

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

- **API Base URL**: Backend server endpoint
- **Enable cloud analysis**: Toggle between cloud and local-only analysis

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

**Extension doesn't load**: Check that manifest.json is valid and all referenced files exist.

**Analysis fails**: 
- Check server is running (`/health` endpoint)
- Verify API Base URL in options
- Check browser console for errors
- Try local mode (disable cloud analysis)

**Server errors**:
- Ensure OPENAI_API_KEY is set
- Check Redis is running (or disable caching)
- Review server logs for details

**Slow analysis**: Large texts are chunked and may take time. Consider reducing text length or enabling caching.

## Support

For issues, questions, or contributions, please open an issue on GitHub.
