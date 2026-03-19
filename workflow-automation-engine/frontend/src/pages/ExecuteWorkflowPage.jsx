import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

const API_BASE = 'http://localhost:4000/api';

function DynamicForm({ schema, values, onChange }) {
  if (!schema || Object.keys(schema).length === 0) {
    return <div className="text-sm text-slate-500">This workflow has no input schema.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(schema).map(([key, field]) => {
        const type = field.type || 'string';
        const label = field.label || key;
        const required = field.required;
        const allowed = field.allowed || field.enum;

        const commonProps = {
          id: key,
          name: key,
          value: values[key] ?? '',
          onChange: (e) => onChange(key, e.target.value),
          className:
            'mt-1 block w-full rounded-xl border border-slate-700/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-slate-900/60 text-slate-100 placeholder:text-slate-500 backdrop-blur-xl',
        };

        return (
          <div key={key}>
            <label htmlFor={key} className="block text-xs font-medium text-slate-300 uppercase tracking-wide">
              {label}
              {required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            {allowed && Array.isArray(allowed) ? (
              <select {...commonProps}>
                <option value="">Select {label}</option>
                {allowed.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : type === 'number' ? (
              <input {...commonProps} type="number" />
            ) : (
              <input {...commonProps} type="text" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ExecuteWorkflowPage() {
  const { workflowId } = useParams();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({});
  const [execution, setExecution] = useState(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/workflows/${workflowId}`);
        setWorkflow(res.data.workflow);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [workflowId]);

  useEffect(() => {
    let interval;
    if (execution && polling) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_BASE}/executions/${execution.id}`);
          setExecution(res.data);
          if (
            ['completed', 'failed', 'canceled', 'paused'].includes(res.data.status)
          ) {
            setPolling(false);
          }
        } catch (e) {
          console.error(e);
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [execution, polling]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleExecute = async () => {
    try {
      const res = await axios.post(`${API_BASE}/workflows/${workflowId}/execute`, {
        data: formData,
        triggered_by: 'ui',
      });
      setExecution(res.data);
      setPolling(true);
    } catch (e) {
      console.error(e);
      alert('Failed to start execution');
    }
  };

  const handleApprove = async () => {
    if (!execution) return;
    try {
      const res = await axios.post(`${API_BASE}/executions/${execution.id}/approve`, {
        data: formData,
      });
      setExecution(res.data);
      setPolling(true);
    } catch (e) {
      console.error(e);
      alert('Failed to approve execution');
    }
  };

  const handleRetry = async () => {
    if (!execution) return;
    try {
      const res = await axios.post(`${API_BASE}/executions/${execution.id}/retry`);
      setExecution(res.data);
      setPolling(true);
    } catch (e) {
      console.error(e);
      alert('Failed to retry execution');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!workflow) {
    return <div className="text-sm text-rose-500">Workflow not found.</div>;
  }

  const timelineItems =
    execution && Array.isArray(execution.logs)
      ? [
          ...execution.logs,
          execution.status === 'completed'
            ? {
                step_name: 'Completed',
                step_type: 'system',
                status: 'completed',
                evaluated_rules: [],
                selected_rule: null,
                next_step_name: null,
                started_at: null,
                ended_at: null,
                duration_ms: null,
                message: null,
              }
            : null,
        ].filter(Boolean)
      : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">
            Execute: {workflow.name}
          </h1>
          <p className="text-sm text-slate-400">
            Provide input values and run the workflow. Logs and rule decisions appear in real time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/5 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/40 p-4 backdrop-blur-2xl">
            <h2 className="text-sm font-semibold text-slate-50 mb-3">
              Input Data
            </h2>
            <DynamicForm
              schema={workflow.input_schema}
              values={formData}
              onChange={handleChange}
            />
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleExecute}
                className="inline-flex items-center rounded-xl bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-sky-500/40 hover:bg-sky-400 transition"
              >
                Run Workflow
              </button>
              {execution && execution.status === 'paused' && (
                <button
                  type="button"
                  onClick={handleApprove}
                  className="inline-flex items-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-md shadow-emerald-500/40 hover:bg-emerald-400 transition"
                >
                  Approve & Continue
                </button>
              )}
            </div>
            {execution && execution.status === 'failed' && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-rose-300">
                  Execution failed. You can retry the failed step.
                </span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center rounded-xl bg-rose-500 px-3 py-1.5 text-xs font-medium text-slate-950 shadow-md shadow-rose-500/40 hover:bg-rose-400 transition"
                >
                  Retry Step
                </button>
              </div>
            )}
          </div>
          {execution && (
            <div className="bg-white/5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40 p-4 text-sm backdrop-blur-2xl">
              <h2 className="text-sm font-semibold text-slate-50 mb-2">
                Execution Summary
              </h2>
              <div className="space-y-1 text-xs text-slate-300">
                <div>
                  <span className="font-semibold">ID:</span> {execution.id}
                </div>
                <div>
                  <span className="font-semibold">Status:</span>{' '}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      execution.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                        : execution.status === 'failed'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
                        : execution.status === 'paused'
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-300/50'
                        : execution.status === 'in_progress'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                        : 'bg-slate-700/60 text-slate-200 border border-slate-500/60'
                    }`}
                  >
                    {execution.status === 'in_progress'
                      ? 'In Progress'
                      : execution.status}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Current Step:</span>{' '}
                  {execution.current_step_name || execution.current_step_id || '-'}
                </div>
                <div>
                  <span className="font-semibold">Retries:</span> {execution.retries}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          {execution && timelineItems.length > 0 && (
            <div className="bg-white/5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40 p-4 backdrop-blur-2xl">
              <h2 className="text-sm font-semibold text-slate-50 mb-3">
                Execution Timeline
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
                {timelineItems.map((log, idx) => {
                  const isLast = idx === timelineItems.length - 1;
                  return (
                    <React.Fragment key={idx}>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold border ${
                              log.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400'
                                : log.status === 'failed'
                                ? 'bg-rose-500/20 text-rose-200 border-rose-400'
                                : log.status === 'paused'
                                ? 'bg-amber-400/20 text-amber-100 border-amber-300'
                                : 'bg-slate-800/80 text-slate-300 border-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <span className="font-medium">{log.step_name}</span>
                        </div>
                      </div>
                      {!isLast && (
                        <span className="text-slate-500 text-[11px]">➝</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white/5 rounded-2xl border border-slate-700/80 shadow-2xl shadow-black/40 p-4 h-full backdrop-blur-2xl">
            <h2 className="text-sm font-semibold text-slate-50 mb-3">
              Execution Log
            </h2>
            {!execution ? (
              <div className="text-sm text-slate-400">
                No executions yet
              </div>
            ) : execution.logs.length === 0 ? (
              <div className="text-sm text-slate-400">
                Execution started. Waiting for first step to complete...
              </div>
            ) : (
              <div className="space-y-3 max-h-[480px] overflow-auto pr-1">
                {execution.logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-700/70 rounded-xl p-3 bg-slate-900/70 hover:bg-slate-900/90 transition-colors"
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
                          {log.ended_at
                            ? new Date(log.ended_at).toLocaleTimeString()
                            : '...'}
                        </span>
                      )}
                    </div>

                    {log.selected_rule && (
                      <div className="mt-2 text-[11px] text-slate-300">
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
                                  ? 'bg-slate-800/80 rounded-lg px-2 py-1 border border-sky-300/30 shadow-[0_0_16px_rgba(56,189,248,0.20)]'
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
      </div>
    </div>
  );
}

