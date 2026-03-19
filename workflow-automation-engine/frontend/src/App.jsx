import React from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import WorkflowListPage from './pages/WorkflowListPage';
import ExecuteWorkflowPage from './pages/ExecuteWorkflowPage';
import AuditPage from './pages/AuditPage';

function Layout({ children }) {
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path
      ? 'text-sky-300 border-b-2 border-sky-400'
      : 'text-slate-400 hover:text-slate-100';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800/60 bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 flex items-center justify-center text-slate-950 font-bold text-lg shadow-lg shadow-sky-500/40">
              W
            </div>
            <div>
              <div className="font-semibold text-slate-50 tracking-tight">
                Workflow Automation Engine
              </div>
              <div className="text-[11px] text-slate-400">
                Dynamic workflows, rules & approvals
              </div>
            </div>
          </div>
          <nav className="flex gap-6 text-sm font-medium">
            <Link to="/" className={isActive('/')}>
              Workflows
            </Link>
            <Link to="/audit" className={isActive('/audit')}>
              Audit Log
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-8">{children}</div>
      </main>
      <footer className="border-t border-slate-800/60 bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-slate-500 flex justify-between">
          <span>Workflow Automation Engine</span>
          <span>Node • MongoDB • React • Tailwind</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<WorkflowListPage />} />
        <Route path="/execute/:workflowId" element={<ExecuteWorkflowPage />} />
        <Route path="/audit" element={<AuditPage />} />
      </Routes>
    </Layout>
  );
}

