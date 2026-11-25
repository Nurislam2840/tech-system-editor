import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import localforage from 'localforage';
import JSZip from 'jszip';
import LZString from 'lz-string';
import * as prettier from 'prettier/standalone';
import * as parserHtml from 'prettier/plugins/html';
import * as parserCss from 'prettier/plugins/postcss';
import * as parserBabel from 'prettier/plugins/babel';
import * as parserEstree from 'prettier/plugins/estree';
import {
  FiCode, FiSave, FiFolder, FiMenu, FiPlus, FiUpload,
  FiX, FiPlay, FiSettings, FiCheckCircle, FiAlertCircle,
  FiDelete, FiCornerDownLeft, FiChevronsLeft, FiChevronsRight,
  FiSun, FiMoon, FiSearch, FiDownloadCloud, FiCopy, FiScissors,
  FiClipboard, FiTerminal, FiEdit2, FiAlignLeft, FiLink,
  FiWifiOff, FiShare2, FiClock, FiCommand, FiCheck, FiMaximize2,
  FiMinimize2, FiMonitor, FiSmartphone, FiTablet,
  FiZap, FiFileText, FiTrash2
} from 'react-icons/fi';
import './App.css';

// ---------- Constants ----------
const FONT_MIN = 12;
const FONT_MAX = 24;
const DEFAULT_FONT = 14;

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
  if (n.endsWith('.c') || n.endsWith('.cpp') || n.endsWith('.h')) return '⚙️';
  if (n.endsWith('.java')) return '☕';
  if (n.endsWith('.php')) return '🐘';
  if (n.endsWith('.sql')) return '🗄️';
  if (n.endsWith('.xml')) return '📜';
  return '📄';
};

const getLanguage = (name) => {
  const ext = name.split('.').pop().toLowerCase();
  const langMap = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
    php: 'php', rb: 'ruby', go: 'go', rs: 'rust', swift: 'swift',
    kt: 'kotlin', sql: 'sql', sh: 'shell', bash: 'shell', ps1: 'powershell',
    json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml', md: 'markdown',
    dockerfile: 'dockerfile', r: 'r', lua: 'lua', dart: 'dart', scala: 'scala',
    pl: 'perl', asm: 'assembly', bat: 'bat', graphql: 'graphql', vue: 'html',
    svelte: 'html', txt: 'plaintext'
  };
  return langMap[ext] || 'plaintext';
};

const logColor = (level) => {
  switch (level) {
    case 'error': return '#ef4444';
    case 'warn': return '#f59e0b';
    case 'info': return '#38bdf8';
    default: return '#4ade80';
  }
};

