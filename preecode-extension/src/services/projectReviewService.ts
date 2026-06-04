import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

const MAX_FILE_SIZE = 50000; // 50KB per file
const IGNORED_DIRS = ['.git', 'node_modules', '.vscode', 'dist', 'build', 'out', '__pycache__', '.pytest_cache', 'venv', '.env', '.next', '.nuxt'];
const IGNORED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.pdf'];

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

export interface ProjectInfo {
  name: string;
  frameworks: string[];
  languages: string[];
  totalFiles: number;
}

export async function selectProjectFolder(): Promise<vscode.Uri[] | undefined> {
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: 'Select Project Folder for Review'
  });

  return folders;
}

export async function selectMultipleFiles(): Promise<vscode.Uri[] | undefined> {
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: true,
    title: 'Select Files for Review'
  });

  return files;
}

export async function getWorkspaceFiles(): Promise<vscode.Uri[] | undefined> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace open. Open a folder first.');
    return undefined;
  }

  return vscode.workspace.workspaceFolders.map(folder => folder.uri);
}

function shouldIgnorePath(filePath: string, fileName: string): boolean {
  for (const ignored of IGNORED_DIRS) {
    if (filePath.includes(path.sep + ignored + path.sep) || filePath.startsWith(ignored + path.sep)) {
      return true;
    }
  }

  for (const ext of IGNORED_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

export function getLanguageFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.go': 'go',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sql': 'sql',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.toml': 'toml',
    '.md': 'markdown',
  };

  return languageMap[ext] || 'text';
}

export function detectFrameworks(files: ProjectFile[]): string[] {
  const frameworks = new Set<string>();
  const fileContent = files.map(f => f.content.toLowerCase()).join(' ');

  if (fileContent.includes('react') || fileContent.includes('jsx')) frameworks.add('React');
  if (fileContent.includes('vue')) frameworks.add('Vue');
  if (fileContent.includes('angular')) frameworks.add('Angular');
  if (fileContent.includes('express')) frameworks.add('Express');
  if (fileContent.includes('django')) frameworks.add('Django');
  if (fileContent.includes('flask')) frameworks.add('Flask');
  if (fileContent.includes('fastapi')) frameworks.add('FastAPI');
  if (fileContent.includes('next')) frameworks.add('Next.js');
  if (fileContent.includes('nuxt')) frameworks.add('Nuxt');
  if (fileContent.includes('svelte')) frameworks.add('Svelte');
  if (fileContent.includes('spring')) frameworks.add('Spring');
  if (fileContent.includes('rails')) frameworks.add('Rails');
  if (fileContent.includes('laravel')) frameworks.add('Laravel');
  if (fileContent.includes('fastify')) frameworks.add('Fastify');
  if (fileContent.includes('koa')) frameworks.add('Koa');

  return Array.from(frameworks);
}

export function detectLanguages(files: ProjectFile[]): string[] {
  const languages = new Set(files.map(f => f.language).filter(l => l !== 'text'));
  return Array.from(languages).slice(0, 5); // Top 5 languages
}

async function recursivelyGetFiles(dirPath: string, allFiles: ProjectFile[] = []): Promise<ProjectFile[]> {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', fullPath);

      if (shouldIgnorePath(fullPath, entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        await recursivelyGetFiles(fullPath, allFiles);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(fullPath);
          if (stat.size > MAX_FILE_SIZE) {
            continue; // Skip large files
          }

          const content = await fs.promises.readFile(fullPath, 'utf-8');
          const language = getLanguageFromExtension(entry.name);

          allFiles.push({
            path: relativePath,
            content: content,
            language: language
          });
        } catch (err) {
          // Skip files that can't be read
          console.log(`[projectReview] Skipped file ${fullPath}: ${err}`);
        }
      }
    }
  } catch (err) {
    console.error(`[projectReview] Error reading directory ${dirPath}:`, err);
  }

  return allFiles;
}

export async function filterFilesForReview(files: ProjectFile[], analysisLevel: 'quick' | 'deep'): Promise<ProjectFile[]> {
  // Group by language to get representation
  const byLanguage: Record<string, ProjectFile[]> = {};

  for (const file of files) {
    if (!byLanguage[file.language]) {
      byLanguage[file.language] = [];
    }
    byLanguage[file.language].push(file);
  }

  if (analysisLevel === 'quick') {
    // For quick mode, take up to 2 files (1-2 representative files)
    return files.slice(0, 2);
  }

  // For deep mode, return all files (let backend handle if too many)
  return files;
}

export async function prepareFilesBatch(files: ProjectFile[]): Promise<ProjectFile[][]> {
  // Group files into batches to avoid token limits
  // Maximum 5 files per batch (conservative estimate)
  const batchSize = 5;
  const batches: ProjectFile[][] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  return batches;
}

export async function detectProjectInfo(folderPath: string): Promise<ProjectInfo> {
  const folderName = path.basename(folderPath);

  try {
    const files = await recursivelyGetFiles(folderPath);
    const frameworks = detectFrameworks(files);
    const languages = detectLanguages(files);

    return {
      name: folderName,
      frameworks,
      languages,
      totalFiles: files.length
    };
  } catch (err) {
    console.error('[projectReview] Error detecting project info:', err);
    return {
      name: folderName,
      frameworks: [],
      languages: [],
      totalFiles: 0
    };
  }
}

export async function getFilesFromFolder(folderUri: vscode.Uri): Promise<ProjectFile[]> {
  return recursivelyGetFiles(folderUri.fsPath);
}

export async function getFilesFromSelection(fileUris: vscode.Uri[]): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];

  for (const uri of fileUris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type === vscode.FileType.File) {
        const content = await vscode.workspace.fs.readFile(uri);
        const language = getLanguageFromExtension(uri.fsPath);
        const relativePath = vscode.workspace.asRelativePath(uri);

        files.push({
          path: relativePath,
          content: Buffer.from(content).toString('utf-8'),
          language: language
        });
      }
    } catch (err) {
      console.log(`[projectReview] Skipped file ${uri.fsPath}:`, err);
    }
  }

  return files;
}

export async function askAnalysisLevel(): Promise<'quick' | 'deep' | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Quick Analysis', description: 'Review 1-2 representative files', value: 'quick' },
      { label: 'Deep Analysis', description: 'Review all files in project', value: 'deep' }
    ],
    { title: 'Select Analysis Level' }
  );

  return choice?.value as 'quick' | 'deep' | undefined;
}

export async function askReviewSource(): Promise<'workspace' | 'folder' | 'files' | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Review Current Workspace', description: 'Analyze all open workspace folders', value: 'workspace' },
      { label: 'Select Project Folder', description: 'Choose a folder to review', value: 'folder' },
      { label: 'Select Specific Files', description: 'Choose individual files to review', value: 'files' }
    ],
    { title: 'How would you like to review?' }
  );

  return choice?.value as 'workspace' | 'folder' | 'files' | undefined;
}
