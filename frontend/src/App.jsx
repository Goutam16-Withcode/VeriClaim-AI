import React, { useState } from 'react';
import ClaimForm from './components/ClaimForm';
import AdminDashboard from './components/AdminDashboard';
import { ShieldAlert, FileText, User, ShieldCheck } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('patient'); // 'patient' or 'admin'

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/85 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform group-hover:scale-110 duration-300">
                  {/* Hexagonal Shield */}
                  <path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" stroke="url(#logo-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Stylized 'V' Checkmark */}
                  <path d="M7.5 9.5L11 14.5L16.5 7.5" stroke="url(#logo-grad-check)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <defs>
                    <linearGradient id="logo-grad" x1="3" y1="2" x2="21" y2="25" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366f1" />
                      <stop offset="1" stopColor="#06b6d4" />
                    </linearGradient>
                    <linearGradient id="logo-grad-check" x1="7.5" y1="7.5" x2="16.5" y2="14.5" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#a5b4fc" />
                      <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="h-6 w-px bg-slate-800 hidden sm:inline-block"></span>
              <span className="text-sm font-extrabold tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent uppercase hidden sm:inline-block">
                VeriClaim AI
              </span>
            </div>

            {/* Navigation tabs */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab('patient')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'patient'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User size={16} />
                <span>Patient Portal</span>
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck size={16} />
                <span>Admin Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'patient' ? (
          <ClaimForm onSwitchToAdmin={() => setActiveTab('admin')} />
        ) : (
          <AdminDashboard />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} VeriClaim AI. Claims Auditing Portal.</p>
          <p className="mt-2 text-slate-600">
            Powered by OCR document parsing, local FAISS semantic indexing, and Gemini 2.5 Flash intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
