import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// PWA Service Worker রেজিস্ট্রেশন
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// React লোড হওয়ার পর স্প্ল্যাশ স্ক্রিন রিমুভ করা
setTimeout(() => {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500); // ফেড আউট হওয়ার পর রিমুভ
  }
}, 1500); // ১.৫ সেকেন্ড পর রিমুভ হবে