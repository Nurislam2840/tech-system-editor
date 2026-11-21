import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import localforage from 'localforage';
import { 
  FiCode, FiSave, FiFolder, FiMenu, FiPlus, FiUpload, 
  FiX, FiPlay, FiSettings, FiCheckCircle, FiAlertCircle, FiDelete, FiCornerDownLeft, FiChevronsLeft
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
  
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, type: 'success', title: '', message: '', isPrompt: false, inputValue: '', onConfirm: null 
  });
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const showCustomAlert = (type, title, message, isPrompt = false, onConfirm = null) => {
    setAlertConfig({ visible: true, type, title, message, isPrompt, inputValue: '', onConfirm });
  };
  const closeAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  useEffect(() => {
    localforage.getItem('techSystemFiles').then((savedFiles) => {
      if (savedFiles && savedFiles.length > 0) {
        setFiles(savedFiles);
        setActiveFileId(savedFiles[0].id);
      } else {
        const defaultFiles = [
          { id: '1', name: 'index.html', language: 'html', content: '<!DOCTYPE html>\n<html>\n<body>\n  <h1 style="color: #38bdf8;">Hello Tech System!</h1>\n</body>\n</html>' },
          { id: '2', name: 'style.css', language: 'css', content: 'body {\n  background: #0f172a;\n  color: white;\n}' },
          { id: '3', name: 'app.js', language: 'javascript', content: 'console.log("App Running...");' }
        ];
        setFiles(defaultFiles);
        setActiveFileId('1');
      }
    });
  }, []);

  useEffect(() => {
    if (files.length > 0) localforage.setItem('techSystemFiles', files);
  }, [files]);

  const activeFile = files.find(f => f.id === activeFileId);

  const handleCodeChange = (newCode) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newCode } : f));
  };

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

      const newFile = { id: Date.now().toString(), name: file.name, language: lang, content: content };
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
          types: [{ description: 'Code Files', accept: { 'text/plain': ['.js', '.html', '.css', '.txt', '.json', '.py'] } }],
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

  const handleCreateNewFile = () => {
    showCustomAlert('info', 'New File', 'Enter file name (e.g. script.js):', true, (fileName) => {
      if (!fileName) return;
      const extension = fileName.split('.').pop().toLowerCase();
      let lang = 'plaintext';
      if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) lang = 'javascript';
      else if (extension === 'html') lang = 'html';
      else if (extension === 'css') lang = 'css';
      else if (extension === 'py') lang = 'python';

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

  const handleMobileDelete = () => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      const model = editorRef.current.getModel();
      const selection = editorRef.current.getSelection();

      if (!selection.isEmpty()) {
        editorRef.current.executeEdits('', [{ range: selection, text: '' }]);
        return;
      }

      const lineContent = model.getLineContent(position.lineNumber);
      
      if (lineContent.trim() === '' && position.lineNumber > 1) {
        const prevLineLength = model.getLineMaxColumn(position.lineNumber - 1);
        editorRef.current.executeEdits('', [{
          range: new monacoRef.current.Range(position.lineNumber - 1, prevLineLength, position.lineNumber, 1),
          text: ''
        }]);
        editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
      } else if (position.column > 1) {
        const range = new monacoRef.current.Range(position.lineNumber, position.column - 1, position.lineNumber, position.column);
        editorRef.current.executeEdits('', [{ range: range, text: '' }]);
        editorRef.current.setPosition({ lineNumber: position.lineNumber, column: position.column - 1 });
      } else if (position.lineNumber > 1) {
        const prevLineLength = model.getLineMaxColumn(position.lineNumber - 1);
        editorRef.current.executeEdits('', [{
          range: new monacoRef.current.Range(position.lineNumber - 1, prevLineLength, position.lineNumber, 1),
          text: ''
        }]);
        editorRef.current.setPosition({ lineNumber: position.lineNumber - 1, column: prevLineLength });
      }
    }
  };

  const handleMobileEnter = () => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'type', { text: '\n' });
    }
  };

  const handleMobileTab = () => {
    if (editorRef.current) {
      editorRef.current.trigger('keyboard', 'type', { text: '  ' });
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onContextMenu((e) => {
      e.event.preventDefault();
      const selection = editor.getSelection();
      if (selection && !selection.isEmpty()) {
        const position = editor.getPosition();
        const coords = editor.getScrolledVisiblePosition(position);
        if (coords) setContextMenu({ visible: true, x: coords.left, y: coords.top + 30 });
      }
    });
    editor.onMouseDown(() => setContextMenu({ visible: false, x: 0, y: 0 }));
  };

  const handleCut = async () => {
    if (editorRef.current) {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };
  const handleCopy = async () => {
    if (editorRef.current) {
      const text = editorRef.current.getModel().getValueInRange(editorRef.current.getSelection());
      await navigator.clipboard.writeText(text);
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };
  const handleDeleteSelection = () => {
    if (editorRef.current) {
      editorRef.current.executeEdits('', [{ range: editorRef.current.getSelection(), text: '' }]);
      setContextMenu({ visible: false, x: 0, y: 0 });
    }
  };

  const getPreviewContent = () => {
    const htmlFile = files.find(f => f.name.endsWith('.html'));
    const cssFile = files.find(f => f.name.endsWith('.css'));
    const jsFile = files.find(f => f.name.endsWith('.js'));

    let html = htmlFile ? htmlFile.content : '<h1>No HTML File Found</h1>';
    const css = cssFile ? `<style>${cssFile.content}</style>` : '';
    const js = jsFile ? `<script>${jsFile.content}<\/script>` : '';

    if (html.includes('</head>')) html = html.replace('</head>', `${css}</head>`);
    else html = `<head>${css}</head>` + html;
    
    if (html.includes('</body>')) html = html.replace('</body>', `${js}</body>`);
    else html = html + js;
    return html;
  };

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
          <button className="icon-btn bg-transparent" onClick={() => setShowSettings(true)}>
            <FiSettings size={18} />
          </button>
          <button className="icon-btn bg-transparent" onClick={() => setShowPreview(!showPreview)}>
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
          <div className="sidebar-actions">
            <button onClick={() => fileInputRef.current.click()}>
              <FiUpload size={14} /> Open from Phone
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileOpen} style={{ display: 'none' }} accept=".js,.html,.css,.json,.py,.txt" />
          </div>
          <ul className="file-list">
            {files.map(file => (
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
                    fontSize: fontSize, 
                    fontFamily: "'Fira Code', 'Courier New', monospace", 
                    minimap: { enabled: false }, 
                    wordWrap: 'off', 
                    automaticLayout: true, 
                    lineNumbers: 'on', 
                    formatOnPaste: false, 
                    formatOnType: false, 
                    autoIndent: 'none', 
                    autoClosingBrackets: 'never', 
                    autoClosingQuotes: 'never', 
                    tabSize: 2, 
                    readOnly: false, 
                    domReadOnly: false, 
                    mouseWheelZoom: true, 
                    contextmenu: false, 
                    selectOnLineNumbers: true, 
                    cursorBlinking: 'smooth', 
                  }}
                />
              </div>

              <div className="mobile-keyboard-toolbar">
                <button onClick={() => editorRef.current.trigger('keyboard', 'undo')}><FiChevronsLeft /></button>
                <button onClick={handleMobileTab}>Tab</button>
                <button onClick={handleMobileEnter}><FiCornerDownLeft /></button>
                <button onClick={handleMobileDelete} className="delete-btn"><FiDelete /></button>
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
              <button onClick={() => setShowPreview(false)}><FiX size={14}/></button>
            </div>
            <iframe title="preview" srcDoc={getPreviewContent()} className="preview-iframe" sandbox="allow-scripts" />
          </div>
        )}
      </main>

      {contextMenu.visible && (
        <div className="custom-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button onClick={handleCut}>Cut</button>
          <button onClick={handleCopy}>Copy</button>
          <button onClick={handleDeleteSelection} className="text-red">Delete</button>
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
                type="text" className="alert-input" placeholder="filename.js" value={alertConfig.inputValue}
                onChange={(e) => setAlertConfig({...alertConfig, inputValue: e.target.value})} autoFocus
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