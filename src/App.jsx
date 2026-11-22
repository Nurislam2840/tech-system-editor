import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import localforage from 'localforage';
import JSZip from 'jszip';
import LZString from 'lz-string';
import prettier from 'prettier/standalone';
import parserHtml from 'prettier/parser-html';
import parserCss from 'prettier/parser-postcss';
import parserBabel from 'prettier/parser-babel';
import {
  FiCode, FiSave, FiFolder, FiMenu, FiPlus, FiUpload,
  FiX, FiPlay, FiSettings, FiCheckCircle, FiAlertCircle,
  FiDelete, FiCornerDownLeft, FiChevronsLeft, FiChevronsRight,
  FiSun, FiMoon, FiSearch, FiDownloadCloud, FiCopy, FiScissors,
  FiClipboard, FiTerminal, FiEdit2, FiAlignLeft, FiLink,
  FiGithub, FiWifi, FiWifiOff, FiShare2, FiClock, FiCommand
} from 'react-icons/fi';
import './App.css';

// ---------- File icon helper ----------
const getFileIcon = (name) => {
  const n = name.toLowerCase();
  if (n.endsWith('.html') || n.endsWith('.htm')) return '🟧';
  if (n.endsWith('.css')) return '🟦';
  if (n.endsWith('.js') || n.endsWith('.jsx')) return '🟨';
  if (n.endsWith('.ts') || n.endsWith('.tsx')) return '🔷';
  if (n.endsWith('.json')) return '🟩';
  if (n.endsWith('.py')) return '🐍';
  if (n.endsWith('.md')) return '📘';
  if (n.endsWith('.txt')) return '📄';
  return '📄';
};

const getLanguage = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'javascript';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'py') return 'python';
  if (ext === 'json') return 'json';
  if (ext === 'md') return 'markdown';
  return 'plaintext';
};

// ---------- Console level color ----------
const logColor = (level) => {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'info': return '#38bdf8';
    default: return '#4ade80';
  }
};

