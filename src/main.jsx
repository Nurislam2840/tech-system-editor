import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// --- PWA Service Worker রেজিস্ট্রেশন (নিরাপদ) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('SW registered:', reg.scope);
        // নতুন SW পেলে আপডেট করতে বলো
        reg.update().catch(() => {});
      })
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// --- React রেন্ডার (ত্রুটি থাকলেও স্প্ল্যাশ সরাবে) ---
const rootEl = document.getElementById('root');
const splash = document.getElementById('splash-screen');

function removeSplash() {
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }
}

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // React mount হওয়ার পর স্প্ল্যাশ সরাও (সর্বোচ্চ ২ সেকেন্ড অপেক্ষা)
  setTimeout(removeSplash, 800);
} catch (err) {
  console.error('React mount failed:', err);
  // ত্রুটি হলেও স্প্ল্যাশ সরাও, যাতে ব্যবহারকারী সাদা স্ক্রিন না দেখে
  setTimeout(removeSplash, 500);
  rootEl.innerHTML = `
    <div style="color:#e2e8f0;padding:40px;font-family:sans-serif;text-align:center;">
      <h2>App failed to load</h2>
      <p style="color:#94a3b8">${err?.message || 'Unknown error'}</p>
      <button onclick="location.reload()" style="margin-top:20px;padding:12px 24px;border-radius:10px;background:#38bdf8;color:#0f172a;border:none;font-weight:600;cursor:pointer;">Reload</button>
    </div>
  `;
}

// নিরাপত্তা: ৫ সেকেন্ড পরেও স্প্ল্যাশ থাকলে জোর করে সরাও
setTimeout(removeSplash, 5000);