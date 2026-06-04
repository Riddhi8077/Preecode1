import * as vscode from 'vscode';
import { getToken, deleteToken } from './authService';

const DEFAULT_BACKEND_URL = 'https://preecode-backend.onrender.com';
const QUESTION_REQUEST_TIMEOUT_MS = 35_000;

function normalizeBaseUrl(url: string): string {
    return String(url || '').trim().replace(/\/$/, '');
}

export function getBackendUrl(): string {
    const configured = vscode.workspace.getConfiguration('preecode').get<string>('backendUrl')?.trim();
    if (configured) {
        return normalizeBaseUrl(configured);
    }

    const envConfigured = process.env.PREECODE_BACKEND_URL?.trim();
    if (envConfigured) {
        // Keep local debugging explicit: only use an env override when the developer opted in.
        return normalizeBaseUrl(envConfigured);
    }

    return DEFAULT_BACKEND_URL;
}

export function getFrontendUrl(): string {
    const configured = vscode.workspace.getConfiguration('preecode').get<string>('frontendUrl');
    const envConfigured = process.env.PREECODE_FRONTEND_URL?.trim();
    return normalizeBaseUrl(configured || envConfigured || 'https://preecode.vercel.app');
}

export function getApiBase(): string {
    return `${getBackendUrl()}/api`;
}

export const API_BASE = getApiBase();

// Helper to obtain a fetch implementation in Node + ESM environments.
export async function doFetch(url: string, opts?: any): Promise<any> {
    if ((globalThis as any).fetch) {
        return (globalThis as any).fetch(url, opts);
    }
    const mod = await import('node-fetch');
    const fn = (mod && (mod.default || mod)) as any;
    return fn(url, opts);
}