function App() {
  const [theme, setTheme] = useState('vs-dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [fontSize, setFontSize] = useState(14);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('name'); // 'name' | 'content'
  const [searchResults, setSearchResults] = useState([]);
  const [savedFilesMap, setSavedFilesMap] = useState({});
  const [online, setOnline] = useState(navigator.onLine);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [showUnsavedDot, setShowUnsavedDot] = useState(false);

  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false, type: 'success', title: '', message: '',
    isPrompt: false, inputValue: '', onConfirm: null
  });

  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, hasSelection: false, fileId: null });

  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const saveTimerRef = useRef(null);
  const searchTimerRef = useRef(null);

  // ---------- Alerts ----------
  const showCustomAlert = (type, title, message, isPrompt = false, onConfirm = null) => {
    setAlertConfig({ visible: true, type, title, message, isPrompt, inputValue: '', onConfirm });
  };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // ---------- Online / Offline ----------
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // ---------- Load from URL hash or localforage ----------
  useEffect(() => {
    const load = async () => {
      // URL hash check (share feature)
      const hash = window.location.hash;
      if (hash.startsWith('#code=')) {
        try {
          const decoded = LZString.decompressFromEncodedURIComponent(hash.slice(6));
          if (decoded) {
            const urlFile = { id: 'url-' + Date.now(), name: 'shared.html', language: 'html', content: decoded };
            setFiles([urlFile]);
            setActiveFileId(urlFile.id);
            showCustomAlert('success', 'Imported from URL', 'Shared code loaded. Edit and save!');
            window.history.replaceState(null, '', window.location.pathname);
            return;
          }
        } catch { /* ignore */ }
      }

      const savedFiles = await localforage.getItem('techSystemFiles');
      if (savedFiles && savedFiles.length > 0) {
        setFiles(savedFiles);
        setActiveFileId(savedFiles[0].id);
        const map = {};
        savedFiles.forEach(f => map[f.id] = f.content);
        setSavedFilesMap(map);
      } else {
        const defaults = [
          { id: '1', name: 'index.html', language: 'html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <h1 style="color: #38bdf8;">Hello Tech System!</h1>\n  <button onclick="testLog()">Click Me</button>\n</body>\n</html>' },
          { id: '2', name: 'style.css', language: 'css', content: 'body {\n    background: #0f172a;\n    color: white;\n    font-family: "Outfit", sans-serif;\n    padding: 20px;\n}' },
          { id: '3', name: 'app.js', language: 'javascript', content: 'console.log("App Running...");\n\nfunction testLog() {\n    console.log("Button clicked at: " + new Date().toLocaleTimeString());\n    console.warn("This is a warning");\n    console.error("This is an error demo");\n}' }
        ];
        setFiles(defaults);
        setActiveFileId('1');
        const map = {};
        defaults.forEach(f => map[f.id] = f.content);
        setSavedFilesMap(map);
      }
    };
    load();
  }, []);

  // ---------- Debounced save ----------
  useEffect(() => {
    if (files.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await localforage.setItem('techSystemFiles', files).catch(() => {});
      const map = {};
      files.forEach(f => map[f.id] = f.content);
      setSavedFilesMap(map);
      setLastSaveTime(Date.now());
      setShowUnsavedDot(false);
    }, 600);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [files]);

  // ---------- Unsaved indicator ----------
  useEffect(() => {
    if (!activeFile) { setShowUnsavedDot(false); return; }
    setShowUnsavedDot(savedFilesMap[activeFile.id] !== activeFile.content);
  }, [files, activeFile, savedFilesMap]);

  const activeFile = files.find(f => f.id === activeFileId);
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ---------- Content search (debounced) ----------
  useEffect(() => {
    if (searchMode !== 'content' || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const results = [];
      files.forEach(f => {
        f.content.split('\n').forEach((line, i) => {
          if (line.toLowerCase().includes(q)) {
            results.push({ fileId: f.id, fileName: f.name, line: i + 1, text: line.trim() });
          }
        });
      });
      setSearchResults(results.slice(0, 50));
    }, 250);
  }, [searchQuery, searchMode, files]);

  // ---------- Code change ----------
  const handleCodeChange = useCallback((newCode) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newCode ?? '' } : f));
  }, [activeFileId]);

  // ---------- Save to phone ----------
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
        showCustomAlert('success', 'Saved!', 'File saved to your phone.');
      } else {
        const blob = new Blob([activeFile.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = activeFile.name;
        a.click();
        URL.revokeObjectURL(url);
        showCustomAlert('success', 'Downloaded!', 'File downloaded.');
      }
    } catch (err) { console.log('Save cancelled', err); }
  };

  // ---------- Export ZIP ----------
  const handleExportZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.name, f.content));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tech-system-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    showCustomAlert('success', 'Exported!', 'Project exported as ZIP.');
  };

  // ---------- Share via URL ----------
  const handleShareUrl = () => {
    if (!activeFile) return;
    try {
      const compressed = LZString.compressToEncodedURIComponent(activeFile.content);
      const url = `${window.location.origin}${window.location.pathname}#code=${compressed}`;
      navigator.clipboard.writeText(url).then(() => {
        showCustomAlert('success', 'Link Copied!', 'Share this URL to load the code.');
      }).catch(() => {
        showCustomAlert('info', 'Share URL', url);
      });
    } catch {
      showCustomAlert('danger', 'Share Failed', 'Could not generate share link.');
    }
  };

  // ---------- Format document ----------
  const handleFormat = async () => {
    if (!activeFile) return;
    try {
      const lang = activeFile.language;
      let parser = 'babel';
      let plugins = [parserBabel];
      if (lang === 'html') { parser = 'html'; plugins = [parserHtml]; }
      else if (lang === 'css') { parser = 'css'; plugins = [parserCss]; }
      else if (lang === 'json') { parser = 'json'; plugins = [parserBabel]; }
      else if (lang === 'markdown') { parser = 'markdown'; plugins = [parserBabel]; }
      else if (lang === 'python') {
        showCustomAlert('info', 'Format', 'Python formatting not supported. Try HTML/CSS/JS/JSON.');
        return;
      }

      const formatted = await prettier.format(activeFile.content, {
        parser,
        plugins,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
      });
      handleCodeChange(formatted);
      showCustomAlert('success', 'Formatted!', `${activeFile.name} formatted successfully.`);
    } catch (err) {
      showCustomAlert('danger', 'Format Failed', err.message || 'Check syntax errors.');
    }
  };

  // ---------- Create new file ----------
  const handleCreateNewFile = () => {
    showCustomAlert('info', 'New File', 'Enter file name (e.g. script.js):', true, (fileName) => {
      if (!fileName) return;
      const newFile = {
        id: Date.now().toString(),
        name: fileName,
        language: getLanguage(fileName),
        content: '// New File\n'
      };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setSidebarOpen(false);
    });
  };

  // ---------- Rename file ----------
  const handleRenameFile = (id) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    setAlertConfig({
      visible: true, type: 'info', title: 'Rename File',
      message: 'Enter new file name:', isPrompt: true, inputValue: file.name,
      onConfirm: (newName) => {
        if (!newName || newName === file.name) return;
        setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, language: getLanguage(newName) } : f));
      }
    });
    setContextMenu(c => ({ ...c, visible: false }));
  };

  // ---------- Delete file ----------
  const handleDeleteFile = (id, e) => {
    e?.stopPropagation();
    showCustomAlert('danger', 'Close File', 'Are you sure? Unsaved changes will be lost.', false, () => {
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      if (newFiles.length > 0) setActiveFileId(newFiles[0].id);
      else setActiveFileId(null);
    });
  };

  // ---------- Import from URL ----------
  const handleImportFromUrl = () => {
    showCustomAlert('info', 'Import from URL', 'Enter file URL:', true, async (url) => {
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const fileName = url.split('/').pop().split('?')[0] || 'imported.txt';
        const newFile = {
          id: Date.now().toString(),
          name: fileName,
          language: getLanguage(fileName),
          content: text
        };
        setFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        setSidebarOpen(false);
        showCustomAlert('success', 'Imported!', `${fileName} loaded from URL.`);
      } catch (err) {
        showCustomAlert('danger', 'Import Failed', err.message);
      }
    });
  };

  // ---------- Clipboard actions ----------
  const handleCut = async () => {
    if (!editorRef.current) return;
    try {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
    } catch { showCustomAlert('danger', 'Cut failed', 'Clipboard denied.'); }
    setContextMenu(c => ({ ...c, visible: false }));
  };
  const handleCopy = async () => {
    if (!editorRef.current) return;
    try {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      showCustomAlert('success', 'Copied!', 'Text copied to clipboard.');
    } catch { showCustomAlert('danger', 'Copy failed', 'Clipboard denied.'); }
    setContextMenu(c => ({ ...c, visible: false }));
  };
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (editorRef.current) editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text }]);
    } catch { showCustomAlert('danger', 'Paste Failed', 'Allow clipboard access.'); }
    setContextMenu(c => ({ ...c, visible: false }));
  };
  const handleSelectAll = () => {
    if (editorRef.current) editorRef.current.setSelection(editorRef.current.getModel().getFullModelRange());
    setContextMenu(c => ({ ...c, visible: false }));
  };
  const handleDeleteSelection = () => {
    if (editorRef.current) editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
    setContextMenu(c => ({ ...c, visible: false }));
  };

  // ---------- Mobile keyboard helpers ----------
  const keepFocus = () => { if (editorRef.current) editorRef.current.focus(); };
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
        edits.push({ range: safeRange(i, 1, i, 1), text: '    ', forceMoveMarkers: true });
      }
      editorRef.current.executeEdits('', edits);
    } else {
      editorRef.current.executeEdits('', [{ range: selection, text: '    ', forceMoveMarkers: true }]);
    }
    keepFocus();
  };

  const handleMobileEnter = () => {
    if (!editorRef.current) return;
    editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '\n', forceMoveMarkers: true }]);
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
      editorRef.current.executeEdits('', [{ range: safeRange(position.lineNumber - 1, prevLineLength, position.lineNumber, 1), text: '' }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
    } else if (position.column > 1) {
      editorRef.current.executeEdits('', [{ range: safeRange(position.lineNumber, position.column - 1, position.lineNumber, position.column), text: '' }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber, column: position.column - 1 });
    } else if (position.lineNumber > 1) {
      const prevLineLength = model.getLineMaxColumn(position.lineNumber - 1);
      editorRef.current.executeEdits('', [{ range: safeRange(position.lineNumber - 1, prevLineLength, position.lineNumber, 1), text: '' }]);
      editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
    }
    keepFocus();
  };

  // ---------- Insert snippet ----------
  const insertSnippet = (text) => {
    if (!editorRef.current) return;
    editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text, forceMoveMarkers: true }]);
    keepFocus();
  };

  // ---------- Editor mount ----------
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
          x: Math.min(coords.left, window.innerWidth - 180),
          y: Math.min(coords.top + 30, window.innerHeight - 260),
          hasSelection,
          fileId: activeFileId
        });
      }
    });
    editor.onMouseDown(() => setContextMenu(c => ({ ...c, visible: false })));

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        editor.layout();
        const pos = editor.getPosition();
        if (pos) editor.revealPositionInCenterIfOutsideViewport(pos);
      });
    }
  };

  // ---------- Preview content ----------
  const getPreviewContent = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    const cssFiles = files.filter(f => f.name.endsWith('.css'));
    const jsFiles = files.filter(f => f.name.endsWith('.js') && !f.name.endsWith('.json'));

    let html = htmlFile ? htmlFile.content : '<h1 style="padding:20px;font-family:sans-serif;">No HTML file found</h1>';
    const css = cssFiles.map(f => `<style>${f.content}</style>`).join('');

    const consoleOverride = `
      <script>
        (function() {
          function post(level, msg) {
            try { window.parent.postMessage({ type: 'CONSOLE_LOG', level, message: msg }, '*'); } catch(e){}
          }
          ['log','warn','error','info'].forEach(function(level) {
            var orig = console[level];
            console[level] = function() {
              var args = Array.prototype.slice.call(arguments);
              var msg = args.map(function(a) {
                if (a === null) return 'null';
                if (a === undefined) return 'undefined';
                if (typeof a === 'object') {
                  try { return JSON.stringify(a); } catch(e) { return String(a); }
                }
                return String(a);
              }).join(' ');
              post(level, msg);
              if (orig) orig.apply(console, arguments);
            };
          });
          window.addEventListener('error', function(e) {
            post('error', 'ERROR: ' + e.message + ' (line ' + e.lineno + ')');
          });
          window.addEventListener('unhandledrejection', function(e) {
            post('error', 'PROMISE: ' + (e.reason && e.reason.message || e.reason));
          });
        })();
      <\/script>
    `;

    const js = jsFiles.map(f => `<script>${f.content}<\/script>`).join('');

    const hasHead = /<\/head>/i.test(html);
    const hasBody = /<\/body>/i.test(html);
    if (hasHead) html = html.replace(/<\/head>/i, `${css}${consoleOverride}</head>`);
    else html = `<head>${css}${consoleOverride}</head>` + html;
    if (hasBody) html = html.replace(/<\/body>/i, `${js}</body>`);
    else html = html + js;
    return html;
  };

  // ---------- Console messages ----------
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [...prev, { level: event.data.level || 'log', message: event.data.message, time: new Date().toLocaleTimeString() }]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') { e.preventDefault(); handleSaveToPhone(); }
      else if (mod && e.key === 'Enter') { e.preventDefault(); setShowPreview(p => !p); setConsoleLogs([]); }
      else if (mod && e.shiftKey && (e.key === 'P' || e.key === 'p')) { e.preventDefault(); setShowCommandPalette(p => !p); }
      else if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); handleFormat(); }
      else if (mod && (e.key === 'n' || e.key === 'N') && e.shiftKey) { e.preventDefault(); handleCreateNewFile(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [activeFile]);

  // ---------- Commands ----------
  const commands = useMemo(() => [
    { id: 'new', label: 'New File', icon: <FiPlus />, action: handleCreateNewFile },
    { id: 'format', label: 'Format Document', icon: <FiAlignLeft />, action: handleFormat },
    { id: 'save', label: 'Save to Phone', icon: <FiSave />, action: handleSaveToPhone },
    { id: 'export', label: 'Export Project ZIP', icon: <FiDownloadCloud />, action: handleExportZip },
    { id: 'share', label: 'Share via URL', icon: <FiShare2 />, action: handleShareUrl },
    { id: 'import', label: 'Import from URL', icon: <FiLink />, action: handleImportFromUrl },
    { id: 'preview', label: 'Toggle Preview', icon: <FiPlay />, action: () => { setShowPreview(p => !p); setConsoleLogs([]); } },
    { id: 'theme', label: 'Toggle Theme', icon: <FiSun />, action: () => setTheme(t => t === 'vs-dark' ? 'vs-light' : 'vs-dark') },
    { id: 'settings', label: 'Open Settings', icon: <FiSettings />, action: () => setShowSettings(true) },
    { id: 'find', label: 'Find in File', icon: <FiSearch />, action: () => editorRef.current?.getAction('actions.find')?.run() },
    { id: 'undo', label: 'Undo', icon: <FiChevronsLeft />, action: () => { editorRef.current?.trigger('keyboard', 'undo'); keepFocus(); } },
    { id: 'redo', label: 'Redo', icon: <FiChevronsRight />, action: () => { editorRef.current?.trigger('keyboard', 'redo'); keepFocus(); } },
  ], [activeFile]);

  const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(commandQuery.toLowerCase()));

  const runCommand = (cmd) => {
    setShowCommandPalette(false);
    setCommandQuery('');
    cmd.action();
  };

  // ---------- Time ago ----------
  const timeAgo = (t) => {
    if (!t) return 'never';
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className={`app-container ${theme === 'vs-light' ? 'light-mode' : ''}`}>
      {/* TOP BAR */}
      <header className="top-bar">
        <div className="logo">
          <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
            <FiMenu size={20} />
          </button>
          <FiCode size={20} className="logo-icon" />
          <h1>Tech System</h1>
          {!online && <FiWifiOff size={14} style={{ color: '#ef4444' }} title="Offline" />}
        </div>
        <div className="actions">
          <button className="icon-btn bg-transparent" onClick={() => setShowCommandPalette(true)} title="Command Palette">
            <FiCommand size={18} />
          </button>
          <button className="icon-btn bg-transparent" onClick={() => setTheme(theme === 'vs-dark' ? 'vs-light' : 'vs-dark')} title="Theme">
            {theme === 'vs-dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
          </button>
          <button className="icon-btn bg-transparent" onClick={() => setShowSettings(true)} title="Settings">
            <FiSettings size={18} />
          </button>
          <button className="icon-btn bg-transparent" onClick={() => { setShowPreview(!showPreview); setConsoleLogs([]); }} title="Preview">
            <FiPlay size={18} />
          </button>
          <button className="icon-btn" onClick={handleSaveToPhone} title="Save">
            <FiSave size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <span><FiFolder size={14} /> Explorer</span>
            <button onClick={handleCreateNewFile} className="new-file-btn" aria-label="New File"><FiPlus size={16} /></button>
          </div>

          <div className="sidebar-search">
            <FiSearch size={14} />
            <input
              type="text"
              placeholder={searchMode === 'name' ? 'Search files...' : 'Search in files...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="search-mode-toggle"
              onClick={() => setSearchMode(m => m === 'name' ? 'content' : 'name')}
              title={searchMode === 'name' ? 'Search in content' : 'Search by name'}
            >
              {searchMode === 'name' ? '📄' : '🔍'}
            </button>
          </div>

          <div className="sidebar-actions">
            <button onClick={() => fileInputRef.current.click()}>
              <FiUpload size={14} /> Open from Phone
            </button>
            <button onClick={handleImportFromUrl}>
              <FiLink size={14} /> Import from URL
            </button>
            <button onClick={handleExportZip} className="export-btn">
              <FiDownloadCloud size={14} /> Export ZIP
            </button>
            <button onClick={handleShareUrl} className="share-btn">
              <FiShare2 size={14} /> Share Code
            </button>
            <input type="file" ref={fileInputRef} onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => {
                const newFile = { id: Date.now().toString(), name: file.name, language: getLanguage(file.name), content: event.target.result };
                setFiles(prev => [...prev, newFile]);
                setActiveFileId(newFile.id);
                setSidebarOpen(false);
                showCustomAlert('success', 'File Opened', `${file.name} loaded!`);
              };
              reader.readAsText(file);
              e.target.value = null;
            }} style={{ display: 'none' }} accept=".js,.jsx,.ts,.tsx,.html,.css,.json,.py,.md,.txt" />
          </div>

          {/* SEARCH RESULTS (content mode) */}
          {searchMode === 'content' && searchResults.length > 0 && (
            <div className="search-results">
              <div className="search-results-header">{searchResults.length} result(s)</div>
              {searchResults.map((r, i) => (
                <div key={i} className="search-result-item" onClick={() => {
                  setActiveFileId(r.fileId);
                  setSidebarOpen(false);
                  setTimeout(() => {
                    if (editorRef.current) {
                      editorRef.current.revealLineInCenter(r.line);
                      editorRef.current.setPosition({ lineNumber: r.line, column: 1 });
                      keepFocus();
                    }
                  }, 100);
                }}>
                  <div className="sr-file">{r.fileName}:{r.line}</div>
                  <div className="sr-text">{r.text.slice(0, 60)}{r.text.length > 60 ? '...' : ''}</div>
                </div>
              ))}
            </div>
          )}

          {/* FILE LIST */}
          <ul className="file-list">
            {filteredFiles.map(file => (
              <li
                key={file.id}
                className={activeFileId === file.id ? 'active' : ''}
                onClick={() => { setActiveFileId(file.id); setSidebarOpen(false); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ visible: true, x: e.clientX, y: e.clientY, hasSelection: false, fileId: file.id });
                }}
              >
                <span className="file-icon">{getFileIcon(file.name)}</span>
                <span className="file-name">{file.name}</span>
                <button className="rename-btn" onClick={(e) => { e.stopPropagation(); handleRenameFile(file.id); }} aria-label="Rename">
                  <FiEdit2 size={12} />
                </button>
                <button className="close-tab-btn" onClick={(e) => handleDeleteFile(file.id, e)} aria-label="Close">
                  <FiX size={14} />
                </button>
              </li>
            ))}
            {filteredFiles.length === 0 && (
              <li className="empty-files">No files match</li>
            )}
          </ul>
        </aside>

        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)}></div>}

        {/* EDITOR */}
        <section className="editor-section">
          {activeFile ? (
            <>
              <div className="editor-header">
                <span className="file-icon-small">{getFileIcon(activeFile.name)}</span>
                <span>{activeFile.name}</span>
                {showUnsavedDot && <span className="unsaved-dot" title="Unsaved">●</span>}
                <span className="editor-actions">
                  <button onClick={() => editorRef.current?.trigger('keyboard', 'undo')} title="Undo"><FiChevronsLeft size={14} /></button>
                  <button onClick={() => editorRef.current?.trigger('keyboard', 'redo')} title="Redo"><FiChevronsRight size={14} /></button>
                  <button onClick={() => editorRef.current?.getAction('actions.find')?.run()} title="Find"><FiSearch size={14} /></button>
                  <button onClick={handleFormat} title="Format"><FiAlignLeft size={14} /></button>
                </span>
              </div>
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
                    autoIndent: 'keep',
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
                    padding: { top: 8, bottom: 120 },
                    fixedOverflowWidgets: true,
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    renderLineHighlight: 'all',
                    renderWhitespace: 'selection',
                    find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'always' },
                    snippetSuggestions: 'inline',
                    tabCompletion: 'on',
                  }}
                />
              </div>

              {/* MOBILE KEYBOARD TOOLBAR */}
              <div className="mobile-keyboard-toolbar">
                <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                  onClick={() => { editorRef.current?.trigger('keyboard', 'undo'); keepFocus(); }} aria-label="Undo"><FiChevronsLeft /></button>
                <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileTab}>Tab</button>
                <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileEnter} aria-label="Enter"><FiCornerDownLeft /></button>
                <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileDelete} className="delete-btn" aria-label="Delete"><FiDelete /></button>
                <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                  onClick={() => editorRef.current?.trigger('keyboard', 'redo')} aria-label="Redo"><FiChevronsRight /></button>
              </div>

              {/* QUICK SNIPPET BAR */}
              <div className="snippet-bar">
                {['()', '{}', '[]', '""', "''", ';', '=>', '${}', '/* */', '//'].map(s => (
                  <button key={s} onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                    onClick={() => insertSnippet(s)}>{s}</button>
                ))}
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

        {/* PREVIEW */}
        {showPreview && (
          <div className="preview-panel">
            <div className="preview-header">
              <span>Live Preview</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowConsole(!showConsole)} style={{ fontSize: '0.8rem' }}>
                  <FiTerminal /> Console {consoleLogs.length > 0 && <span className="console-badge">{consoleLogs.length}</span>}
                </button>
                <button onClick={() => setShowPreview(false)}><FiX size={14} /></button>
              </div>
            </div>
            <iframe
              title="preview"
              srcDoc={getPreviewContent()}
              className="preview-iframe"
              sandbox="allow-scripts allow-modals allow-forms"
            />
            {showConsole && (
              <div className="console-panel">
                <div className="console-header">
                  <span>Console ({consoleLogs.length})</span>
                  <button onClick={() => setConsoleLogs([])}>Clear</button>
                </div>
                <div className="console-output">
                  {consoleLogs.length === 0 ? (
                    <span style={{ color: '#64748b' }}>No logs yet...</span>
                  ) : consoleLogs.map((log, i) => (
                    <div key={i} className="log-line" style={{ color: logColor(log.level) }}>
                      <span className="log-time">{log.time}</span>
                      <span className="log-level">[{log.level}]</span>
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.fileId && !contextMenu.hasSelection && (
            <>
              <button onClick={() => handleRenameFile(contextMenu.fileId)}><FiEdit2 size={14} /> Rename</button>
              <button onClick={() => { handleDeleteFile(contextMenu.fileId); setContextMenu(c => ({ ...c, visible: false })); }} className="text-red"><FiX size={14} /> Delete</button>
            </>
          )}
          {contextMenu.hasSelection && (
            <>
              <button onClick={handleCut}><FiScissors size={14} /> Cut</button>
              <button onClick={handleCopy}><FiCopy size={14} /> Copy</button>
              <button onClick={handleDeleteSelection} className="text-red"><FiX size={14} /> Delete</button>
            </>
          )}
          {!contextMenu.fileId && <button onClick={handlePaste}><FiClipboard size={14} /> Paste</button>}
          <button onClick={handleSelectAll}><FiCode size={14} /> Select All</button>
        </div>
      )}

      {/* COMMAND PALETTE */}
      {showCommandPalette && (
        <div className="modal-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette" onClick={e => e.stopPropagation()}>
            <div className="cp-input-wrap">
              <FiSearch size={16} />
              <input
                type="text"
                placeholder="Type a command..."
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                autoFocus
              />
              <FiX size={16} style={{ cursor: 'pointer' }} onClick={() => setShowCommandPalette(false)} />
            </div>
            <div className="cp-list">
              {filteredCommands.length === 0 ? (
                <div className="cp-empty">No commands match</div>
              ) : filteredCommands.map(cmd => (
                <button key={cmd.id} className="cp-item" onClick={() => runCommand(cmd)}>
                  {cmd.icon} <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALERT */}
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
                type="text" className="alert-input" placeholder="filename.js"
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

      {/* SETTINGS */}
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

      {/* STATUS BAR */}
      <footer className="status-bar">
        <div className="status-left">
          <span>{activeFile?.language?.toUpperCase() || 'TXT'}</span>
          {!online && <span className="status-offline">● Offline</span>}
        </div>
        <div className="status-right">
          {lastSaveTime && <span><FiClock size={10} /> Saved {timeAgo(lastSaveTime)}</span>}
          <span>UTF-8</span>
          <span>Tech System</span>
        </div>
      </footer>
    </div>
  );
}

export default App;