import React, { useEffect, useState } from 'react';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE = 'http://localhost:4000/api';

export default function AuditPage() {
  const [executions, setExecutions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/executions`, {
        params: { limit: 20 },
      });
      setExecutions(res.data.items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, []);

  const loadExecutionDetail = async (id) => {
    try {
      const res = await axios.get(`${API_BASE}/executions/${id}`);
      setSelected(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Audit Log
          </h1>
          <p className="text-sm text-slate-400">
            Inspect workflow executions, statuses, and detailed step-by-step logs.
          </p>
        </div>
        <button
          type="button"
          onClick={loadExecutions}
          className="inline-flex items-center rounded-xl bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-md shadow-black/50 hover:bg-slate-800 transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white/5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            {loading ? (
              <LoadingSpinner />
            ) : executions.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                No executions yet
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/80 text-sm">
                {executions.map((ex) => (
                  <li
                    key={ex.id}
                    className={`px-4 py-3 cursor-pointer hover:bg-slate-900/60 transition ${
                      selected && selected.id === ex.id ? 'bg-slate-900/80' : ''
                    }`}
                    onClick={() => loadExecutionDetail(ex.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-50">
                          {ex.workflow_name || ex.workflow_id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(ex.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          ex.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : ex.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                            : ex.status === 'paused'
                            ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                            : ex.status === 'in_progress'
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                            : 'bg-slate-700/60 text-slate-200 border border-slate-500/60'
                        }`}
                      >
                        {ex.status === 'in_progress' ? 'In Progress' : ex.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="bg-white/5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40 p-4 h-full backdrop-blur-2xl">
            {!selected ? (
              <div className="text-sm text-slate-400">
                Select an execution on the left to view details.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-50">
                      Execution {selected.id}
                    </h2>
                    <div className="text-xs text-slate-400">
                      Workflow: {selected.workflow_name || selected.workflow_id} • Version:{' '}
                      {selected.workflow_version}
                    </div>
                    <div className="text-xs text-slate-400">
                      Duration:{' '}
                      {typeof selected.duration_ms === 'number'
                        ? `${(selected.duration_ms / 1000).toFixed(2)}s`
                        : '-'}
                    </div>
                    <div className="text-xs text-slate-400">
                      Current Step:{' '}
                      {selected.current_step_name || '-'}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      selected.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : selected.status === 'failed'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        : selected.status === 'paused'
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                        : selected.status === 'in_progress'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                        : 'bg-slate-700/60 text-slate-200 border border-slate-500/60'
                    }`}
                  >
                    {selected.status === 'in_progress' ? 'In Progress' : selected.status}
                  </span>
                </div>
                <div className="border-t border-slate-800/80 pt-3">
                  <div className="text-xs font-semibold text-slate-300 mb-1">
                    Input Data
                  </div>
                  <pre className="text-xs bg-slate-950/60 border border-slate-800 rounded-lg p-2 overflow-auto text-slate-200">
                    {JSON.stringify(selected.data, null, 2)}
                  </pre>
                </div>
                <div className="border-t border-slate-800/80 pt-3">
                  <div className="text-xs font-semibold text-slate-300 mb-1">
                    Step Logs
                  </div>
                  {selected.logs.length === 0 ? (
                    <div className="text-xs text-slate-400">
                      No logs captured for this execution.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-auto pr-1">
                      {selected.logs.map((log, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-800/70 rounded-xl p-3 bg-slate-950/60"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium text-slate-50">
                              {log.step_name}{' '}
                              <span className="text-xs text-slate-400">
                                ({log.step_type})
                              </span>
                            </div>
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                log.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                  : log.status === 'failed'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                                  : log.status === 'paused'
                                  ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                                  : 'bg-slate-700/60 text-slate-200 border border-slate-500/60'
                              }`}
                            >
                              {log.status}
                            </span>
                          </div>
                        <div className="text-xs text-slate-400 mb-2">
                          {log.started_at && (
                            <span>
                              {new Date(log.started_at).toLocaleTimeString()} -{' '}
                              {log.ended_at ? new Date(log.ended_at).toLocaleTimeString() : '...'}
                            </span>
                          )}
                        </div>

                        {log.selected_rule && (
                          <div className="mt-1 text-[11px] text-slate-300">
                            <span className="font-semibold">Selected Rule:</span>{' '}
                            <span
                              className={`ml-1 inline-flex items-center rounded-lg px-2 py-1 border ${
                                log.selected_rule.is_fallback
                                  ? 'border-amber-300/40 bg-amber-400/10 text-amber-200'
                                  : 'border-sky-300/40 bg-sky-400/10 text-sky-200'
                              }`}
                            >
                              {log.selected_rule.is_fallback ? 'DEFAULT' : 'MATCH'}:{' '}
                              {log.selected_rule.condition}
                            </span>
                          </div>
                        )}

                          {log.evaluated_rules && log.evaluated_rules.length > 0 && (
                            <div className="mt-1">
                              <div className="text-[11px] font-semibold text-slate-300 mb-1">
                                Evaluated Rules
                              </div>
                              <ul className="space-y-1 text-[11px] text-slate-300">
                                {log.evaluated_rules.map((r, idx2) => (
                                  <li
                                    key={idx2}
                                    className={`flex justify-between gap-2 ${
                                      r.is_selected
                                      ? 'bg-slate-900/80 rounded-lg px-2 py-1 border border-sky-300/30 shadow-[0_0_16px_rgba(56,189,248,0.20)]'
                                        : ''
                                    }`}
                                  >
                                    <span className="flex-1 truncate">
                                      #{r.priority} — {r.condition}
                                    {r.is_fallback && (
                                      <span className="ml-2 text-[10px] text-amber-200">
                                        DEFAULT
                                      </span>
                                    )}
                                      {r.is_selected && (
                                        <span className="ml-1 text-[10px] text-sky-300 font-semibold">
                                          (selected)
                                        </span>
                                      )}
                                    </span>
                                    <span
                                      className={`font-semibold ${
                                        r.result ? 'text-emerald-400' : 'text-rose-400'
                                      }`}
                                    >
                                      {r.result ? 'TRUE' : 'FALSE'}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        {log.message && (
                          <div className="mt-2 text-[11px] text-slate-300">
                            <span className="font-semibold">Message:</span> {log.message}
                          </div>
                        )}
                          <div className="mt-2 text-[11px] text-slate-300">
                            <div>
                              <span className="font-semibold">Next step:</span>{' '}
                            {log.next_step_name || 'End'}
                            </div>
                            {log.error_message && (
                              <div className="mt-1 text-rose-400">
                                <span className="font-semibold">Error:</span>{' '}
                                {log.error_message}
                              </div>
                            )}
                          {typeof log.duration_ms === 'number' && (
                            <div className="mt-1 text-slate-400">
                              <span className="font-semibold">Duration:</span>{' '}
                              {(log.duration_ms / 1000).toFixed(2)}s
                            </div>
                          )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

