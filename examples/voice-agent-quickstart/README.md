# Voice Agent Quickstart

A complete quickstart project for building voice agents using the OpenAI Agents SDK with Realtime capabilities.

## Features

- Real-time voice conversations with AI using WebRTC
- Tool integration (weather example included)
- Responsive browser UI with status indicators
- Backend token generation server for secure API key handling
- TypeScript throughout

## Prerequisites

- Node.js 18+
- OpenAI API key with Realtime API access

## Quick Start

### Option 1: Automated Setup (Recommended)

```bash
chmod +x setup.sh
./setup.sh my-voice-agent your-openai-api-key
cd my-voice-agent
npm run dev
```

The setup script will:
1. Check and install Node.js if needed
2. Create a new Vite TypeScript project
3. Install all required dependencies
4. Generate an ephemeral API token
5. Create all source files
6. Optionally start the dev server

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

3. **Copy source files:**
   Copy the `src/`, `server/`, and config files from this quickstart to your project.

4. **Generate ephemeral token:**
   ```bash
   export OPENAI_API_KEY="sk-proj-..."
   curl -X POST https://api.openai.com/v1/realtime/client_secrets \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"session": {"type": "realtime", "model": "gpt-realtime"}}'
   ```

5. **Start development server:**
   ```bash
   npm run dev
   ```

## Project Structure

```
voice-agent-quickstart/
├── src/
│   ├── main.ts          # UI entry point
│   ├── voiceAgent.ts    # Voice agent logic with RealtimeAgent
│   └── style.css        # Responsive styles
├── server/
│   ├── server.ts        # Express token generation server
│   └── tokenGenerator.ts # Token generation utility
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── setup.sh             # Automated setup script
└── README.md            # This file
```

## Running the Backend Token Server

For production use, run the token server to securely generate ephemeral tokens:

```bash
# Install additional dependencies
npm install express cors @types/express @types/cors ts-node

# Set your API key
export OPENAI_API_KEY="sk-proj-..."

# Run the server
npx ts-node server/server.ts
```

The server will run on `http://localhost:3001` with endpoints:
- `POST /api/token` - Generate ephemeral token
- `GET /health` - Health check

## How It Works

### 1. Voice Agent Creation

The `voiceAgent.ts` file creates a `RealtimeAgent` with:
- Custom instructions for voice interactions
- Tool definitions (weather example included)
- Event handlers for speech detection and responses

```typescript
const agent = new RealtimeAgent({
  name: 'VoiceAssistant',
  instructions: 'You are a helpful voice assistant...',
  tools: [getWeatherTool],
});
```

### 2. Session Management

The `VoiceAgentManager` class handles:
- WebRTC connection to OpenAI's Realtime API
- Audio input/output through the browser
- Event handling for speech detection
- Session lifecycle (connect/disconnect)

### 3. Browser UI

The `main.ts` file provides:
- Ephemeral key input
- Connect/disconnect controls
- Real-time status indicators
- Conversation transcript display

## Security Best Practices

1. **Never expose your OpenAI API key** in client-side code
2. Always use ephemeral tokens (`ek_...`) for browser connections
3. Ephemeral tokens expire after ~1 minute
4. In production, implement proper authentication before generating tokens
5. Use HTTPS in production

## Customization

### Adding Custom Tools

```typescript
import { z } from 'zod';

const myCustomTool = {
  name: 'my_tool',
  description: 'Description of what the tool does',
  parameters: z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().describe('Optional number'),
  }),
  execute: async ({ param1, param2 }) => {
    // Tool implementation
    return { result: 'success', data: param1 };
  },
};

// Add to agent
const agent = new RealtimeAgent({
  name: 'MyAgent',
  instructions: 'Agent instructions...',
  tools: [myCustomTool],
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

session.on('conversation.item.created', (event) => {
  console.log('New conversation item:', event);
});
```

### Customizing Voice Settings

```typescript
const session = new RealtimeSession(agent, {
  model: 'gpt-realtime',
  // Additional options can be configured here
});
```

## Transport Layers

The SDK supports different transport mechanisms:

| Transport | Environment | Use Case |
|-----------|-------------|----------|
| WebRTC | Browser | Low-latency, peer-to-peer audio |
| WebSocket | Node.js | Backend voice processing |

The transport is automatically selected based on the environment.

## Troubleshooting

### "Permission denied" for microphone
- Ensure you're running over HTTPS or localhost
- Check browser permissions for the site
- Try a different browser

### "Invalid API key format"
- Ephemeral keys start with `ek_`
- Regular API keys (`sk-proj-...`) won't work in the browser
- Generate a new ephemeral token if expired

### Connection timeout
- Check your network connection
- Ensure the ephemeral token hasn't expired (valid for ~1 minute)
- Verify your OpenAI account has Realtime API access

### No audio output
- Check browser volume and audio output device
- Ensure the page has audio autoplay enabled
- Try clicking somewhere on the page first (browser autoplay policies)

## Resources

- [OpenAI Agents SDK Documentation](https://github.com/openai/openai-agents-js)
- [Realtime API Guide](https://platform.openai.com/docs/guides/realtime)
- [WebRTC Transport](https://platform.openai.com/docs/guides/realtime-webrtc)
- [Voice Agents Overview](https://openai.github.io/openai-agents-js/)

## License

MIT
