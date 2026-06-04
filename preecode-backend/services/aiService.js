// Preecode AI Service - OpenRouter API Integration
// Using single reliable model configuration
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Single model configuration - nvidia/nemotron-3-super-120b-a12b:free
// No fallback models to ensure consistent behavior
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',  // NVIDIA Nemotron - reliable free model
];

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [800, 2000, 4000];
const REQUEST_TIMEOUT_MS = 45000;  // 45s — free models can be slow
const MIN_REQUEST_SPACING_MS = 200;

let lastRequestAtMs = 0;

// API Key rotation to handle free tier daily limits
let currentKeyIndex = 0;

function getOpenRouterApiKeys() {
  // Support multiple API keys separated by commas
  const keysString = String(process.env.OPENROUTER_API_KEY || '').trim();
  if (!keysString) return [];
  
  return keysString.split(',').map(k => k.trim()).filter(k => k.length > 0);
}

function getOpenRouterApiKey() {
  const keys = getOpenRouterApiKeys();
  if (keys.length === 0) return '';
  
  // Rotate through available keys
  const key = keys[currentKeyIndex % keys.length];
  return key;
}

function rotateToNextApiKey() {
  const keys = getOpenRouterApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`[ai] Rotated to API key ${currentKeyIndex + 1} of ${keys.length}`);
  }
}

const openrouterApiKeys = getOpenRouterApiKeys();

