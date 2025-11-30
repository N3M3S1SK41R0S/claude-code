#!/bin/bash
#
# Voice Agent Quickstart - Monolithic Setup Script
# This script installs all necessary dependencies and sets up a voice agent project
# using the OpenAI Agents SDK with Realtime capabilities.
#
# Usage: ./setup.sh [project-name] [openai-api-key]
#
# Example: ./setup.sh my-voice-agent sk-proj-xxx
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
PROJECT_NAME="${1:-voice-agent-app}"
OPENAI_API_KEY="${2:-}"

print_step() {
    echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}Warning:${NC} $1"
}

print_error() {
    echo -e "${RED}Error:${NC} $1"
}

print_success() {
    echo -e "${GREEN}Success:${NC} $1"
}

# Check for required tools
check_dependencies() {
    print_step "Checking system dependencies..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found. Installing via nvm..."
        install_nodejs
    else
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            print_warning "Node.js version is less than 18. Installing newer version..."
            install_nodejs
        else
            print_success "Node.js $(node -v) is installed"
        fi
    fi

    # Check for npm
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install Node.js first."
        exit 1
    fi
    print_success "npm $(npm -v) is installed"
}

install_nodejs() {
    print_step "Installing Node.js..."

    # Try different methods based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt-get &> /dev/null; then
            # Debian/Ubuntu
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            # RHEL/CentOS
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo yum install -y nodejs
        elif command -v pacman &> /dev/null; then
            # Arch
            sudo pacman -S nodejs npm
        else
            # Fallback to nvm
            install_nvm
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install node@20
        else
            install_nvm
        fi
    else
        install_nvm
    fi
}

install_nvm() {
    print_step "Installing Node.js via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
}

# Create project directory
create_project() {
    print_step "Creating project: $PROJECT_NAME"

    if [ -d "$PROJECT_NAME" ]; then
        print_warning "Directory $PROJECT_NAME already exists. Removing..."
        rm -rf "$PROJECT_NAME"
    fi

    # Create project with Vite
    npm create vite@latest "$PROJECT_NAME" -- --template vanilla-ts
    cd "$PROJECT_NAME"

    print_success "Project created successfully"
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."

    # Install base dependencies
    npm install

    # Install OpenAI Agents SDK and Zod
    npm install @openai/agents zod@3

    print_success "Dependencies installed successfully"
}

# Generate ephemeral token
generate_token() {
    if [ -z "$OPENAI_API_KEY" ]; then
        print_warning "No OpenAI API key provided. Skipping token generation."
        print_warning "You will need to generate an ephemeral token manually."
        return
    fi

    print_step "Generating ephemeral client token..."

    RESPONSE=$(curl -s -X POST https://api.openai.com/v1/realtime/client_secrets \
        -H "Authorization: Bearer $OPENAI_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "session": {
                "type": "realtime",
                "model": "gpt-realtime"
            }
        }')

    EPHEMERAL_KEY=$(echo "$RESPONSE" | grep -o '"value":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$EPHEMERAL_KEY" ] && [[ "$EPHEMERAL_KEY" == ek_* ]]; then
        print_success "Ephemeral token generated: ${EPHEMERAL_KEY:0:20}..."
        echo "$EPHEMERAL_KEY" > .ephemeral_key
        export EPHEMERAL_KEY
    else
        print_warning "Failed to generate ephemeral token. Response: $RESPONSE"
        print_warning "You will need to generate one manually."
    fi
}

# Create voice agent source files
create_source_files() {
    print_step "Creating source files..."

    # Create src directory
    mkdir -p src

    # Create voiceAgent.ts
    cat > src/voiceAgent.ts << 'EOF'
import { RealtimeAgent, RealtimeSession } from '@openai/agents/realtime';
import { z } from 'zod';

// Define a simple tool for the agent
const getWeatherTool = {
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: z.object({
    location: z.string().describe('The city and state, e.g., San Francisco, CA'),
  }),
  execute: async ({ location }: { location: string }) => {
    // Mock weather response - replace with real API call
    return {
      location,
      temperature: Math.floor(Math.random() * 30) + 50,
      condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)],
    };
  },
};

