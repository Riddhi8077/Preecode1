const openrouterApiKey = String(process.env.OPENROUTER_API_KEY || '').trim();

if (!openrouterApiKey) {
  console.warn('[ai] OPENROUTER_API_KEY is missing. AI endpoints will return configuration errors until the key is set.');
}

async function generateResponse(messages, options = {}) {
  if (!openrouterApiKey) {
    const err = new Error('AI is not configured. Set OPENROUTER_API_KEY in backend environment variables.');
    err.statusCode = 503;
    throw err;
  }

  try {
    console.log('Using OpenRouter API');

    const requestBody = {
      model: 'openai/gpt-4o-mini',
      messages: messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2048,
    };

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('No response from OpenRouter API');
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error('Empty response from OpenRouter API');
    }

    return content;
  } catch (error) {
    console.error('OpenRouter API Error:', error);
    throw new Error(`AI service error: ${error.message}`);
  }
}

async function chat(message, context, history = []) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant') && typeof entry.text === 'string')
        .slice(-12)
        .map((entry) => ({ role: entry.role, content: entry.text.trim().slice(0, 2000) }))
    : [];

  const systemPrompt = [
    'You are Preecode AI, a helpful coding assistant.',
    'Answer the user question directly and specifically.',
    'If the user asks for output, compute it step by step from the provided code/context.',
    'Use concise, practical language.',
    'If context is missing, ask one short clarifying question instead of guessing.'
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(context ? [{ role: 'system', content: `Editor context:\n${context}` }] : []),
    ...safeHistory,
    { role: 'user', content: message }
  ];

  return generateResponse(messages, { temperature: 0.5 });
}

async function getHint(problemDescription, language) {
  const prompt = `Given this programming problem, provide a helpful hint that guides the student toward the solution without giving away the answer.

Problem: ${problemDescription}
Language: ${language || 'any'}

Provide:
1. A conceptual hint about the approach
2. The key data structure or algorithm to consider
3. A small nudge about the first step

Do NOT provide the full solution.`;
  return generateResponse([{ role: 'user', content: prompt }], { temperature: 0.6 });
}

async function reviewCode(code, language, problemDescription) {
  const prompt = `You are a code reviewer. Analyze this ${language || 'code'} and provide a concise review.

${problemDescription ? 'Problem: ' + problemDescription : ''}

Code:
${code}

Respond in this format:

Correctness:
<2 sentences max>

Edge Cases:
<2 sentences max>

Time Complexity:
<1-2 sentences>

Code Quality:
<2 sentences max>

Suggestions:
<2-3 bullet points for improvement, or "No improvements needed">

Final Verdict:
<Correct / Partially Correct / Needs Improvement>`;
  return generateResponse([{ role: 'user', content: prompt }], { temperature: 0.4 });
}

async function generateQuestion(language, difficulty) {
  const safeLanguage = String(language || 'python').trim().toLowerCase() || 'python';
  const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();

  let languageInstruction = '';
  if (safeLanguage === 'javascript') {
    languageInstruction = 'Use pure JavaScript only. No TypeScript annotations.';
  } else if (safeLanguage === 'typescript') {
    languageInstruction = 'Use TypeScript with proper types.';
  } else if (safeLanguage === 'python') {
    languageInstruction = 'Use Python only. No JavaScript syntax.';
  }

  const prompt = `Create one ${safeDifficulty} coding practice question for ${safeLanguage}.
${languageInstruction}

Rules:
- [QUESTION]: 2-3 sentences maximum. State what the function should do. No "Input:", "Output:", "Constraints:", "Examples:" sections. Just a plain description.
- [HINT]: One sentence only. A non-spoiler nudge toward the approach.
- [SOLUTION]: Working ${safeLanguage} code. No markdown fences. Must include a function and a single print/console.log call showing a result.

Return ONLY this, no other text:

[QUESTION]
<2-3 sentence problem description>

[HINT]
<one sentence hint>

[SOLUTION]
<runnable code>`;

  const messages = [{ role: 'user', content: prompt }];
  const raw = await generateResponse(messages, { temperature: 0.8, maxTokens: 700 });

  return raw
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();
}

module.exports = { generateResponse, chat, getHint, reviewCode, generateQuestion };
