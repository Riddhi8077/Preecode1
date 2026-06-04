const vscode = acquireVsCodeApi();

let selectedEditor;
let improvedEditor;
let lastPayload = null;

function monacoLanguage(id) {
  const map = {
    javascript: 'javascript',
    typescript: 'typescript',
    python: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    csharp: 'csharp',
    go: 'go',
    rust: 'rust'
  };
  return map[id] || 'plaintext';
}

function render(payload) {
  lastPayload = payload;
  document.getElementById('problemSummary').textContent = payload.problemSummary || '-';
  document.getElementById('rootCause').textContent = payload.rootCause || '-';
  document.getElementById('fixExplanation').textContent = payload.fixExplanation || '-';

  const language = monacoLanguage(payload.language);

  if (selectedEditor) {
    selectedEditor.setModel(monaco.editor.createModel(payload.selectedCode || '', language));
  }
  if (improvedEditor) {
    improvedEditor.setModel(monaco.editor.createModel(payload.improvedCode || '', language));
  }
}

function bootMonaco() {
  const monacoBase = document.body.dataset.monacoBase;
  const loaderScript = document.createElement('script');
  loaderScript.src = `${monacoBase}/vs/loader.js`;
  loaderScript.onload = () => {
    require.config({ paths: { vs: `${monacoBase}/vs` } });
    require(['vs/editor/editor.main'], () => {
      selectedEditor = monaco.editor.create(document.getElementById('selectedCode'), {
        value: '',
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        theme: 'vs-dark'
      });

      improvedEditor = monaco.editor.create(document.getElementById('improvedCode'), {
        value: '',
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        theme: 'vs-dark'
      });

      if (lastPayload) {
        render(lastPayload);
      }
    });
  };
  document.head.appendChild(loaderScript);
}

document.getElementById('applyFixBtn').addEventListener('click', () => {
  const value = improvedEditor ? improvedEditor.getValue() : (lastPayload?.improvedCode || '');
  vscode.postMessage({ type: 'applyFix', payload: value });
});

window.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};
  if (type === 'render') {
    render(payload || {});
  }
});

bootMonaco();
