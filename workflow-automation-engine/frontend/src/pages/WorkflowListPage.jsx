import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE = 'http://localhost:4000/api';

export default function WorkflowListPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/workflows`, {
        params: { search, limit: 20 },
      });
      setWorkflows(res.data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    loadWorkflows();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Workflows
          </h1>
          <p className="text-sm text-slate-400">
            Manage and execute automated workflows with dynamic rules and approvals.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex gap-3 items-center bg-slate-900/60 border border-slate-700/60 rounded-2xl px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-xl"
      >
        <input
          type="text"
          className="flex-1 rounded-xl bg-slate-900/60 border border-slate-700/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          placeholder="Search workflows by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400 transition"
        >
          Search
        </button>
      </form>

      <div className="bg-white/5 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-2xl overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : workflows.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No workflows found
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-left">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((wf) => (
                <tr
                  key={wf.id}
                  className="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/60 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-50">{wf.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">
                      {wf.start_step_name
                        ? `Start Step: ${wf.start_step_name}`
                        : 'No start step set'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{wf.version}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        wf.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-slate-700/60 text-slate-300 border border-slate-500/60'
                      }`}
                    >
                      {wf.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {wf.createdAt ? new Date(wf.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/execute/${wf.id}`}
                      className="inline-flex items-center rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400 transition"
                    >
                      Execute
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

