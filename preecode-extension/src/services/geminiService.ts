import * as vscode from 'vscode';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = 'openai/gpt-oss-120b';

function getOpenRouterApiKey(): string {
	return String(process.env.OPENROUTER_API_KEY || '').trim();
}

export async function generateQuestionExplanation(question: string, code: string, language: string): Promise<string> {
	const OPENROUTER_API_KEY = getOpenRouterApiKey();
	if (!OPENROUTER_API_KEY) {
		vscode.window.showErrorMessage('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
		return '';
	}

	try {
		const messages = [
			{
				role: 'system',
				content: 'You are an expert code reviewer and teacher. Provide concise, helpful feedback on the submitted code solution.'
			},
			{
				role: 'user',
				content: `Question: ${question}\n\nLanguage: ${language}\n\nSolution Code:\n${code}\n\nProvide helpful feedback and explain the approach.`
			}
		];

		console.log('Using OpenRouter API');
		const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENROUTER_MODEL,
				messages: messages,
				temperature: 0.7,
				max_tokens: 500,
			}),
		});

		if (!response.ok) {
			const errorData = await response.json() as any;
			vscode.window.showErrorMessage(`OpenRouter API Error: ${errorData.error?.message || 'Unknown error'}`);
			return '';
		}

		const data: any = await response.json();
		return data.choices?.[0]?.message?.content || '';
	} catch (error) {
		console.error('OpenRouter API Error:', error);
		vscode.window.showErrorMessage(`Failed to get AI feedback: ${error instanceof Error ? error.message : 'Unknown error'}`);
		return '';
	}
}

export async function detectTopic(question: string, code: string): Promise<string> {
	const OPENROUTER_API_KEY = getOpenRouterApiKey();
	if (!OPENROUTER_API_KEY) {
		return 'General';
	}

	try {
		const messages = [
			{
				role: 'system',
				content: 'You are a coding topic classifier. Return only one of these topics: Arrays, Strings, LinkedList, Trees, Graphs, Dynamic Programming, Sorting, Searching, Hashing, Stacks, Queues, Greedy, BackTracking, or General'
			},
			{
				role: 'user',
				content: `Classify this coding problem into ONE category:\n\nQuestion: ${question}\n\nCode:\n${code}`
			}
		];

		console.log('Using OpenRouter API');
		const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENROUTER_MODEL,
				messages: messages,
				temperature: 0.3,
				max_tokens: 50,
			}),
		});

		if (!response.ok) {
			return 'General';
		}

		const data: any = await response.json();
		const topic = data.choices?.[0]?.message?.content?.trim() || 'General';
		return topic;
	} catch (error) {
		console.error('Topic detection error:', error);
		return 'General';
	}
}

export async function generateHint(question: string, language: string): Promise<string> {
	const OPENROUTER_API_KEY = getOpenRouterApiKey();
	if (!OPENROUTER_API_KEY) {
		return 'No hint available. Configure OpenRouter API key.';
	}

	try {
		const messages = [
			{
				role: 'system',
				content: 'You are a helpful programming mentor. Provide a single hint (not the solution) to help solve the problem.'
			},
			{
				role: 'user',
				content: `Give me ONE helpful hint for this problem:\n\nQuestion: ${question}\n\nLanguage: ${language}\n\nDo not provide the solution, only a hint.`
			}
		];

		console.log('Using OpenRouter API');
		const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: OPENROUTER_MODEL,
				messages: messages,
				temperature: 0.7,
				max_tokens: 200,
			}),
		});

		if (!response.ok) {
			return 'Could not generate hint.';
		}

		const data: any = await response.json();
		return data.choices?.[0]?.message?.content || 'No hint available.';
	} catch (error) {
		console.error('Hint generation error:', error);
		return 'Could not generate hint.';
	}
}

export type AssistantAction =
	| 'debug'
	| 'fix'
	| 'explain'
	| 'line_execution'
	| 'optimize'
	| 'find_bugs'
	| 'improve_readability'
	| 'chatbot';