// Create the voice agent
export const createVoiceAgent = () => {
  const agent = new RealtimeAgent({
    name: 'VoiceAssistant',
    instructions: `You are a helpful voice assistant. You can:
    - Answer questions about various topics
    - Help with weather information using the get_weather tool
    - Have natural conversations

    Be concise in your responses as this is a voice interface.
    Speak naturally and conversationally.`,
    tools: [getWeatherTool],
  });

  return agent;
};

// Create and manage the realtime session
export class VoiceAgentManager {
  private session: RealtimeSession | null = null;
  private agent: RealtimeAgent;
  private onStatusChange?: (status: string) => void;
  private onTranscript?: (transcript: string, isFinal: boolean) => void;

  constructor() {
    this.agent = createVoiceAgent();
  }

  setStatusCallback(callback: (status: string) => void) {
    this.onStatusChange = callback;
  }

  setTranscriptCallback(callback: (transcript: string, isFinal: boolean) => void) {
    this.onTranscript = callback;
  }

  async connect(apiKey: string): Promise<void> {
    this.updateStatus('Connecting...');

    this.session = new RealtimeSession(this.agent, {
      model: 'gpt-realtime',
    });

    // Set up event listeners
    this.session.on('conversation.item.created', (event) => {
      console.log('Conversation item created:', event);
    });

    this.session.on('response.audio_transcript.delta', (event) => {
      if (this.onTranscript && event.delta) {
        this.onTranscript(event.delta, false);
      }
    });

    this.session.on('response.audio_transcript.done', (event) => {
      if (this.onTranscript && event.transcript) {
        this.onTranscript(event.transcript, true);
      }
    });

    this.session.on('input_audio_buffer.speech_started', () => {
      this.updateStatus('Listening...');
    });

    this.session.on('input_audio_buffer.speech_stopped', () => {
      this.updateStatus('Processing...');
    });

    this.session.on('response.done', () => {
      this.updateStatus('Ready');
    });

    this.session.on('error', (error) => {
      console.error('Session error:', error);
      this.updateStatus('Error: ' + (error.message || 'Unknown error'));
    });

    try {
      await this.session.connect({ apiKey });
      this.updateStatus('Connected - Start speaking!');
    } catch (error) {
      console.error('Connection failed:', error);
      this.updateStatus('Connection failed');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
      this.updateStatus('Disconnected');
    }
  }

  isConnected(): boolean {
    return this.session !== null;
  }

  private updateStatus(status: string) {
    console.log('Status:', status);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}

// Export a singleton instance
export const voiceAgent = new VoiceAgentManager();
EOF

    # Create main.ts
    cat > src/main.ts << 'EOF'
import './style.css';
import { voiceAgent } from './voiceAgent';

// DOM Elements
const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <div class="container">
    <h1>Voice Agent Quickstart</h1>

    <div class="token-section">
      <label for="apiKey">Ephemeral API Key:</label>
      <input type="password" id="apiKey" placeholder="ek_..." />
      <p class="hint">Generate a key using: <code>curl -X POST https://api.openai.com/v1/realtime/client_secrets -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" -d '{"session": {"type": "realtime", "model": "gpt-realtime"}}'</code></p>
    </div>

    <div class="controls">
      <button id="connectBtn" class="btn-primary">Connect</button>
      <button id="disconnectBtn" class="btn-secondary" disabled>Disconnect</button>
    </div>

    <div class="status-section">
      <div class="status-indicator">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Disconnected</span>
      </div>
    </div>

    <div class="transcript-section">
      <h2>Conversation</h2>
      <div id="transcript" class="transcript"></div>
    </div>