async function doFetchWithTimeout(url: string, opts: any, timeoutMs = QUESTION_REQUEST_TIMEOUT_MS): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await doFetch(url, { ...(opts || {}), signal: controller.signal });
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error('Backend is waking up. Please try again.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

// Shape of practice data sent after each successful run
export interface PracticeData {
    question: string;
    timeTaken: string;      // formatted "MM:SS"
    topic?: string;         // e.g., 'Arrays', 'Strings', etc.
    hintsUsed: number;
    solutionViewed: boolean;
    language: string;
    date: string;           // ISO 8601 date string
    difficulty?: 'easy' | 'medium' | 'hard';
    hintUsagePercent?: number;
    aiRating?: number;
}

// Shape of submission data sent when user submits a solution from the extension
export interface SubmissionData {
    problemName: string;
    difficulty?: string;
    status: string; // e.g., 'Accepted', 'Wrong Answer'
    topic?: string; // e.g., 'Arrays', 'Strings', etc.
    timeTaken?: string; // formatted "MM:SS"
    date?: string;  // ISO string
}

export interface ChatHistoryItem {
    role: 'user' | 'assistant';
    text: string;
}

export interface GenerateQuestionRequest {
    language: string;
    difficulty: 'easy' | 'medium' | 'hard';
    topic?: string;
}

function normalizeDifficulty(input?: string): 'easy' | 'medium' | 'hard' {
    const value = String(input || '').trim().toLowerCase();
    if (value === 'easy' || value === 'medium' || value === 'hard') return value;
    return 'easy';
}

function normalizeStatus(input: string): 'accepted' | 'wrong' {
    const value = String(input || '').trim().toLowerCase();
    if (value.includes('accept') || value.includes('correct')) return 'accepted';
    return 'wrong';
}

export async function sendSubmission(
    context: vscode.ExtensionContext,
    data: SubmissionData
): Promise<boolean> {
    const token = await getToken(context);
    if (!token) {
        vscode.window.showErrorMessage('preecode: Please login first to submit.');
        return false;
    }

    try {
        // Resolve userId from /users/me so backend receives an explicit userId
        let userId: string | undefined;
        try {
            const meRes = await doFetch(`${API_BASE}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (meRes && meRes.ok) {
                const meJson: any = await meRes.json();
                userId = meJson._id || meJson.id;
            }
        } catch (e) { /* ignore */ }

        const response = await doFetch(`${API_BASE}/submissions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId,
                problemName: (data.problemName || 'Practice Session').trim(),
                difficulty: normalizeDifficulty(data.difficulty),
                status: normalizeStatus(data.status),
                topic: data.topic || 'General',
                timeTaken: data.timeTaken || '00:00',
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage('preecode: Session expired. Please login again.');
            return false;
        }

        if (response.status === 429) {
            vscode.window.showWarningMessage('preecode: Too many requests right now. Please wait a few seconds and try again.');
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(`preecode: Failed to submit (${response.status}).`);
            return false;
        }

        vscode.window.showInformationMessage(`preecode: Submission saved (${(data.problemName || 'Practice Session').trim()})`);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage('preecode: Could not reach server. Submission not saved.');
        return false;
    }
}

/**
 * Sends practice session data to the backend after a successful run.
 *
 * Phase 2: POST /api/practice with Bearer token.
 * Phase 4: Handles fetch failures and 401 session expiry cleanly.
 *
 * Returns true if data was sent successfully, false otherwise.
 */
export async function sendPracticeData(
    context: vscode.ExtensionContext,
    data: PracticeData
): Promise<boolean> {
    // Get stored token — if missing, user is not logged in
    const token = await getToken(context);

    if (!token) {
        vscode.window.showErrorMessage(
            'preecode: Please login first to save your practice data. Use "preecode: Login" command.'
        );
        return false;
    }

    try {
        const response = await doFetch(`${API_BASE}/practice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        // Phase 4: 401 means token is expired or invalid — auto logout
        if (response.status === 401) {
            await deleteToken(context);
            vscode.window.showErrorMessage(
                'preecode: Session expired. Please login again using "preecode: Login".'
            );
            return false;
        }

        if (response.status === 429) {
            vscode.window.showWarningMessage(
                'preecode: Too many requests right now. Please wait a few seconds and try saving again.'
            );
            return false;
        }

        if (!response.ok) {
            vscode.window.showErrorMessage(
                `preecode: Failed to save practice data (${response.status}). Will try again next time.`
            );
            return false;
        }

        // Notify user of saved practice (non-blocking)
        try {
            vscode.window.showInformationMessage(`preecode: Practice saved — ${data.timeTaken}`);
        } catch (e) {
            console.log('Could not show notification:', e);
        }

        return true;

    } catch (error: any) {
        // Phase 4: Network failure or fetch error — show message, do not crash
        vscode.window.showErrorMessage(
            'preecode: Could not reach server. Practice data not saved. Check your connection.'
        );
        return false;
    }
}

export async function sendAIChatMessage(
    context: vscode.ExtensionContext,
    message: string,
    editorContext: string,
    history: ChatHistoryItem[] = []
): Promise<string> {
    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to use AI chat.');
    }

    const safeHistory = (Array.isArray(history) ? history : [])
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.text === 'string')
        .slice(-12)
        .map((item) => ({ role: item.role, text: item.text.trim().slice(0, 2000) }));

    try {
        console.log('[Preecode] Calling backend API: /api/ai/chat');
        const response = await doFetchWithTimeout(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                context: editorContext,
                history: safeHistory
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `AI chat failed (${response.status}).`);
        }

        const payload: any = await response.json();
        console.log('[Preecode] Backend response received: /api/ai/chat');
        return String(payload?.response || '').trim();
    } catch (error: any) {
        const msg = String(error?.message || '');
        if (msg.includes('waking up') || msg.includes('AbortError') || msg.includes('abort')) {
            throw new Error('Preecode server is starting up. Please wait a moment and try again.');
        }
        throw new Error(msg || 'Could not reach AI chat service.');
    }
}

function normalizeQuestionResponse(payload: any): string {
    const question = String(payload?.question || payload?.data?.question || payload?.result?.question || '').trim();
    const hint = String(payload?.hint || payload?.data?.hint || payload?.result?.hint || '').trim();
    const solution = String(payload?.solution || payload?.data?.solution || payload?.result?.solution || '').trim();

    if (!question) {
        throw new Error('Backend returned empty question content.');
    }

    const blocks = ['[QUESTION]', question];
    if (hint) {
        blocks.push('', '[HINT]', hint);
    }
    if (solution) {
        blocks.push('', '[SOLUTION]', solution);
    }

    return blocks.join('\n');
}

function ensureQuestionBlock(text: string): string {
    const cleaned = String(text || '').trim();
    if (!cleaned) {
        throw new Error('Backend returned empty question content.');
    }
    if (/\[QUESTION\]/i.test(cleaned)) {
        return cleaned;
    }
    return ['[QUESTION]', cleaned].join('\n');
}

export async function generateQuestionFromBackend(
    context: vscode.ExtensionContext,
    request: GenerateQuestionRequest
): Promise<string> {
    const language = String(request.language || '').trim().toLowerCase() || 'plaintext';
    const difficulty = normalizeDifficulty(request.difficulty);
    const topic = String(request.topic || '').trim().toLowerCase() || undefined;

    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to generate questions.');
    }

    // Primary: dedicated generate-question endpoint
    try {
        console.log('[Preecode] Calling backend API: /api/ai/generate-question');
        const requestBody: any = { language, difficulty };
        if (topic) {
            requestBody.topic = topic;
        }
        const response = await doFetchWithTimeout(`${API_BASE}/ai/generate-question`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = String(errorData?.message || '').trim();
            throw new Error(message || `Question generation failed (${response.status}).`);
        }

        const payload: any = await response.json().catch(() => ({}));
        console.log('[Preecode] Backend response received: /api/ai/generate-question');
        return ensureQuestionBlock(String(payload?.question || ''));
    } catch (error: any) {
        const msg = String(error?.message || '');
        // Re-throw auth errors immediately — no point in fallback
        if (msg.includes('Session expired') || msg.includes('login')) {
            throw error;
        }
        console.warn('[Preecode] Primary generate-question failed, trying chat fallback:', msg);
    }

    // Fallback: use /api/ai/chat to generate a question
    try {
        const topicText = topic ? ` about ${topic}` : '';
        const prompt = [
            `Generate one ${difficulty} coding practice question in ${language}${topicText}.`,
            'Return strictly in this format (no markdown fences):',
            '[QUESTION]',
            '<clear problem statement with input/output and constraints>',
            '',
            '[HINT]',
            '<a concise non-spoiler hint>',
            '',
            '[SOLUTION]',
            '<complete correct solution in ' + language + ', raw code only, no backticks>',
            '',
            'Rules: include a small execution block that runs and prints sample output.'
        ].join('\n');

        console.log('[Preecode] Calling backend fallback: /api/ai/chat for question generation');
        const contextParts = [`language=${language}`, `difficulty=${difficulty}`];
        if (topic) {
            contextParts.push(`topic=${topic}`);
        }
        const response = await doFetchWithTimeout(`${API_BASE}/ai/chat`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: prompt,
                context: contextParts.join(';'),
                history: []
            })
        });

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const message = String(errorData?.message || '').trim();
            throw new Error(message || `Question generation failed (${response.status}).`);
        }

        const payload: any = await response.json().catch(() => ({}));
        console.log('[Preecode] Backend fallback response received');
        const content = String(payload?.response || '').trim();
        return ensureQuestionBlock(content);
    } catch (error: any) {
        const msg = String(error?.message || '');
        if (msg.includes('waking up') || msg.includes('abort')) {
            throw new Error('Preecode server is starting up. Please wait a moment and try again.');
        }
        throw new Error(msg || 'Could not reach question generation service.');
    }
}

export interface ProjectReviewFile {
    path: string;
    content: string;
    language: string;
}

export interface ProjectReviewRequest {
    files: ProjectReviewFile[];
    projectInfo?: {
        name: string;
        frameworks: string[];
        languages: string[];
        totalFiles: number;
    };
    analysisLevel: 'quick' | 'deep';
}

export async function sendProjectReviewRequest(
    context: vscode.ExtensionContext,
    request: ProjectReviewRequest
): Promise<any> {
    const token = await getToken(context);
    if (!token) {
        throw new Error('Please login to Preecode to use project review.');
    }

    if (!request.files || request.files.length === 0) {
        throw new Error('No files selected for review.');
    }

    try {
        console.log('[Preecode] Calling backend API: /api/ai/project-review');
        const response = await doFetchWithTimeout(`${API_BASE}/ai/project-review`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: request.files,
                projectInfo: request.projectInfo,
                analysisLevel: request.analysisLevel
            })
        }, 60000); // 60 second timeout for project review

        if (response.status === 401) {
            await deleteToken(context);
            throw new Error('Session expired. Please login again.');
        }

        if (response.status === 429) {
            throw new Error('Too many requests. Please wait a moment and try again.');
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Project review failed (${response.status}).`);
        }

        const payload: any = await response.json();
        console.log('[Preecode] Backend response received: /api/ai/project-review');
        return payload;
    } catch (error: any) {
        const msg = String(error?.message || '');
        if (msg.includes('waking up') || msg.includes('AbortError') || msg.includes('abort')) {
            throw new Error('Preecode server is starting up. Please wait a moment and try again.');
        }
        throw new Error(msg || 'Could not reach project review service.');
    }
}
