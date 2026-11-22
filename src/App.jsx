import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import localforage from 'localforage';
import JSZip from 'jszip';
import { 
  FiCode, FiSave, FiFolder, FiMenu, FiPlus, FiUpload, 
  FiX, FiPlay, FiSettings, FiCheckCircle, FiAlertCircle, 
  FiDelete, FiCornerDownLeft, FiChevronsLeft, FiSun, FiMoon, FiSearch,
  FiDownloadCloud, FiCopy, FiScissors, FiClipboard, FiTerminal
} from 'react-icons/fi';
import './App.css';

function App() {
  const [theme, setTheme] = useState('vs-dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, type: 'success', title: '', message: '', isPrompt: false, inputValue: '', onConfirm: null 
  });
  
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, hasSelection: false });
  
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const saveTimerRef = useRef(null);

  const showCustomAlert = (type, title, message, isPrompt = false, onConfirm = null) => {
    setAlertConfig({ visible: true, type, title, message, isPrompt, inputValue: '', onConfirm });
  };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // ---- Load once ----
  useEffect(() => {
    localforage.getItem('techSystemFiles').then((savedFiles) => {
      if (savedFiles && savedFiles.length > 0) {
        setFiles(savedFiles);
        setActiveFileId(savedFiles[0].id);
      } else {
        const defaultFiles = [
          { id: '1', name: 'index.html', language: 'html', content: '<!DOCTYPE html>\n<html>\n<body>\n  <h1 style="color: #38bdf8;">Hello Tech System!</h1>\n  <button onclick="testLog()">Click Me</button>\n</body>\n</html>' },
          { id: '2', name: 'style.css', language: 'css', content: 'body {\n  background: #0f172a;\n  color: white;\n  font-family: "Outfit", sans-serif;\n}' },
          { id: '3', name: 'app.js', language: 'javascript', content: 'console.log("App Running...");\nfunction testLog() {\n  console.log("Button clicked at: " + new Date().toLocaleTimeString());\n}' }
        ];
        setFiles(defaultFiles);
        setActiveFileId('1');
      }
    });
  }, []);

  // ---- Debounced save (typing lag fix) ----
  useEffect(() => {
    if (files.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localforage.setItem('techSystemFiles', files).catch(() => {});
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [files]);

  const activeFile = files.find(f => f.id === activeFileId);
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCodeChange = useCallback((newCode) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newCode ?? '' } : f));
  }, [activeFileId]);

  const handleFileOpen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      const extension = file.name.split('.').pop().toLowerCase();
      let lang = 'plaintext';
      if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) lang = 'javascript';
      else if (extension === 'html') lang = 'html';
      else if (extension === 'css') lang = 'css';
      else if (extension === 'py') lang = 'python';
      else if (extension === 'json') lang = 'json';

      const newFile = { id: Date.now().toString(), name: file.name, language: lang, content };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setSidebarOpen(false);
      showCustomAlert('success', 'File Opened', `${file.name} loaded successfully!`);
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleSaveToPhone = async () => {
    if (!activeFile) return;
    try {
      if ('showSaveFilePicker' in window) {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: activeFile.name,
          types: [{
            description: 'Code Files',
            accept: {
              'text/plain': ['.txt'],
              'text/html': ['.html'],
              'text/css': ['.css'],
              'text/javascript': ['.js'],
              'application/json': ['.json'],
              'text/x-python': ['.py'],
            },
          }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(activeFile.content);
        await writable.close();
        showCustomAlert('success', 'Saved!', 'File successfully saved to your phone storage.');
      } else {
        const blob = new Blob([activeFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeFile.name;
        a.click();
        URL.revokeObjectURL(url);
        showCustomAlert('success', 'Downloaded!', 'File downloaded via browser.');
      }
    } catch (err) {
      console.log('Save cancelled', err);
    }
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    files.forEach(file => zip.file(file.name, file.content));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tech-system-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    showCustomAlert('success', 'Exported!', 'Project exported as ZIP successfully.');
  };

  const handleCreateNewFile = () => {
    showCustomAlert('info', 'New File', 'Enter file name (e.g. script.js):', true, (fileName) => {
      if (!fileName) return;
      const extension = fileName.split('.').pop().toLowerCase();
      let lang = 'plaintext';
      if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) lang = 'javascript';
      else if (extension === 'html') lang = 'html';
      else if (extension === 'css') lang = 'css';
      else if (extension === 'py') lang = 'python';
      else if (extension === 'json') lang = 'json';

      const newFile = { id: Date.now().toString(), name: fileName, language: lang, content: '// New File\n' };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setSidebarOpen(false);
    });
  };

  const handleDeleteFile = (id, e) => {
    e.stopPropagation();
    showCustomAlert('danger', 'Close File', 'Are you sure you want to close this file? Unsaved changes will be lost.', false, () => {
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      if (newFiles.length > 0) setActiveFileId(newFiles[0].id);
      else setActiveFileId(null);
    });
  };

  // ---- Clipboard actions ----
  const handleCut = async () => {
    if (!editorRef.current) return;
    try {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
    } catch { showCustomAlert('danger', 'Cut failed', 'Clipboard access denied.'); }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleCopy = async () => {
    if (!editorRef.current) return;
    try {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      showCustomAlert('success', 'Copied!', 'Selected text copied to clipboard.');
    } catch { showCustomAlert('danger', 'Copy failed', 'Clipboard access denied.'); }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (editorRef.current) {
        editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text }]);
      }
    } catch {
      showCustomAlert('danger', 'Paste Failed', 'Please allow clipboard access in browser settings.');
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleSelectAll = () => {
    if (editorRef.current) {
      editorRef.current.setSelection(editorRef.current.getModel().getFullModelRange());
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleDeleteSelection = () => {
    if (editorRef.current) {
      editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  // ---- Mobile keyboard helpers ----
  // ফোকাস রাখুন যাতে keyboard বন্ধ না হয়
  const keepFocus = () => {
    if (editorRef.current) editorRef.current.focus();
  };

  // Safe Range helper (monacoRef null guard)
  const safeRange = (sl, sc, el, ec) => {
    if (monacoRef.current?.Range) return new monacoRef.current.Range(sl, sc, el, ec);
    return { startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec };
  };

  const handleMobileTab = () => {
    if (!editorRef.current) return;
    const selection = editorRef.current.getSelection();
    const model = editorRef.current.getModel();
    if (!model) return;

    if (selection && !selection.isEmpty()) {
      const edits = [];
      for (let i = selection.startLineNumber; i <= selection.endLineNumber; i++) {
        edits.push({
          range: safeRange(i, 1, i, 1),
          text: '    ',
          forceMoveMarkers: true,
        });
      }
      editorRef.current.executeEdits('', edits);
    } else {
      editorRef.current.executeEdits('', [{
        range: selection,
        text: '    ',
        forceMoveMarkers: true,
      }]);
    }
    keepFocus();
  };

  const handleMobileEnter = () => {
    if (!editorRef.current) return;
    editorRef.current.executeEdits('', [{
      range: editorRef.current.getSelection(),
      text: '\n',
      forceMoveMarkers: true,
    }]);
    keepFocus();
  };

  const handleMobileDelete = () => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    const selection = editorRef.current.getSelection();
    const position = editorRef.current.getPosition();
    if (!position) return;

    if (selection && !selection.isEmpty()) {
      editorRef.current.executeEdits('', [{ range: selection, text: '' }]);
      keepFocus();
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);

    if (lineContent.trim() === '' && position.lineNumber > 1) {
      const prevLineLength = model.getLineMaxColumn(position.lineNumber - 1);
      editorRef.current.executeEdits('', [{
        range: safeRange(position.lineNumber - 1, prevLineLength, position.lineNumber, 1),
        text: '',
      }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
    } else if (position.column > 1) {
      editorRef.current.executeEdits('', [{
        range: safeRange(position.lineNumber, position.column - 1, position.lineNumber, position.column),
        text: '',
      }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber, column: position.column - 1 });
    } else if (position.lineNumber > 1) {
      const prevLineLength = model.getLineMaxColumn(position.lineNumber - 1);
      editorRef.current.executeEdits('', [{
        range: safeRange(position.lineNumber - 1, prevLineLength, position.lineNumber, 1),
        text: '',
      }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
    }
    keepFocus();
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onContextMenu((e) => {
      e.event.preventDefault();
      const selection = editor.getSelection();
      const hasSelection = selection && !selection.isEmpty();
      const position = editor.getPosition();
      const coords = position ? editor.getScrolledVisiblePosition(position) : null;
      if (coords) {
        setContextMenu({
          visible: true,
          x: Math.min(coords.left, window.innerWidth - 170),
          y: Math.min(coords.top + 30, window.innerHeight - 220),
          hasSelection,
        });
      }
    });
    editor.onMouseDown(() => setContextMenu(c => ({ ...c, visible: false })));

    // Keyboard খোলা/বন্ধ হলে layout ঠিক করুন
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        editor.layout();
        // cursor view-তে রাখুন
        const pos = editor.getPosition();
        if (pos) editor.revealPositionInCenterIfOutsideViewport(pos);
      });
    }
  };

  const getPreviewContent = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html'));
    const cssFile = files.find(f => f.name.endsWith('.css'));
    const jsFile = files.find(f => f.name.endsWith('.js'));

    let html = htmlFile ? htmlFile.content : '<h1>No HTML File Found</h1>';
    const css = cssFile ? `<style>${cssFile.content}</style>` : '';

    const consoleOverride = `
      <script>
        (function() {
          const orig = console.log;
          console.log = function(...args) {
            try { window.parent.postMessage({ type: 'CONSOLE_LOG', message: args.join(' ') }, '*'); } catch(e){}
            orig.apply(console, args);
          };
          window.addEventListener('error', function(e) {
            try { window.parent.postMessage({ type: 'CONSOLE_LOG', message: 'ERROR: ' + e.message }, '*'); } catch(e){}
          });
        })();
      <\/script>
    `;

    const js = jsFile ? `<script>${jsFile.content}<\/script>` : '';

    // uppercase-safe replace
    const hasHead = /<\/head>/i.test(html);
    const hasBody = /<\/body>/i.test(html);

    if (hasHead) html = html.replace(/<\/head>/i, `${css}${consoleOverride}</head>`);
    else html = `<head>${css}${consoleOverride}</head>` + html;

    if (hasBody) html = html.replace(/<\/body>/i, `${js}</body>`);
    else html = html + js;

    return html;
  };

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [...prev, event.data.message]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className={`app-container ${theme === 'vs-light' ? 'light-mode' : ''}`}>
      <header className="top-bar">
        <div className="logo">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <FiMenu size={20} />
          </button>
          <FiCode size={20} className="logo-icon" />
          <h1>Tech System</h1>
        </div>
        <div className="actions">
          <button className="icon-btn bg-transparent" onClick={() => setTheme(theme === 'vs-dark' ? 'vs-light' : 'vs-dark')}>
            {theme === 'vs-dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <button className="icon-btn bg-transparent" onClick={() => setShowSettings(true)}>
            <FiSettings size={18} />
          </button>
          <button className="icon-btn bg-transparent" onClick={() => { setShowPreview(!showPreview); setConsoleLogs([]); }}>
            <FiPlay size={18} />
          </button>
          <button className="icon-btn" onClick={handleSaveToPhone} title="Save to Phone">
            <FiSave size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <span><FiFolder size={14} /> Explorer</span>
            <button onClick={handleCreateNewFile} className="new-file-btn"><FiPlus size={16} /></button>
          </div>

          <div className="sidebar-search">
            <FiSearch size={14} />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sidebar-actions">
            <button onClick={() => fileInputRef.current.click()}>
              <FiUpload size={14} /> Open from Phone
            </button>
            <button onClick={handleExportZip} className="export-btn">
              <FiDownloadCloud size={14} /> Export ZIP
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileOpen} style={{ display: 'none' }} accept=".js,.html,.css,.json,.py,.txt" />
          </div>

          <ul className="file-list">
            {filteredFiles.map(file => (
              <li key={file.id} className={activeFileId === file.id ? 'active' : ''} onClick={() => { setActiveFileId(file.id); setSidebarOpen(false); }}>
                <FiCode size={14} />
                <span className="file-name">{file.name}</span>
                <button className="close-tab-btn" onClick={(e) => handleDeleteFile(file.id, e)}>
                  <FiX size={14} />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)}></div>}

        <section className="editor-section">
          {activeFile ? (
            <>
              <div className="editor-header"><span>{activeFile.name}</span></div>
              <div className="editor-wrapper">
                <Editor
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  onChange={handleCodeChange}
                  theme={theme}
                  onMount={handleEditorDidMount}
                  options={{
                    fontSize,
                    lineHeight: 1.6,
                    fontLigatures: true,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: { enabled: false },
                    wordWrap: 'off',
                    automaticLayout: true,
                    lineNumbers: 'on',
                    formatOnPaste: false,
                    formatOnType: false,
                    autoIndent: 'keep', // keep > none
                    tabSize: 4,
                    readOnly: false,
                    mouseWheelZoom: true,
                    contextmenu: false,
                    selectOnLineNumbers: true,
                    selectionHighlight: true,
                    cursorBlinking: 'smooth',
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    colorDecorators: true,
                    matchBrackets: 'always',
                    autoClosingBrackets: 'languageDefined',
                    autoClosingQuotes: 'languageDefined',
                    scrollBeyondLastLine: false,
                    padding: { top: 8, bottom: 120 }, // bottom padding → cursor keyboard-এর উপরে থাকবে
                    fixedOverflowWidgets: true,
                  }}
                />
              </div>

              <div className="mobile-keyboard-toolbar">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={() => { editorRef.current?.trigger('keyboard', 'undo'); keepFocus(); }}
                ><FiChevronsLeft /></button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={handleMobileTab}
                >Tab</button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={handleMobileEnter}
                ><FiCornerDownLeft /></button>

                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onTouchStart={(e) => e.preventDefault()}
                  onClick={handleMobileDelete}
                  className="delete-btn"
                ><FiDelete /></button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <FiCode size={48} />
              <p>No file opened</p>
              <button onClick={handleCreateNewFile}>Create New File</button>
            </div>
          )}
        </section>

        {showPreview && (
          <div className="preview-panel">
            <div className="preview-header">
              <span>Live Preview</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowConsole(!showConsole)} style={{ fontSize: '0.8rem' }}>
                  <FiTerminal /> Console
                </button>
                <button onClick={() => setShowPreview(false)}><FiX size={14} /></button>
              </div>
            </div>
            <iframe title="preview" srcDoc={getPreviewContent()} className="preview-iframe" sandbox="allow-scripts allow-modals" />

            {showConsole && (
              <div className="console-panel">
                <div className="console-header">
                  <span>Console Logs</span>
                  <button onClick={() => setConsoleLogs([])}>Clear</button>
                </div>
                <div className="console-output">
                  {consoleLogs.length === 0 ? (
                    <span style={{ color: '#64748b' }}>No logs yet...</span>
                  ) : consoleLogs.map((log, i) => (
                    <div key={i} className="log-line">{log}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {contextMenu.visible && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.hasSelection && (
            <>
              <button onClick={handleCut}><FiScissors size={14} /> Cut</button>
              <button onClick={handleCopy}><FiCopy size={14} /> Copy</button>
              <button onClick={handleDeleteSelection} className="text-red"><FiX size={14} /> Delete</button>
            </>
          )}
          <button onClick={handlePaste}><FiClipboard size={14} /> Paste</button>
          <button onClick={handleSelectAll}><FiCode size={14} /> Select All</button>
        </div>
      )}

      {alertConfig.visible && (
        <div className="modal-overlay">
          <div className="custom-alert-box">
            <div className={`alert-icon ${alertConfig.type}`}>
              {alertConfig.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            </div>
            <h3>{alertConfig.title}</h3>
            <p>{alertConfig.message}</p>

            {alertConfig.isPrompt && (
              <input
                type="text"
                className="alert-input"
                placeholder="filename.js"
                value={alertConfig.inputValue}
                onChange={(e) => setAlertConfig({ ...alertConfig, inputValue: e.target.value })}
                autoFocus
              />
            )}

            <div className="alert-actions">
              <button className="alert-btn cancel" onClick={closeAlert}>Cancel</button>
              <button className="alert-btn confirm" onClick={() => {
                if (alertConfig.onConfirm) alertConfig.onConfirm(alertConfig.inputValue);
                closeAlert();
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Settings</h2>
              <button onClick={() => setShowSettings(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="setting-item">
                <label>Editor Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="vs-dark">Dark (Default)</option>
                  <option value="vs-light">Light</option>
                  <option value="hc-black">High Contrast</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Font Size: {fontSize}px</label>
                <input type="range" min="12" max="24" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="status-bar">
        <div className="status-left"><span>{activeFile?.language?.toUpperCase() || 'TXT'}</span></div>
        <div className="status-right"><span>UTF-8</span><span>Tech System</span></div>
      </footer>
    </div>
  );
}

export default App;