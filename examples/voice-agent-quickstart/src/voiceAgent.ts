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
      condition: ['sunny', 'cloudy', 'rainy', 'partly cloudy'][
        Math.floor(Math.random() * 4)
      ],
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

  setTranscriptCallback(
    callback: (transcript: string, isFinal: boolean) => void
  ) {
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