export interface AssistantRequest {
	action: AssistantAction;
	code: string;
	language: string;
	diagnostics: string;
	selectedLine?: number;
	selectedText?: string;
	fileName?: string;
	chatPrompt?: string;
}

export interface AssistantResponse {
	problem: string;
	reason: string;
	step_by_step: string[] | string;
	line_execution: string[] | string;
	fixed_code: string;
	suggestions: string[] | string;
}

export async function requestAssistantChatText(prompt: string): Promise<string> {
	const OPENROUTER_API_KEY = getOpenRouterApiKey();
	if (!OPENROUTER_API_KEY) {
		throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
	}

	const messages = [
		{
			role: 'system',
			content: 'You are Preecode AI. Answer directly, accurately, and concisely. If asked for code output, compute it from the provided code.'
		},
		{ role: 'user', content: prompt }
	];

	console.log('Using OpenRouter API');
	const response = await fetchWithFallback(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: OPENROUTER_MODEL,
			messages: messages,
			temperature: 0.4,
			max_tokens: 700
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error?.message || 'OpenRouter request failed.');
	}

	const data: any = await response.json();
	return String(data.choices?.[0]?.message?.content || '').trim();
}

async function fetchWithFallback(url: string, options: any): Promise<any> {
	if ((globalThis as any).fetch) {
		return (globalThis as any).fetch(url, options);
	}
	const mod = await import('node-fetch');
	const fn = (mod && (mod.default || mod)) as any;
	return fn(url, options);
}

function buildAssistantPrompt(request: AssistantRequest): string {
	const selectedBlock = request.selectedText
		? `Selected text:\n${request.selectedText}`
		: 'Selected text: (none)';
	const selectedLine = request.selectedLine
		? `Selected line: ${request.selectedLine}`
		: 'Selected line: (none)';

	return [
		`Action: ${request.action}`,
		`File name: ${request.fileName || 'unknown'}`,
		`Language: ${request.language}`,
		selectedLine,
		selectedBlock,
		`User question: ${request.chatPrompt || '(none)'}`,
		`Diagnostics:\n${request.diagnostics}`,
		`Code:\n${request.code}`
	].join('\n\n');
}

export async function requestAssistantAnalysis(request: AssistantRequest): Promise<AssistantResponse> {
	const OPENROUTER_API_KEY = getOpenRouterApiKey();
	if (!OPENROUTER_API_KEY) {
		throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY environment variable.');
	}

	const systemPrompt = [
		'You are Preecode AI, a professional coding assistant.',
		'Return ONLY valid JSON with the following keys:',
		'problem, reason, step_by_step, line_execution, fixed_code, suggestions.',
		'Use simple language for beginners.',
		'If a field is not applicable, return an empty string or empty array.',
		'Keep responses concise and actionable.'
	].join(' ');

	const extraLineExec = request.action === 'line_execution'
		? 'For line_execution, provide a numbered list explaining which line runs first, why it runs, variable changes, control flow, and short, simple steps.'
		: 'For line_execution, return an empty list unless the action is line_execution.';

	const userPrompt = [
		'Analyze the code and diagnostics based on the action.',
		extraLineExec,
		buildAssistantPrompt(request)
	].join('\n\n');

	const messages = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	];

	console.log('Using OpenRouter API');
	const response = await fetchWithFallback(`${OPENROUTER_BASE_URL}/chat/completions`, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			model: OPENROUTER_MODEL,
			messages: messages,
			temperature: 0.2,
			max_tokens: 900
		})
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error?.message || 'OpenRouter request failed.');
	}

	const data: any = await response.json();
	const content = data.choices?.[0]?.message?.content || '';
	const trimmed = String(content).trim();

	try {
		return JSON.parse(trimmed) as AssistantResponse;
	} catch {
		const start = trimmed.indexOf('{');
		const end = trimmed.lastIndexOf('}');
		if (start >= 0 && end >= 0 && end > start) {
			return JSON.parse(trimmed.slice(start, end + 1)) as AssistantResponse;
		}
		throw new Error('Failed to parse assistant response.');
	}
}