const escapeHTML = (str) => {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

function App() {
  // ==========================================
  // ১. স্টেট ডিক্লারেশন (States)
  // ==========================================
  const [theme, setTheme] = useState('tech-dark');
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [recentCommands, setRecentCommands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState('name');
  const [searchResults, setSearchResults] = useState([]);
  const [savedFilesMap, setSavedFilesMap] = useState({});
  const [online, setOnline] = useState(navigator.onLine);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [showUnsavedDot, setShowUnsavedDot] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [selectionInfo, setSelectionInfo] = useState({ count: 0 });
  const [zenMode, setZenMode] = useState(false);
  const [previewDevice, setPreviewDevice] = useState('mobile');
  const [logFilter, setLogFilter] = useState('all');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [draggedFileId, setDraggedFileId] = useState(null);
  const [showAiPlaceholder, setShowAiPlaceholder] = useState(false);

  const [consoleLogs, setConsoleLogs] = useState([]);
  const [showConsole, setShowConsole] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false, type: 'success', title: '', message: '',
    isPrompt: false, inputValue: '', onConfirm: null
  });

  const [contextMenu, setContextMenu] = useState({
    visible: false, x: 0, y: 0, hasSelection: false,
    fileId: null, selectionText: ''
  });

  // PWA Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // ==========================================
  // ২. রেফারেন্স (Refs)
  // ==========================================
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const saveTimerRef = useRef(null);
  const searchTimerRef = useRef(null);
  const savedIndicatorTimerRef = useRef(null);

  // ==========================================
  // ৩. হেল্পার ফাংশন (Helper Functions)
  // ==========================================
  const showCustomAlert = useCallback((type, title, message, isPrompt = false, onConfirm = null, defaultValue = '') => {
    setAlertConfig({ visible: true, type, title, message, isPrompt, inputValue: defaultValue, onConfirm });
  }, []);
  
  const closeAlert = useCallback(() => setAlertConfig(prev => ({ ...prev, visible: false })), []);

  const activeFile = files.find(f => f.id === activeFileId);
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ==========================================
  // ৪. ইউজ ইফেক্ট (useEffect Hooks)
  // ==========================================
  
  // সেটিংস লোড করা
  useEffect(() => {
    const loadSettings = async () => {
      const savedTheme = await localforage.getItem('techSystemTheme');
      const savedFontSize = await localforage.getItem('techSystemFontSize');
      const savedRecent = await localforage.getItem('techSystemRecentCmds');
      if (savedTheme) setTheme(savedTheme);
      if (savedFontSize) setFontSize(Number(savedFontSize));
      if (savedRecent && Array.isArray(savedRecent)) setRecentCommands(savedRecent);
    };
    loadSettings();
  }, []);

  // সেটিংস সেভ করা
  useEffect(() => { localforage.setItem('techSystemTheme', theme); }, [theme]);
  useEffect(() => { localforage.setItem('techSystemFontSize', fontSize); }, [fontSize]);
  useEffect(() => { localforage.setItem('techSystemRecentCmds', recentCommands); }, [recentCommands]);

  // অনলাইন/অফলাইন স্ট্যাটাস
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // PWA ইন্সটল প্রম্পট হ্যান্ডলিং
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowInstallBanner(true), 5000); // ৫ সেকেন্ড পর দেখাবে
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // ফাইল লোড করা (URL বা লোকাল স্টোরেজ থেকে)
  useEffect(() => {
    const load = async () => {
      const hash = window.location.hash;
      if (hash.startsWith('#code=')) {
        try {
          const decoded = LZString.decompressFromEncodedURIComponent(hash.slice(6));
          if (decoded) {
            const urlFile = { id: 'url-' + Date.now(), name: 'shared.html', language: 'html', content: decoded };
            setFiles([urlFile]);
            setActiveFileId(urlFile.id);
            showCustomAlert('success', 'Imported from URL', 'Shared code loaded successfully.');
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
          { id: '1', name: 'index.html', language: 'html', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n</head>\n<body>\n  <h1 style="color: #38bdf8;">Hello CodeX!</h1>\n  <button onclick="testLog()">Click Me</button>\n</body>\n</html>' },
          { id: '2', name: 'style.css', language: 'css', content: 'body {\n    background: #0f172a;\n    color: white;\n    font-family: "Outfit", sans-serif;\n    padding: 20px;\n}' },
          { id: '3', name: 'app.js', language: 'javascript', content: 'console.log("App Running...");\n\nfunction testLog() {\n    console.log("Button clicked at: " + new Date().toLocaleTimeString());\n}' }
        ];
        setFiles(defaults);
        setActiveFileId('1');
        const map = {};
        defaults.forEach(f => map[f.id] = f.content);
        setSavedFilesMap(map);
      }
    };
    load();
  }, [showCustomAlert]);

  // অটো সেভ (Localforage)
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

  // আনসেভড ডট ইন্ডিকেটর
  useEffect(() => {
    if (!activeFile) { setShowUnsavedDot(false); return; }
    setShowUnsavedDot(savedFilesMap[activeFile.id] !== activeFile.content);
  }, [files, activeFile, savedFilesMap]);

  // কন্টেন্ট সার্চ (ফাইলের ভেতরে)
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

  // গ্লোবাল কী-বোর্ড শর্টকাট
  useEffect(() => {
    const handler = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') { e.preventDefault(); handleSaveToPhone(); }
      else if (mod && e.key === 'Enter') { e.preventDefault(); setShowPreview(p => !p); setConsoleLogs([]); }
      else if (mod && e.shiftKey && (e.key === 'P' || e.key === 'p')) { e.preventDefault(); setShowCommandPalette(p => !p); }
      else if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) { e.preventDefault(); handleFormat(); }
      else if (mod && e.shiftKey && (e.key === 'N' || e.key === 'n')) { e.preventDefault(); handleCreateNewFile(); }
      else if (mod && e.key === '/') { e.preventDefault(); setShowShortcuts(s => !s); }
      else if (e.key === 'Escape') {
        setShowShortcuts(false);
        setShowCommandPalette(false);
        setContextMenu(c => ({ ...c, visible: false }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveToPhone, handleFormat, handleCreateNewFile]);

  // ==========================================
  // ৫. হ্যান্ডলার ফাংশন (Handlers)
  // ==========================================
  
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleCodeChange = useCallback((newCode) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newCode ?? '' } : f));
  }, [activeFileId]);

  const flashSaved = () => {
    setJustSaved(true);
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    savedIndicatorTimerRef.current = setTimeout(() => setJustSaved(false), 1500);
  };

  // ফাইল ফোনে সেভ করা (Base64 পদ্ধতি, .json সমস্যা ফিক্স)
  const handleSaveToPhone = useCallback(async () => {
    if (!activeFile) return;
    
    const fileName = activeFile.name;
    const ext = fileName.split('.').pop().toLowerCase();

    let mimeType = 'text/plain';
    if (ext === 'html' || ext === 'htm') mimeType = 'text/html';
    else if (ext === 'css') mimeType = 'text/css';
    else if (ext === 'js' || ext === 'jsx') mimeType = 'application/javascript';
    else if (ext === 'json') mimeType = 'application/json';
    else if (ext === 'xml') mimeType = 'application/xml';

    try {
      if ('showSaveFilePicker' in window && window.isSecureContext) {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'Code Files', accept: { [mimeType]: ['.' + ext] } }],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(activeFile.content);
          await writable.close();
          showCustomAlert('success', 'Saved!', 'File saved to your phone.');
          flashSaved();
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      // মোবাইলের জন্য Base64 Data URI
      const base64Content = btoa(unescape(encodeURIComponent(activeFile.content)));
      const dataUri = `data:${mimeType};base64,${base64Content}`;
      
      const a = document.createElement('a');
      a.href = dataUri;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => { document.body.removeChild(a); }, 100);

      showCustomAlert('success', 'Downloaded!', `${fileName} saved successfully.`);
      flashSaved();

    } catch (error) {
      showCustomAlert('danger', 'Save Failed', 'Could not save file.');
    }
  }, [activeFile, showCustomAlert]);

  const handleExportZip = async () => {
    const zip = new JSZip();
    files.forEach(f => zip.file(f.name, f.content));
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codex-project.zip';
    a.click();
    URL.revokeObjectURL(url);
    showCustomAlert('success', 'Exported!', 'Project exported as ZIP archive.');
  };

  const handleExportSingleHTML = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    if (!htmlFile) { showCustomAlert('danger', 'No HTML', 'No HTML file to export.'); return; }
    const css = files.filter(f => f.name.endsWith('.css')).map(f => `<style>\n${f.content}\n</style>`).join('\n');
    const js = files.filter(f => f.name.endsWith('.js')).map(f => `<script>\n${f.content}\n<\/script>`).join('\n');
    let html = htmlFile.content;
    if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `${css}</head>`);
    else html = `<head>${css}</head>` + html;
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${js}</body>`);
    else html += js;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'single-file.html';
    a.click();
    URL.revokeObjectURL(url);
    showCustomAlert('success', 'Exported!', 'Single HTML file generated.');
  };

  const handleShareUrl = () => {
    if (!activeFile) return;
    try {
      const compressed = LZString.compressToEncodedURIComponent(activeFile.content);
      const url = `${window.location.origin}${window.location.pathname}#code=${compressed}`;
      navigator.clipboard.writeText(url).then(() => {
        showCustomAlert('success', 'Link Copied!', 'Share this URL to load the code.');
      }).catch(() => { showCustomAlert('info', 'Share URL', url); });
    } catch {
      showCustomAlert('danger', 'Share Failed', 'Could not generate share link.');
    }
  };

  const handleFormat = useCallback(async () => {
    if (!activeFile) return;
    try {
      const lang = activeFile.language;
      let parser = 'babel';
      let plugins = [parserBabel, parserEstree];
      if (lang === 'html') { parser = 'html'; plugins = [parserHtml]; }
      else if (lang === 'css') { parser = 'css'; plugins = [parserCss]; }
      else if (lang === 'json') { parser = 'json'; plugins = [parserBabel, parserEstree]; }
      else if (lang === 'markdown') { parser = 'markdown'; plugins = [parserBabel, parserEstree]; }
      else if (lang === 'xml') { showCustomAlert('info', 'Formatting', 'XML auto-formatting is not supported yet.'); return; }
      else if (!['javascript', 'typescript'].includes(lang)) {
        showCustomAlert('info', 'Formatting', 'Auto-formatting is best supported for HTML, CSS, JS, JSON.');
        return;
      }
      const formatted = await prettier.format(activeFile.content, { parser, plugins, tabWidth: 4, singleQuote: true, semi: true });
      handleCodeChange(formatted);
      showCustomAlert('success', 'Formatted!', `${activeFile.name} formatted successfully.`);
    } catch (err) {
      showCustomAlert('danger', 'Format Failed', err.message || 'Check syntax errors.');
    }
  }, [activeFile, handleCodeChange, showCustomAlert]);

  const handleCreateNewFile = useCallback(() => {
    showCustomAlert('info', 'New File', 'Enter file name (e.g. script.py):', true, (fileName) => {
      if (!fileName) return;
      const newFile = { id: Date.now().toString(), name: fileName, language: getLanguage(fileName), content: '' };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setSidebarOpen(false);
    });
  }, [showCustomAlert]);

  const handleRenameFile = useCallback((id) => {
    const file = files.find(f => f.id === id);
    if (!file) return;
    showCustomAlert('info', 'Rename File', 'Enter new file name:', true, (newName) => {
      if (!newName || newName === file.name) return;
      setFiles(prev => prev.map(f => f.id === id ? { ...f, name: newName, language: getLanguage(newName) } : f));
    }, file.name);
    setContextMenu(c => ({ ...c, visible: false }));
  }, [files, showCustomAlert]);

  const handleDeleteFile = (id, e) => {
    e?.stopPropagation();
    showCustomAlert('danger', 'Close File', 'Are you sure? Unsaved changes will be lost.', false, () => {
      const newFiles = files.filter(f => f.id !== id);
      setFiles(newFiles);
      if (newFiles.length > 0) setActiveFileId(newFiles[0].id);
      else setActiveFileId(null);
    });
  };

  const handleImportFromUrl = () => {
    showCustomAlert('info', 'Import from URL', 'Enter file URL:', true, async (url) => {
      if (!url) return;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const fileName = url.split('/').pop().split('?')[0] || 'imported.txt';
        const newFile = { id: Date.now().toString(), name: fileName, language: getLanguage(fileName), content: text };
        setFiles(prev => [...prev, newFile]);
        setActiveFileId(newFile.id);
        setSidebarOpen(false);
        showCustomAlert('success', 'Imported!', `${fileName} loaded from URL.`);
      } catch (err) {
        showCustomAlert('danger', 'Import Failed', err.message);
      }
    });
  };

  const handleImportFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) { showCustomAlert('info', 'Clipboard Empty', 'No text found.'); return; }
      const newFile = { id: Date.now().toString(), name: `clipboard-${Date.now()}.txt`, language: 'plaintext', content: text };
      setFiles(prev => [...prev, newFile]);
      setActiveFileId(newFile.id);
      setSidebarOpen(false);
      showCustomAlert('success', 'Imported!', 'Clipboard content added.');
    } catch {
      showCustomAlert('danger', 'Import Failed', 'Allow clipboard access.');
    }
  };

  // কপি/পেস্ট হ্যান্ডলার
  const handleCut = async () => {
    if (contextMenu.selectionText) {
      try {
        await navigator.clipboard.writeText(contextMenu.selectionText);
        if (editorRef.current) editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
      } catch { showCustomAlert('danger', 'Cut failed', 'Clipboard denied.'); }
    }
    setContextMenu(c => ({ ...c, visible: false }));
  };

  const handleCopy = async () => {
    if (contextMenu.selectionText) {
      try {
        await navigator.clipboard.writeText(contextMenu.selectionText);
        showCustomAlert('success', 'Copied!', 'Text copied.');
      } catch { showCustomAlert('danger', 'Copy failed', 'Clipboard denied.'); }
    }
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

  // মোবাইল কিবোর্ড হেল্পার
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
    const model = editorRef.current.getModel();
    const position = editorRef.current.getPosition();
    if (!model || !position) return;
    const lineContent = model.getLineContent(position.lineNumber);
    const textBeforeCursor = lineContent.substring(0, position.column - 1);
    const match = textBeforeCursor.match(/^(\s*)/);
    const indentation = match ? match[0] : '';
    editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '\n' + indentation, forceMoveMarkers: true }]);
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

  const insertSnippet = (text) => {
    if (!editorRef.current) return;
    editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text, forceMoveMarkers: true }]);
    keepFocus();
  };

  // ==========================================
  // ৬. এডিটর মাউন্ট এবং থিম সেটআপ (Monaco Editor)
  // ==========================================
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // নতুন প্রিমিয়াম কালার থিম (CodeX Palette)
    monaco.editor.defineTheme('tech-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'E2E8F0' },
        { token: 'identifier', foreground: 'E2E8F0' },
        { token: 'delimiter', foreground: '94A3B8' },
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },

        // HTML
        { token: 'tag', foreground: 'F472B6' },
        { token: 'metatag', foreground: 'F472B6' },
        { token: 'attribute.name', foreground: 'FBBF24' },
        { token: 'attribute.value', foreground: '34D399' },
        { token: 'delimiter.html', foreground: '38BDF8' },

        // CSS
        { token: 'attribute.name.css', foreground: 'F472B6' },
        { token: 'attribute.value.css', foreground: '34D399' },
        { token: 'attribute.value.number.css', foreground: 'FB923C' },
        { token: 'attribute.value.unit.css', foreground: 'FB923C' },
        { token: 'attribute.value.hex.css', foreground: '38BDF8' },
        { token: 'tag.css', foreground: 'A78BFA' },

        // JS
        { token: 'keyword', foreground: 'A78BFA' },
        { token: 'keyword.control', foreground: 'A78BFA' },
        { token: 'function', foreground: '60A5FA' },
        { token: 'variable', foreground: '38BDF8' },
        { token: 'variable.predefined', foreground: '38BDF8' },
        { token: 'string', foreground: '34D399' },
        { token: 'number', foreground: 'FB923C' },
        { token: 'type', foreground: 'FBBF24' },
        { token: 'class', foreground: 'FBBF24' },
        { token: 'operator', foreground: '38BDF8' },
      ],
      colors: {
        'editor.background': '#0B1120',
        'editor.foreground': '#E2E8F0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38BDF8',
        'editor.selectionBackground': '#334155',
        'editor.inactiveSelectionBackground': '#1E293B',
        'editor.lineHighlightBackground': '#1E293B',
        'editor.lineHighlightBorder': '#334155',
        'editorCursor.foreground': '#38BDF8',
        'editorIndentGuide.background': '#1E293B',
        'editorIndentGuide.activeBackground': '#334155',
        'editorBracketMatch.background': '#334155',
        'editorBracketMatch.border': '#38BDF8',
      }
    });

    editor.onDidChangeCursorPosition((e) => setCursorPos({ line: e.position.lineNumber, col: e.position.column }));
    editor.onDidChangeCursorSelection((e) => {
      const model = editor.getModel();
      if (!model) return;
      const sel = e.selection;
      if (sel && !sel.isEmpty()) setSelectionInfo({ count: model.getValueInRange(sel).length });
      else setSelectionInfo({ count: 0 });
    });

    // কাস্টম কনটেক্সট মেনু লজিক
    const openContextMenu = (e, forceSelection = false) => {
      if (e && e.event) e.event.preventDefault();
      const selection = editor.getSelection();
      const model = editor.getModel();
      const hasSelection = forceSelection || (selection && !selection.isEmpty());
      const selectedText = hasSelection && model ? model.getValueInRange(selection) : '';
      
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;

      if (e && e.event && e.event.posx !== undefined) {
        x = e.event.posx;
        y = e.event.posy;
      } else {
        const position = editor.getPosition();
        if (position) {
          const coords = editor.getScrolledVisiblePosition(position);
          if (coords) { x = coords.left; y = coords.top + 30; }
        }
      }

      setContextMenu({
        visible: true,
        x: Math.max(10, Math.min(x, window.innerWidth - 200)),
        y: Math.max(10, Math.min(y, window.innerHeight - 260)),
        hasSelection, fileId: null, selectionText: selectedText
      });
    };

    editor.onContextMenu((e) => openContextMenu(e, false));

    let touchTimer;
    editor.onMouseDown((e) => {
      setContextMenu(c => ({ ...c, visible: false }));
      if (e.event.browserEvent && e.event.browserEvent.pointerType === 'touch') {
        touchTimer = setTimeout(() => {
          if (editor.getSelection() && !editor.getSelection().isEmpty()) openContextMenu(null, true);
        }, 600);
      }
    });
    editor.onMouseUp(() => { if (touchTimer) clearTimeout(touchTimer); });
    editor.onMouseMove(() => { if (touchTimer) clearTimeout(touchTimer); });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        editor.layout();
        const pos = editor.getPosition();
        if (pos) editor.revealPositionInCenterIfOutsideViewport(pos);
      });
    }
  };

  // ==========================================
  // ৭. প্রিভিউ কন্টেন্ট জেনারেটর
  // ==========================================
  const getPreviewContent = useCallback(() => {
    if (activeFile?.language === 'xml' || activeFile?.name.endsWith('.xml')) {
      return `<!DOCTYPE html>
        <html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',sans-serif;padding:20px;margin:0}
          .xml-container{background:#161b22;border-radius:12px;padding:16px;box-shadow:0 4px 20px rgba(0,0,0,.5);overflow-x:auto;border:1px solid #30363d}
          .xml-code{font-family:'Courier New',monospace;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word;color:#38bdf8}
          .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #30363d}
          .header h2{margin:0;font-size:18px;color:#94a3b8;font-weight:500}
          .header .status{font-size:12px;background:rgba(34,197,94,.2);color:#4ade80;padding:4px 10px;border-radius:20px}
        </style></head>
        <body><div class="header"><h2>📜 XML Live Preview</h2><span class="status">Rendered</span></div>
        <div class="xml-container"><pre class="xml-code">${escapeHTML(activeFile.content)}</pre></div></body></html>`;
    }

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
                if (typeof a === 'object') { try { return JSON.stringify(a); } catch(e) { return String(a); } }
                return String(a);
              }).join(' ');
              post(level, msg);
              if (orig) orig.apply(console, arguments);
            };
          });
          window.addEventListener('error', function(e) { post('error', 'ERROR: ' + e.message + ' (line ' + e.lineno + ')'); });
          window.addEventListener('unhandledrejection', function(e) { post('error', 'PROMISE: ' + (e.reason && e.reason.message || e.reason)); });
        })();
      <\/script>`;
    const js = jsFiles.map(f => `<script>${f.content}<\/script>`).join('');

    const hasHead = /<\/head>/i.test(html);
    const hasBody = /<\/body>/i.test(html);
    if (hasHead) html = html.replace(/<\/head>/i, `${css}${consoleOverride}</head>`);
    else html = `<head>${css}${consoleOverride}</head>` + html;
    if (hasBody) html = html.replace(/<\/body>/i, `${js}</body>`);
    else html = html + js;
    return html;
  }, [activeFile, files]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'CONSOLE_LOG') {
        setConsoleLogs(prev => [...prev, { level: event.data.level || 'log', message: event.data.message, time: new Date().toLocaleTimeString() }]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ==========================================
  // ৮. কমান্ড প্যালেট ও অন্যান্য সেটআপ
  // ==========================================
  const handleZenToggle = () => setZenMode(z => !z);
  const handlePreviewDevice = (device) => setPreviewDevice(device);
  const previewWidth = previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '100%';

  const commands = useMemo(() => [
    { id: 'new', label: 'New File', icon: <FiPlus />, action: handleCreateNewFile },
    { id: 'format', label: 'Format Document', icon: <FiAlignLeft />, action: handleFormat },
    { id: 'save', label: 'Save to Phone', icon: <FiSave />, action: handleSaveToPhone },
    { id: 'export', label: 'Export Project ZIP', icon: <FiDownloadCloud />, action: handleExportZip },
    { id: 'export-html', label: 'Export Single HTML', icon: <FiFileText />, action: handleExportSingleHTML },
    { id: 'share', label: 'Share via URL', icon: <FiShare2 />, action: handleShareUrl },
    { id: 'import', label: 'Import from URL', icon: <FiLink />, action: handleImportFromUrl },
    { id: 'import-clip', label: 'Import from Clipboard', icon: <FiClipboard />, action: handleImportFromClipboard },
    { id: 'preview', label: 'Toggle Preview', icon: <FiPlay />, action: () => { setShowPreview(p => !p); setConsoleLogs([]); } },
    { id: 'theme', label: 'Toggle Theme', icon: <FiSun />, action: () => setTheme(t => t === 'tech-dark' ? 'vs-light' : 'tech-dark') },
    { id: 'settings', label: 'Open Settings', icon: <FiSettings />, action: () => setShowSettings(true) },
    { id: 'shortcuts', label: 'Show Shortcuts', icon: <FiCommand />, action: () => setShowShortcuts(true) },
    { id: 'zen', label: 'Toggle Zen Mode', icon: <FiMaximize2 />, action: handleZenToggle },
    { id: 'find', label: 'Find in File', icon: <FiSearch />, action: () => editorRef.current?.getAction('actions.find')?.run() },
    { id: 'undo', label: 'Undo', icon: <FiChevronsLeft />, action: () => { editorRef.current?.trigger('keyboard', 'undo'); keepFocus(); } },
    { id: 'redo', label: 'Redo', icon: <FiChevronsRight />, action: () => { editorRef.current?.trigger('keyboard', 'redo'); keepFocus(); } },
    { id: 'ai', label: 'AI Assistant (Coming Soon)', icon: <FiZap />, action: () => setShowAiPlaceholder(true) },
    // eslint-disable-next-line
  ], [activeFile, handleCreateNewFile, handleFormat, handleSaveToPhone]);

  const filteredCommands = useMemo(() => {
    const q = commandQuery.toLowerCase();
    const matched = commands.filter(c => c.label.toLowerCase().includes(q));
    if (!q) {
      const recent = recentCommands.map(id => commands.find(c => c.id === id)).filter(Boolean);
      const others = matched.filter(c => !recent.find(r => r.id === c.id));
      return [...recent, ...others];
    }
    return matched;
  }, [commands, commandQuery, recentCommands]);

  const runCommand = (cmd) => {
    setShowCommandPalette(false);
    setCommandQuery('');
    setRecentCommands(prev => [cmd.id, ...prev.filter(id => id !== cmd.id)].slice(0, 5));
    cmd.action();
  };

  const timeAgo = (t) => {
    if (!t) return 'never';
    const diff = Math.floor((Date.now() - t) / 1000);
    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const filteredLogs = consoleLogs.filter(l => logFilter === 'all' || l.level === logFilter);

  const handleDragStart = (id) => setDraggedFileId(id);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (targetId) => {
    if (!draggedFileId || draggedFileId === targetId) return;
    setFiles(prev => {
      const from = prev.findIndex(f => f.id === draggedFileId);
      const to = prev.findIndex(f => f.id === targetId);
      if (from === -1 || to === -1) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
    setDraggedFileId(null);
  };

  // ==========================================
  // ৯. রেন্ডারিং (UI Rendering) - শুরু
  // ==========================================
  return (
    <div className={`app-container ${theme === 'vs-light' ? 'light-mode' : ''} ${zenMode ? 'zen-mode' : ''}`}>
      
      {/* হেডার সেকশন শুরু */}
      {!zenMode && (
        <header className="top-bar">
          <div className="logo">
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
              <FiMenu size={20} />
            </button>
            <div className="logo-brand">
              <FiCode size={20} className="logo-icon" />
              <h1>CodeX</h1>
            </div>
            {!online && <FiWifiOff size={14} style={{ color: '#ef4444' }} title="Offline" />}
          </div>
          <div className="actions">
            <button className="icon-btn bg-transparent" onClick={() => setShowCommandPalette(true)} title="Command Palette">
              <FiCommand size={18} />
            </button>
            <button className="icon-btn bg-transparent" onClick={() => setTheme(theme === 'tech-dark' ? 'vs-light' : 'tech-dark')} title="Theme">
              {theme === 'tech-dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>
            <button className="icon-btn bg-transparent" onClick={() => setShowSettings(true)} title="Settings">
              <FiSettings size={18} />
            </button>
            <button className="icon-btn bg-transparent" onClick={handleZenToggle} title="Zen Mode">
              <FiMaximize2 size={18} />
            </button>
            <button className="icon-btn bg-transparent" onClick={() => { setShowPreview(!showPreview); setConsoleLogs([]); }} title="Preview">
              <FiPlay size={18} />
            </button>
            <button className={`icon-btn ${justSaved ? 'saved' : ''}`} onClick={handleSaveToPhone} title="Save">
              {justSaved ? <FiCheck size={18} /> : <FiSave size={18} />}
            </button>
          </div>
        </header>
      )}
      {/* হেডার সেকশন শেষ */}

      {zenMode && (
        <div className="zen-exit">
          <button onClick={handleZenToggle}><FiMinimize2 size={18} /> Exit Zen</button>
        </div>
      )}

      <main className="main-content">
        
        {/* সাইডবার সেকশন শুরু */}
        {!zenMode && (
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
                <FiLink size={14} /> Import URL
              </button>
              <button onClick={handleImportFromClipboard}>
                <FiClipboard size={14} /> From Clipboard
              </button>
              <button onClick={handleExportZip} className="export-btn">
                <FiDownloadCloud size={14} /> Export ZIP
              </button>
              <button onClick={handleExportSingleHTML} className="export-btn">
                <FiFileText size={14} /> Export HTML
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
              }} style={{ display: 'none' }} accept=".js,.jsx,.ts,.tsx,.html,.css,.json,.py,.md,.txt,.xml" />
            </div>

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

            <ul className="file-list">
              {filteredFiles.map(file => (
                <li
                  key={file.id}
                  className={`${activeFileId === file.id ? 'active' : ''} ${draggedFileId === file.id ? 'dragging' : ''}`}
                  onClick={() => { setActiveFileId(file.id); setSidebarOpen(false); }}
                  draggable
                  onDragStart={() => handleDragStart(file.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(file.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, hasSelection: false, fileId: file.id, selectionText: '' });
                  }}
                  onTouchStart={(e) => {
                    const timer = setTimeout(() => {
                      setContextMenu({ visible: true, x: e.touches[0].clientX, y: e.touches[0].clientY, hasSelection: false, fileId: file.id, selectionText: '' });
                    }, 500);
                    e.currentTarget.ontouchend = () => clearTimeout(timer);
                    e.currentTarget.ontouchmove = () => clearTimeout(timer);
                  }}
                >
                  <span className="drag-handle">⋮⋮</span>
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
              {filteredFiles.length === 0 && <li className="empty-files">No files match</li>}
            </ul>
          </aside>
        )}
        {/* সাইডবার সেকশন শেষ */}

        {sidebarOpen && !zenMode && <div className="overlay" onClick={() => setSidebarOpen(false)}></div>}

        {/* এডিটর সেকশন শুরু */}
        <section className="editor-section">
          {activeFile ? (
            <>
              {!zenMode && (
                <div className="editor-header">
                  <span className="file-icon-small">{getFileIcon(activeFile.name)}</span>
                  <span>{activeFile.name}</span>
                  {showUnsavedDot && <span className="unsaved-dot" title="Unsaved">●</span>}
                  <span className="editor-actions">
                    <button onClick={() => editorRef.current?.trigger('keyboard', 'undo')} title="Undo"><FiChevronsLeft size={14} /></button>
                    <button onClick={() => editorRef.current?.trigger('keyboard', 'redo')} title="Redo"><FiChevronsRight size={14} /></button>
                    <button onClick={() => editorRef.current?.getAction('actions.find')?.run()} title="Find"><FiSearch size={14} /></button>
                    <button onClick={handleFormat} title="Format"><FiAlignLeft size={14} /></button>
                    <button onClick={handleZenToggle} title="Zen Mode"><FiMaximize2 size={14} /></button>
                  </span>
                </div>
              )}
              <div className="editor-wrapper">
                <Editor
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  onChange={handleCodeChange}
                  theme={theme}
                  onMount={handleEditorDidMount}
                  options={{
                    fontSize, lineHeight: 1.6, fontLigatures: true,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    minimap: { enabled: false }, wordWrap: 'off',
                    automaticLayout: true, lineNumbers: 'on',
                    formatOnPaste: false, formatOnType: false,
                    autoIndent: 'keep', tabSize: 4, readOnly: false,
                    mouseWheelZoom: true, contextmenu: false,
                    selectOnLineNumbers: true, selectionHighlight: true,
                    cursorBlinking: 'smooth', quickSuggestions: true,
                    suggestOnTriggerCharacters: true, acceptSuggestionOnEnter: 'on',
                    colorDecorators: true, matchBrackets: 'always',
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
                    "semanticHighlighting.enabled": true,
                  }}
                />
              </div>

              {!zenMode && (
                <>
                  {/* মোবাইল কিবোর্ড টুলবার */}
                  <div className="mobile-keyboard-toolbar">
                    <div className="toolbar-group">
                      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                        onClick={() => { editorRef.current?.trigger('keyboard', 'undo'); keepFocus(); }} aria-label="Undo"><FiChevronsLeft /></button>
                      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                        onClick={() => { editorRef.current?.trigger('keyboard', 'redo'); keepFocus(); }} aria-label="Redo"><FiChevronsRight /></button>
                    </div>
                    <div className="toolbar-divider" />
                    <div className="toolbar-group">
                      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileTab}>Tab</button>
                      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileEnter} aria-label="Enter"><FiCornerDownLeft /></button>
                      <button onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()} onClick={handleMobileDelete} className="delete-btn" aria-label="Delete"><FiDelete /></button>
                    </div>
                  </div>

                  {/* স্নিপেট বার */}
                  <div className="snippet-bar">
                    {['()', '{}', '[]', '""', "''", ';', '=>', '${}', '/* */', '//', '<>', '</>'].map(s => (
                      <button key={s} onMouseDown={e => e.preventDefault()} onTouchStart={e => e.preventDefault()}
                        onClick={() => insertSnippet(s)}>{s}</button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-state-logo">
                <FiCode size={64} className="empty-icon" />
              </div>
              <h2 className="empty-title">CodeX</h2>
              <p className="empty-subtitle">Premium Code Editor</p>
              <button onClick={handleCreateNewFile}>
                <FiPlus size={16} /> Create New File
              </button>
            </div>
          )}
        </section>
        {/* এডিটর সেকশন শেষ */}

        {/* প্রিভিউ প্যানেল সেকশন শুরু */}
        {showPreview && (
          <div className="preview-panel">
            <div className="preview-header">
              <span>Live Preview {activeFile?.language === 'xml' && '(XML)'}</span>
              <div className="preview-controls">
                <div className="device-toggle">
                  <button className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => handlePreviewDevice('mobile')} title="Mobile"><FiSmartphone size={14} /></button>
                  <button className={previewDevice === 'tablet' ? 'active' : ''} onClick={() => handlePreviewDevice('tablet')} title="Tablet"><FiTablet size={14} /></button>
                  <button className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => handlePreviewDevice('desktop')} title="Desktop"><FiMonitor size={14} /></button>
                </div>
                <button onClick={() => setShowConsole(!showConsole)} style={{ fontSize: '0.8rem' }}>
                  <FiTerminal /> Console {consoleLogs.length > 0 && <span className="console-badge">{consoleLogs.length}</span>}
                </button>
                <button onClick={() => setShowPreview(false)}><FiX size={14} /></button>
              </div>
            </div>
            <div className="preview-body">
              <iframe
                title="preview"
                srcDoc={getPreviewContent()}
                className="preview-iframe"
                style={{ width: previewWidth, maxWidth: '100%' }}
                sandbox="allow-scripts allow-modals allow-forms"
              />
            </div>
            {showConsole && (
              <div className="console-panel">
                <div className="console-header">
                  <span><FiTerminal size={12} /> Console ({filteredLogs.length})</span>
                  <div className="console-controls">
                    <select value={logFilter} onChange={e => setLogFilter(e.target.value)}>
                      <option value="all">All</option>
                      <option value="log">Logs</option>
                      <option value="warn">Warnings</option>
                      <option value="error">Errors</option>
                      <option value="info">Info</option>
                    </select>
                    <button onClick={() => setConsoleLogs([])}>Clear</button>
                  </div>
                </div>
                <div className="console-output">
                  {filteredLogs.length === 0 ? (
                    <span style={{ color: '#64748b' }}>No logs...</span>
                  ) : filteredLogs.map((log, i) => (
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
        {/* প্রিভিউ প্যানেল সেকশন শেষ */}

      </main>

      {/* কনটেক্সট মেনু সেকশন শুরু */}
      {contextMenu.visible && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.fileId && !contextMenu.hasSelection && (
            <>
              <button onClick={() => handleRenameFile(contextMenu.fileId)}><FiEdit2 size={14} /> Rename</button>
              <button onClick={() => { handleDeleteFile(contextMenu.fileId); setContextMenu(c => ({ ...c, visible: false })); }} className="text-red"><FiTrash2 size={14} /> Delete</button>
            </>
          )}
          {contextMenu.hasSelection && (
            <>
              <button onClick={handleCut}><FiScissors size={14} /> Cut</button>
              <button onClick={handleCopy}><FiCopy size={14} /> Copy</button>
              <button onClick={handleDeleteSelection} className="text-red"><FiX size={14} /> Delete</button>
            </>
          )}
          {!contextMenu.fileId && !contextMenu.hasSelection && <button onClick={handlePaste}><FiClipboard size={14} /> Paste</button>}
          <button onClick={handleSelectAll}><FiCode size={14} /> Select All</button>
        </div>
      )}
      {/* কনটেক্সট মেনু সেকশন শেষ */}

      {/* কমান্ড প্যালেট সেকশন শুরু */}
      {showCommandPalette && (
        <div className="modal-overlay" onClick={() => setShowCommandPalette(false)}>
          <div className="command-palette" onClick={e => e.stopPropagation()}>
            <div className="cp-input-wrap">
              <FiSearch size={16} />
              <input type="text" placeholder="Type a command..." value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)} autoFocus />
              <FiX size={16} style={{ cursor: 'pointer' }} onClick={() => setShowCommandPalette(false)} />
            </div>
            <div className="cp-list">
              {filteredCommands.length === 0 ? (
                <div className="cp-empty">No commands match</div>
              ) : filteredCommands.map(cmd => (
                <button key={cmd.id} className="cp-item" onClick={() => runCommand(cmd)}>
                  {cmd.icon} <span>{cmd.label}</span>
                  {recentCommands.includes(cmd.id) && !commandQuery && <span className="cp-recent">Recent</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* কমান্ড প্যালেট সেকশন শেষ */}

      {/* শর্টকাট মোডাল সেকশন শুরু */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content shortcuts-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><FiCommand size={16} /> Keyboard Shortcuts</h2>
              <button onClick={() => setShowShortcuts(false)}><FiX /></button>
            </div>
            <div className="modal-body shortcuts-list">
              {[
                ['Save to Phone', 'Ctrl + S'],
                ['Toggle Preview', 'Ctrl + Enter'],
                ['Command Palette', 'Ctrl + Shift + P'],
                ['Format Document', 'Ctrl + Shift + F'],
                ['New File', 'Ctrl + Shift + N'],
                ['Show Shortcuts', 'Ctrl + /'],
                ['Close All', 'Esc'],
              ].map(([label, keys]) => (
                <div key={label} className="shortcut-row">
                  <span>{label}</span>
                  <kbd>{keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* শর্টকাট মোডাল সেকশন শেষ */}

      {/* AI প্লেসহোল্ডার সেকশন শুরু */}
      {showAiPlaceholder && (
        <div className="modal-overlay" onClick={() => setShowAiPlaceholder(false)}>
          <div className="custom-alert-box" onClick={e => e.stopPropagation()}>
            <div className="alert-icon info"><FiZap /></div>
            <h3>AI Assistant</h3>
            <p>Coming soon! This feature will help you explain, fix, and refactor code using AI.</p>
            <div className="alert-actions">
              <button className="alert-btn confirm" onClick={() => setShowAiPlaceholder(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
      {/* AI প্লেসহোল্ডার সেকশন শেষ */}

      {/* অ্যালার্ট/প্রম্পট সেকশন শুরু */}
      {alertConfig.visible && (
        <div className="modal-overlay">
          <div className="custom-alert-box">
            <div className={`alert-icon ${alertConfig.type}`}>
              {alertConfig.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            </div>
            <h3>{alertConfig.title}</h3>
            <p>{alertConfig.message}</p>
            {alertConfig.isPrompt && (
              <input type="text" className="alert-input" placeholder="filename.js"
                value={alertConfig.inputValue}
                onChange={(e) => setAlertConfig({ ...alertConfig, inputValue: e.target.value })}
                autoFocus />
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
      {/* অ্যালার্ট/প্রম্পট সেকশন শেষ */}

      {/* সেটিংস মোডাল সেকশন শুরু */}
      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2><FiSettings size={16} /> Settings</h2>
              <button onClick={() => setShowSettings(false)}><FiX /></button>
            </div>
            <div className="modal-body">
              <div className="setting-item">
                <label>Editor Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value="tech-dark">CodeX Dark (Premium)</option>
                  <option value="vs-dark">VS Dark (Default)</option>
                  <option value="vs-light">Light</option>
                  <option value="hc-black">High Contrast</option>
                </select>
              </div>
              <div className="setting-item">
                <label>Font Size: {fontSize}px</label>
                <input type="range" min={FONT_MIN} max={FONT_MAX} value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))} />
              </div>
              <div className="setting-item">
                <label>Quick Font Size</label>
                <div className="font-quick">
                  <button onClick={() => setFontSize(s => Math.max(FONT_MIN, s - 1))}>A−</button>
                  <span>{fontSize}px</span>
                  <button onClick={() => setFontSize(s => Math.min(FONT_MAX, s + 1))}>A+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* সেটিংস মোডাল সেকশন শেষ */}

      {/* PWA ইন্সটল ব্যানার সেকশন শুরু */}
      {showInstallBanner && (
        <div className="install-banner">
          <div className="install-icon"><FiDownloadCloud size={24} /></div>
          <div className="install-text">
            <h4>Install CodeX</h4>
            <p>Add to home screen for app-like experience</p>
          </div>
          <button className="install-btn" onClick={handleInstallClick}>Install</button>
          <button className="close-install" onClick={() => setShowInstallBanner(false)}><FiX size={16} /></button>
        </div>
      )}
      {/* PWA ইন্সটল ব্যানার সেকশন শেষ */}

      {/* স্ট্যাটাস বার সেকশন শুরু */}
      {!zenMode && (
        <footer className="status-bar">
          <div className="status-left">
            <span>{activeFile?.language?.toUpperCase() || 'TXT'}</span>
            <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
            {selectionInfo.count > 0 && <span className="selection-info">({selectionInfo.count} selected)</span>}
            {!online && <span className="status-offline">● Offline</span>}
          </div>
          <div className="status-right">
            {lastSaveTime && <span><FiClock size={10} /> Saved {timeAgo(lastSaveTime)}</span>}
            <span>UTF-8</span>
            <span>v3.0</span>
          </div>
        </footer>
      )}
      {/* স্ট্যাটাস বার সেকশন শেষ */}

    </div>
  );
  // ==========================================
  // রেন্ডারিং (UI Rendering) - শেষ
  // ==========================================
}

export default App;