if (openrouterApiKeys.length === 0) {
  console.warn('[ai] OPENROUTER_API_KEY is missing. AI endpoints will return configuration errors until the key is set.');
} else {
  console.log(`[ai] Loaded ${openrouterApiKeys.length} OpenRouter API key(s) for rotation`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyRateLimitDelay() {
  // Small spacing reduces accidental bursts that can trigger provider rate limits.
  const now = Date.now();
  const elapsed = now - lastRequestAtMs;
  if (elapsed < MIN_REQUEST_SPACING_MS) {
    await sleep(MIN_REQUEST_SPACING_MS - elapsed);
  }
  lastRequestAtMs = Date.now();
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    const err = new Error('Invalid OpenRouter payload: messages must be a non-empty array.');
    err.statusCode = 400;
    err.code = 'INVALID_OPENROUTER_PAYLOAD';
    throw err;
  }

  for (const message of messages) {
    const isValidRole = message && typeof message.role === 'string' && message.role.trim().length > 0;
    const isValidContent = message && typeof message.content === 'string' && message.content.trim().length > 0;
    if (!isValidRole || !isValidContent) {
      const err = new Error('Invalid OpenRouter payload: each message must include role and content.');
      err.statusCode = 400;
      err.code = 'INVALID_OPENROUTER_PAYLOAD';
      throw err;
    }
  }
}

function validateModel(model) {
  if (typeof model !== 'string' || model.trim().length === 0) {
    const err = new Error('Invalid OpenRouter payload: model must be a non-empty string.');
    err.statusCode = 400;
    err.code = 'INVALID_OPENROUTER_PAYLOAD';
    throw err;
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Use dynamic import for node-fetch v3 (ESM)
    const { default: fetch } = await import('node-fetch');
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildStructuredError(base) {
  const err = new Error(base.message);
  err.name = 'OpenRouterError';
  err.statusCode = base.statusCode || 502;
  err.code = base.code || 'OPENROUTER_REQUEST_FAILED';
  err.details = {
    model: base.model,
    attempt: base.attempt,
    providerStatus: base.providerStatus,
    retryable: Boolean(base.retryable),
    responseBody: base.responseBody,
    cause: base.cause,
  };
  return err;
}

function parseJsonSafely(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function call_openrouter(messages, options = {}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    const err = new Error('AI is not configured. Set OPENROUTER_API_KEY in backend environment variables.');
    err.statusCode = 503;
    err.code = 'OPENROUTER_API_KEY_MISSING';
    throw err;
  }

  validateMessages(messages);

  const requestConfig = {
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 512, // Reduced to 512 for better compatibility
  };

  const errors = [];

  // Try each model with exponential retries before moving to the next fallback.
  for (const model of OPENROUTER_MODELS) {
    if (!model || typeof model !== 'string') {
      continue;
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const attemptNumber = attempt + 1;
      const payload = {
        model,
        messages,
        temperature: requestConfig.temperature,
        max_tokens: requestConfig.max_tokens,
      };

      try {
        validateModel(payload.model);
        validateMessages(payload.messages);
        console.log(`[ai] OpenRouter request model=${model} attempt=${attemptNumber}`);

        await applyRateLimitDelay();

        const response = await fetchWithTimeout(
          OPENROUTER_URL,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.BACKEND_URL || 'http://localhost:5001',
              'X-Title': 'Preecode'
            },
            body: JSON.stringify(payload),
          },
          REQUEST_TIMEOUT_MS
        );

        const rawBody = await response.text();
        const parsedBody = parseJsonSafely(rawBody);

        if (!response.ok) {
          const providerMessage = parsedBody?.error?.message || `OpenRouter HTTP ${response.status}`;
          // 402 = credits needed, 404 = model not found/removed — skip to next model immediately
          // 429 = rate limit (could be daily limit on free tier)
          const skipImmediately = response.status === 402 || response.status === 404;
          const isRateLimit = response.status === 429 || providerMessage.includes('Rate limit exceeded') || providerMessage.includes('free-models-per-day');
          const retryable = !skipImmediately && (response.status === 429 || response.status >= 500 || response.status === 408);

          console.error('[ai] OpenRouter non-200 response', {
            model,
            attempt: attemptNumber,
            status: response.status,
            error: providerMessage,
            body: rawBody.substring(0, 500),
          });

          errors.push({
            model,
            attempt: attemptNumber,
            status: response.status,
            message: providerMessage,
          });

          // If rate limit hit and we have multiple API keys, rotate to next key
          if (isRateLimit && getOpenRouterApiKeys().length > 1) {
            console.log(`[ai] Rate limit hit, rotating to next API key...`);
            rotateToNextApiKey();
            // Retry immediately with new key
            if (attempt < MAX_RETRIES) {
              await sleep(500); // Short delay before retry
              continue;
            }
          }

          if (skipImmediately) {
            console.log(`[ai] Model ${model} returned ${response.status} (${providerMessage}), trying next model...`);
            break; // move to next model
          }

          if (retryable && attempt < MAX_RETRIES) {
            console.log(`[ai] Retrying in ${RETRY_DELAYS_MS[attempt]}ms...`);
            await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
            continue;
          }

          break;
        }

        const content = parsedBody?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          console.error('[ai] Empty content received', {
            model,
            attempt: attemptNumber,
            status: response.status,
            hasChoices: !!parsedBody?.choices,
            choicesLength: parsedBody?.choices?.length,
          });
          errors.push({
            model,
            attempt: attemptNumber,
            status: response.status,
            message: 'OpenRouter returned empty content.',
          });
          break;
        }

        console.log(`[ai] ✅ Success with model ${model} on attempt ${attemptNumber}`);
        return {
          content,
          model,
          raw: parsedBody,
        };
      } catch (error) {
        const isTimeout = error && error.name === 'AbortError';
        const retryable = isTimeout || (error && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT'));

        console.error('[ai] OpenRouter network/timeout error', {
          model,
          attempt: attemptNumber,
          error: error?.message || String(error),
        });

        errors.push({
          model,
          attempt: attemptNumber,
          message: isTimeout ? 'OpenRouter request timed out.' : error?.message || 'Network error',
        });

        if (retryable && attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
          continue;
        }

        break;
      }
    }
  }

  const lastError = errors[errors.length - 1] || {};
  const errorSummary = errors.map(e => `[${e.model} attempt ${e.attempt}]: ${e.message}`).join(' | ');
  throw buildStructuredError({
    message: `AI request failed across all models. Last error: ${lastError.message || 'Unknown'}. Full trace: ${errorSummary}`,
    statusCode: 502,
    code: 'OPENROUTER_FALLBACK_EXHAUSTED',
    model: lastError.model,
    attempt: lastError.attempt,
    providerStatus: lastError.status,
    retryable: false,
    responseBody: lastError.message,
    cause: errors,
  });
}

async function generateResponse(messages, options = {}) {
  try {
    const result = await call_openrouter(messages, options);
    return result.content;
  } catch (error) {
    if (error && error.name === 'OpenRouterError') {
      throw error;
    }

    const wrapped = buildStructuredError({
      message: `AI service error: ${error?.message || 'Unknown error'}`,
      statusCode: error?.statusCode || 502,
      code: error?.code || 'OPENROUTER_UNEXPECTED_ERROR',
      responseBody: error?.message,
      cause: error,
      retryable: false,
    });
    throw wrapped;
  }
}

async function chat(message, context, history = []) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((e) => e && (e.role === 'user' || e.role === 'assistant') && typeof e.text === 'string')
        .slice(-12)
        .map((e) => ({ role: e.role, content: e.text.trim().slice(0, 2000) }))
    : [];

  const systemPrompt = [
    'You are Preecode AI, a helpful coding assistant.',
    'Answer the user question directly and specifically.',
    'If the user asks for output, compute it step by step from the provided code/context.',
    'Use concise, practical language.',
    'If context is missing, ask one short clarifying question instead of guessing.',
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(context ? [{ role: 'system', content: `Editor context:\n${context}` }] : []),
    ...safeHistory,
    { role: 'user', content: message },
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

async function generateQuestion(language, difficulty, topic) {
  const safeLanguage = String(language || 'python').trim().toLowerCase() || 'python';
  const safeDifficulty = String(difficulty || 'medium').trim().toLowerCase();
  const safeTopic = String(topic || '').trim().toLowerCase();
  const safeCompany = 'Preecode';

  const langInstructions = {
    javascript: 'Use pure JavaScript only. No TypeScript. Use console.log for output.',
    typescript: 'Use TypeScript with proper types. Use console.log for output.',
    python: 'Use Python 3. Use print() for output.',
    java: 'Use Java. Include public class Solution with main method. Use System.out.println.',
    cpp: 'Use C++17. Include needed headers. Use cout for output.',
    c: 'Use C. Include needed headers. Use printf for output.',
    go: 'Use Go. Include package main and import fmt. Use fmt.Println.',
    rust: 'Use Rust. Include main function. Use println!.',
  };

  const difficultyContext = {
    easy: 'basic loops, arrays, or string manipulation — solvable in under 15 min',
    medium: 'hashmaps, recursion, or sorting — solvable in 20-30 min',
    hard: 'dynamic programming, graphs, or trees — solvable in 40-60 min',
  }[safeDifficulty] || 'intermediate level';

  const prompt = `You are a coding interview coach at ${safeCompany}.
Generate ONE short ${safeDifficulty} coding problem in ${safeLanguage} style (${difficultyContext}).
${langInstructions[safeLanguage] || ''}

Return ONLY valid JSON, no markdown, no extra text:
{
  "company": "${safeCompany}",
  "title": "Short problem title (3-6 words)",
  "question": "2-3 sentences max. State the function name, inputs, output, and one inline example.",
  "hint": "One sentence nudging toward the approach without giving it away.",
  "solution": "Complete runnable ${safeLanguage} code with function + one demo print call. No markdown fences."
}`;

  const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.75, maxTokens: 600 });
  const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.question || !parsed.solution) throw new Error('Invalid shape');
    return parsed;
  } catch {
    // Fallback: return raw as question text
    return { company: safeCompany, title: 'Coding Challenge', question: cleaned, hint: '', solution: '' };
  }
}

async function verifyCodeOutput(question, code, output, language) {
  const prompt = `You are a coding problem verifier. Check if the code output is correct for the given problem.

Problem: ${question}
User's ${language} code: ${code}
Code output: ${output}

Return ONLY valid JSON (no markdown):
{
  "correct": true or false,
  "feedback": "1-2 sentence explanation of why correct or what is wrong",
  "mistakes": ["specific mistake 1", "specific mistake 2"]
}`;

  try {
    const raw = await generateResponse([{ role: 'user', content: prompt }], { temperature: 0.2, maxTokens: 400 });
    const cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned);
    if (typeof result.correct !== 'boolean') throw new Error('Invalid shape');
    return result;
  } catch (err) {
    console.error('[ai/verify] error:', err.message);
    return { correct: false, feedback: 'Could not verify output. Please check manually.', mistakes: [] };
  }
}

module.exports = { call_openrouter, generateResponse, chat, getHint, reviewCode, generateQuestion, verifyCodeOutput };
