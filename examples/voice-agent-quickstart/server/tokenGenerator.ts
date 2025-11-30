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
  const response = await fetch(
    'https://api.openai.com/v1/realtime/client_secrets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to generate token: ${response.statusText}`);
  }

  const data: TokenResponse = await response.json();
  return data.value;
}

// Example usage in an Express.js app
export const expressEndpointExample = `
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
