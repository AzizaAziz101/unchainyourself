export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!apiKey) return res.status(500).json({ error: 'AWS_BEARER_TOKEN_BEDROCK not configured' });

  const { messages, system, maxTokens } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const region = process.env.AWS_REGION || 'eu-central-1';
  const allMessages = system
    ? [{ role: 'system', content: system }, ...messages]
    : messages;

  const bedrockRes = await fetch(
    `https://bedrock-runtime.${region}.amazonaws.com/openai/v1/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'eu.anthropic.claude-sonnet-4-5-20250929-v1:0',
        max_tokens: maxTokens || 2048,
        stream: true,
        messages: allMessages,
      }),
    }
  );

  if (!bedrockRes.ok) {
    const err = await bedrockRes.text();
    return res.status(bedrockRes.status).json({ error: err });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = bedrockRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}
