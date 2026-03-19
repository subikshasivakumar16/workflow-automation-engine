const express = require('express');
const Execution = require('../models/Execution');
const Step = require('../models/Step');
const Workflow = require('../models/Workflow');
const { executeWorkflow, resumeFromApproval, retryFailedStep } = require('../services/executionEngine');

const router = express.Router();

async function decorateExecution(rawExecution) {
  if (!rawExecution) return null;
  const execution = rawExecution.toObject ? rawExecution.toObject() : rawExecution;

  const workflow = await Workflow.findOne({ id: execution.workflow_id }).lean();
  const steps = await Step.find({ workflow_id: execution.workflow_id }).lean();
  const stepsById = steps.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const currentStepName = execution.current_step_id
    ? stepsById[execution.current_step_id]?.name || null
    : null;

  const cleanLogs = (execution.logs || []).map((log) => {
    const evaluatedRules = (log.evaluated_rules || []).map((r) => ({
      condition: r.condition,
      result: r.result,
      priority: r.priority,
      is_selected: r.is_selected,
      is_fallback: r.is_fallback,
    }));

    const derivedSelectedRule = evaluatedRules.find((r) => r.is_selected) || null;

    const selectedRule = log.selected_rule
      ? {
          condition: log.selected_rule.condition,
          priority: log.selected_rule.priority,
          is_fallback: Boolean(log.selected_rule.is_fallback),
        }
      : derivedSelectedRule
      ? {
          condition: derivedSelectedRule.condition,
          priority: derivedSelectedRule.priority,
          is_fallback: Boolean(derivedSelectedRule.is_fallback),
        }
      : null;

    const nextStepName =
      log.next_step_name ||
      (log.selected_next_step_id && stepsById[log.selected_next_step_id]
        ? stepsById[log.selected_next_step_id].name
        : null);

    const duration_ms =
      log.started_at && log.ended_at ? log.ended_at.getTime() - log.started_at.getTime() : null;

    return {
      step_name: log.step_name,
      step_type: log.step_type,
      evaluated_rules: evaluatedRules,
      selected_rule: selectedRule,
      next_step_name: nextStepName,
      status: log.status,
      error_message: log.error_message || null,
      message: log.message || null,
      started_at: log.started_at,
      ended_at: log.ended_at,
      duration_ms,
    };
  });

  let duration_ms = null;
  if (cleanLogs.length > 0) {
    const first = cleanLogs.find((l) => l.started_at);
    const last = [...cleanLogs].reverse().find((l) => l.ended_at);
    if (first?.started_at && last?.ended_at) {
      duration_ms = last.ended_at.getTime() - first.started_at.getTime();
    }
  }

  return {
    id: execution.id,
    workflow_id: execution.workflow_id,
    workflow_name: workflow ? workflow.name : null,
    workflow_version: execution.workflow_version,
    status: execution.status,
    data: execution.data,
    logs: cleanLogs,
    current_step_name: currentStepName,
    retries: execution.retries,
    triggered_by: execution.triggered_by,
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    duration_ms,
  };
}

// Start execution
router.post('/workflows/:workflow_id/execute', async (req, res) => {
  const { workflow_id } = req.params;
  const { data, triggered_by } = req.body;
  const execution = await executeWorkflow(workflow_id, data || {}, triggered_by || 'api');
  const decorated = await decorateExecution(execution);
  res.status(201).json(decorated);
});

// Get execution by id
router.get('/executions/:id', async (req, res) => {
  const execution = await Execution.findOne({ id: req.params.id });
  if (!execution) {
    return res.status(404).json({ message: 'Execution not found' });
  }
  const decorated = await decorateExecution(execution);
  res.json(decorated);
});

// List executions (for audit)
router.get('/executions', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Execution.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Execution.countDocuments(),
  ]);
  const decoratedItems = await Promise.all(items.map((ex) => decorateExecution(ex)));
  res.json({
    items: decoratedItems,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// Approve execution (for approval steps)
router.post('/executions/:id/approve', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body?.data || {};
  const execution = await resumeFromApproval(id, updatedData);
  const decorated = await decorateExecution(execution);
  res.json(decorated);
});

// Retry failed step
router.post('/executions/:id/retry', async (req, res) => {
  const { id } = req.params;
  const execution = await retryFailedStep(id);
  const decorated = await decorateExecution(execution);
  res.json(decorated);
});

// Cancel execution
router.post('/executions/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const execution = await Execution.findOne({ id });
  if (!execution) {
    return res.status(404).json({ message: 'Execution not found' });
  }
  execution.status = 'canceled';
  await execution.save();
  const decorated = await decorateExecution(execution);
  res.json(decorated);
});

module.exports = router;