    <div class="instructions">
      <h3>How to use:</h3>
      <ol>
        <li>Enter your ephemeral API key (starts with "ek_")</li>
        <li>Click "Connect" to start the voice session</li>
        <li>Allow microphone access when prompted</li>
        <li>Start speaking - the agent will respond!</li>
      </ol>
    </div>
  </div>
`;

// Get DOM elements
const apiKeyInput = document.querySelector<HTMLInputElement>('#apiKey')!;
const connectBtn = document.querySelector<HTMLButtonElement>('#connectBtn')!;
const disconnectBtn = document.querySelector<HTMLButtonElement>('#disconnectBtn')!;
const statusText = document.querySelector<HTMLSpanElement>('#statusText')!;
const statusDot = document.querySelector<HTMLSpanElement>('#statusDot')!;
const transcript = document.querySelector<HTMLDivElement>('#transcript')!;

// State
let currentTranscript = '';

// Status callback
voiceAgent.setStatusCallback((status: string) => {
  statusText.textContent = status;

  if (status.includes('Connected') || status === 'Ready') {
    statusDot.className = 'status-dot connected';
  } else if (status.includes('Listening')) {
    statusDot.className = 'status-dot listening';
  } else if (status.includes('Processing')) {
    statusDot.className = 'status-dot processing';
  } else if (status.includes('Error') || status === 'Disconnected') {
    statusDot.className = 'status-dot disconnected';
  }
});

// Transcript callback
voiceAgent.setTranscriptCallback((text: string, isFinal: boolean) => {
  if (isFinal) {
    transcript.innerHTML += `<p class="agent-message">${text}</p>`;
    currentTranscript = '';
    transcript.scrollTop = transcript.scrollHeight;
  } else {
    currentTranscript += text;
  }
});

// Connect handler
connectBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    alert('Please enter an ephemeral API key');
    return;
  }

  if (!apiKey.startsWith('ek_')) {
    alert('Invalid API key format. Ephemeral keys start with "ek_"');
    return;
  }

  try {
    connectBtn.disabled = true;
    await voiceAgent.connect(apiKey);
    disconnectBtn.disabled = false;
  } catch (error) {
    console.error('Failed to connect:', error);
    alert('Failed to connect. Check the console for details.');
    connectBtn.disabled = false;
  }
});

// Disconnect handler
disconnectBtn.addEventListener('click', async () => {
  try {
    await voiceAgent.disconnect();
    disconnectBtn.disabled = true;
    connectBtn.disabled = false;
  } catch (error) {
    console.error('Failed to disconnect:', error);
  }
});

// Check for saved key
const savedKey = localStorage.getItem('ephemeralKey');
if (savedKey) {
  apiKeyInput.value = savedKey;
}

// Save key on input
apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('ephemeralKey', apiKeyInput.value);
});
EOF

    # Create style.css
    cat > src/style.css << 'EOF'
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 20px;
  min-height: 100vh;
}

.container {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  font-size: 2.5em;
  line-height: 1.1;
  text-align: center;
  margin-bottom: 30px;
}

h2 {
  font-size: 1.5em;
  margin-bottom: 15px;
}

h3 {
  font-size: 1.2em;
  margin-bottom: 10px;
}

.token-section {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.token-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.token-section input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid #444;
  border-radius: 4px;
  background: #333;
  color: white;
}

.token-section input:focus {
  outline: none;
  border-color: #646cff;
}

.hint {
  font-size: 12px;
  color: #888;
  margin-top: 10px;
}

.hint code {
  background: #333;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  display: block;
  margin-top: 5px;
  overflow-x: auto;
  white-space: nowrap;
}

.controls {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 20px;
}

button {
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #646cff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #535bf2;
}

.btn-secondary {
  background: #444;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #555;
}

.status-section {
  text-align: center;
  margin-bottom: 30px;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: #1a1a1a;
  border-radius: 20px;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #666;
  transition: all 0.3s;
}

.status-dot.connected {
  background: #4caf50;
  box-shadow: 0 0 10px #4caf50;
}

.status-dot.listening {
  background: #2196f3;
  box-shadow: 0 0 10px #2196f3;
  animation: pulse 1s infinite;
}

.status-dot.processing {
  background: #ff9800;
  box-shadow: 0 0 10px #ff9800;
}

.status-dot.disconnected {
  background: #f44336;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.transcript-section {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.transcript {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 15px;
  background: #0d0d0d;
  border-radius: 4px;
}

.transcript p {
  margin: 10px 0;
  padding: 10px 15px;
  border-radius: 8px;
}

.agent-message {
  background: #1e3a5f;
  margin-left: 20px;
}

.user-message {
  background: #2d4a3e;
  margin-right: 20px;
  text-align: right;
}

.instructions {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
}

.instructions ol {
  margin: 0;
  padding-left: 20px;
}

.instructions li {
  margin: 8px 0;
}

@media (prefers-color-scheme: light) {
  :root {
    color: #213547;
    background-color: #ffffff;
  }

  .token-section,
  .transcript-section,
  .instructions,
  .status-indicator {
    background: #f5f5f5;
  }

  .token-section input {
    background: white;
    border-color: #ddd;
    color: #333;
  }

  .transcript {
    background: #eee;
  }

  .agent-message {
    background: #e3f2fd;
  }

  .user-message {
    background: #e8f5e9;
  }
}
EOF

    # Update index.html
    cat > index.html << 'EOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voice Agent Quickstart</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

    print_success "Source files created successfully"
}

# Create the server-side token generator (Node.js backend)
create_backend() {
    print_step "Creating backend token generator..."

    mkdir -p server

    cat > server/tokenGenerator.ts << 'EOF'
/**
 * Backend Token Generator
 *
 * This module generates ephemeral client tokens for the Realtime API.
 * In production, this should run on your server and be called by your frontend.
 */

interface TokenResponse {
  value: string;
  expires_at: number;
}

export async function generateEphemeralToken(apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: 'gpt-realtime',
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate token: ${response.statusText}`);
  }

  const data: TokenResponse = await response.json();
  return data.value;
}

