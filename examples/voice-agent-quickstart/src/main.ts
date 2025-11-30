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
