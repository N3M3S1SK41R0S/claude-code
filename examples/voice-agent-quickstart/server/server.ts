/**
 * Simple Express server for generating ephemeral tokens
 *
 * Run with: npx ts-node server/server.ts
 * Or compile and run: tsc server/server.ts && node server/server.js
 */

import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

interface TokenResponse {
  value: string;
  expires_at: number;
}

app.post('/api/token', async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY environment variable not set',
      });
    }

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
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `OpenAI API error: ${errorText}`,
      });
    }

    const data = (await response.json()) as TokenResponse;
    res.json({ token: data.value, expiresAt: data.expires_at });
  } catch (error) {
    console.error('Token generation failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Token server running on http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log('  POST /api/token - Generate ephemeral token');
  console.log('  GET /health - Health check');
});