// Express.js endpoint example
export function createTokenEndpoint() {
  return `
// Express.js example endpoint
import express from 'express';
import { generateEphemeralToken } from './tokenGenerator';

const app = express();

app.post('/api/token', async (req, res) => {
  try {
    // Use your server's API key (never expose this to the client)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const token = await generateEphemeralToken(apiKey);
    res.json({ token });
  } catch (error) {
    console.error('Token generation failed:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

app.listen(3001, () => {
  console.log('Token server running on http://localhost:3001');
});
`;
}
EOF

    cat > server/server.ts << 'EOF'
/**
 * Simple Express server for generating ephemeral tokens
 *
 * Run with: npx ts-node server/server.ts
 * Or compile and run: tsc server/server.ts && node server/server.js
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.post('/api/token', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY environment variable not set'
      });
    }

    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `OpenAI API error: ${errorText}`
      });
    }

    const data = await response.json();
    res.json({ token: data.value, expiresAt: data.expires_at });
  } catch (error) {
    console.error('Token generation failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Token server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/token - Generate ephemeral token');
  console.log('  GET /health - Health check');
});
EOF

    print_success "Backend files created successfully"
}

# Create README
create_readme() {
    print_step "Creating README..."

    cat > README.md << 'EOF'
# Voice Agent Quickstart

A quickstart project for building voice agents using the OpenAI Agents SDK with Realtime capabilities.

## Features

- Real-time voice conversations with AI
- WebRTC-based audio streaming
- Tool integration (weather example included)
- Responsive browser UI
- Backend token generation server

## Prerequisites

- Node.js 18+
- OpenAI API key with Realtime API access

## Quick Start

### Option 1: Automated Setup

```bash
chmod +x setup.sh
./setup.sh my-voice-agent
cd my-voice-agent
npm run dev
```

### Option 2: Manual Setup

1. **Create project:**
   ```bash
   npm create vite@latest my-voice-agent -- --template vanilla-ts
   cd my-voice-agent
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm install @openai/agents zod@3
   ```

3. **Generate ephemeral token:**
   ```bash
   export OPENAI_API_KEY="sk-proj-..."
   curl -X POST https://api.openai.com/v1/realtime/client_secrets \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"session": {"type": "realtime", "model": "gpt-realtime"}}'
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## Project Structure

```
my-voice-agent/
├── src/
│   ├── main.ts          # UI entry point
│   ├── voiceAgent.ts    # Voice agent logic
│   └── style.css        # Styles
├── server/
│   ├── server.ts        # Token generation server
│   └── tokenGenerator.ts # Token generation utility
├── index.html           # HTML entry point
├── package.json
└── README.md
```

## Running the Backend Token Server

For production use, run the token server to securely generate ephemeral tokens:

```bash
# Install additional dependencies
npm install express cors

# Set your API key
export OPENAI_API_KEY="sk-proj-..."

# Run the server
npx ts-node server/server.ts
```

The server will run on `http://localhost:3001`.

## Security Notes

- **Never expose your OpenAI API key** in client-side code
- Always use ephemeral tokens (`ek_...`) for browser connections
- Ephemeral tokens expire after a short period
- In production, implement proper authentication before generating tokens

## Customization

### Adding Tools

```typescript
const myTool = {
  name: 'my_tool',
  description: 'Description of what the tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
  }),
  execute: async ({ param1 }) => {
    // Tool implementation
    return { result: 'success' };
  },
};

const agent = new RealtimeAgent({
  name: 'MyAgent',
  instructions: 'Agent instructions...',
  tools: [myTool],
});
```

### Handling Audio Events

```typescript
session.on('input_audio_buffer.speech_started', () => {
  console.log('User started speaking');
});

session.on('input_audio_buffer.speech_stopped', () => {
  console.log('User stopped speaking');
});

session.on('response.audio_transcript.done', (event) => {
  console.log('Agent said:', event.transcript);
});
```

## Transport Layers

The SDK supports different transport mechanisms:

- **WebRTC** (default in browser): Low-latency, peer-to-peer audio
- **WebSocket**: Works in Node.js backend environments

The transport is automatically selected based on the environment.

## Troubleshooting

### "Permission denied" for microphone
- Ensure you're running over HTTPS or localhost
- Check browser permissions for the site

### "Invalid API key format"
- Ephemeral keys start with `ek_`
- Regular API keys (`sk-proj-...`) won't work in the browser

### Connection timeout
- Check your network connection
- Ensure the ephemeral token hasn't expired

## Resources

- [OpenAI Agents SDK Documentation](https://github.com/openai/openai-agents-js)
- [Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [WebRTC Transport](https://platform.openai.com/docs/guides/realtime-webrtc)

## License

MIT
EOF

    print_success "README created successfully"
}

# Run the development server
start_server() {
    print_step "Starting development server..."
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Voice Agent Setup Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "To start the development server:"
    echo -e "  ${BLUE}cd $PROJECT_NAME${NC}"
    echo -e "  ${BLUE}npm run dev${NC}"
    echo ""
    echo "To generate an ephemeral token:"
    echo -e "  ${BLUE}export OPENAI_API_KEY='sk-proj-...'${NC}"
    echo -e "  ${BLUE}curl -X POST https://api.openai.com/v1/realtime/client_secrets \\${NC}"
    echo -e "  ${BLUE}  -H \"Authorization: Bearer \$OPENAI_API_KEY\" \\${NC}"
    echo -e "  ${BLUE}  -H \"Content-Type: application/json\" \\${NC}"
    echo -e "  ${BLUE}  -d '{\"session\": {\"type\": \"realtime\", \"model\": \"gpt-realtime\"}}'${NC}"
    echo ""

    if [ -f ".ephemeral_key" ]; then
        echo -e "Your ephemeral key has been saved to: ${GREEN}.ephemeral_key${NC}"
        echo ""
    fi

    read -p "Would you like to start the development server now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run dev
    fi
}

# Main execution
main() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Voice Agent Quickstart Setup${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""

    check_dependencies
    create_project
    install_dependencies
    generate_token
    create_source_files
    create_backend
    create_readme
    start_server
}

# Run main function
main
