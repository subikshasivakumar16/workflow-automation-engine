const Workflow = require('../models/Workflow');
const Step = require('../models/Step');
const Rule = require('../models/Rule');
const Execution = require('../models/Execution');
const { evaluateCondition } = require('./ruleEngine');

const MAX_ITERATIONS_DEFAULT = 20;

async function executeWorkflow(workflowId, inputData, triggeredBy = 'api') {
  const workflow = await Workflow.findOne({ id: workflowId });
  if (!workflow) {
    const err = new Error('Workflow not found');
    err.status = 404;
    throw err;
  }

  const steps = await Step.find({ workflow_id: workflow.id }).sort({ order: 1 }).lean();

  // Ensure every workflow has a valid start step.
  if (!workflow.start_step_id && steps.length > 0) {
    workflow.start_step_id = steps[0].id;
    await workflow.save();
  }
  const rules = await Rule.find({ step_id: { $in: steps.map((s) => s.id) } }).lean();

  const stepsById = steps.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const rulesByStep = rules.reduce((acc, r) => {
    if (!acc[r.step_id]) acc[r.step_id] = [];
    acc[r.step_id].push(r);
    return acc;
  }, {});

  let execution = await Execution.create({
    workflow_id: workflow.id,
    workflow_version: workflow.version,
    status: 'in_progress',
    data: inputData || {},
    logs: [],
    current_step_id: workflow.start_step_id || null,
    pending_next_step_id: null,
    pending_next_step_name: null,
    triggered_by: triggeredBy,
    max_iterations: MAX_ITERATIONS_DEFAULT,
  });

  execution = await runEngine(execution, stepsById, rulesByStep);
  return execution;
}

async function resumeFromApproval(executionId, updatedData = {}) {
  let execution = await Execution.findOne({ id: executionId });
  if (!execution) {
    const err = new Error('Execution not found');
    err.status = 404;
    throw err;
  }
  if (execution.status !== 'paused') {
    const err = new Error('Execution is not paused for approval');
    err.status = 400;
    throw err;
  }

  execution.data = { ...execution.data, ...updatedData };

  // Resume from the next step selected when we paused at the approval step.
  const nextStepId = execution.pending_next_step_id || null;
  execution.pending_next_step_id = null;
  execution.pending_next_step_name = null;

  if (!nextStepId) {
    execution.status = 'completed';
    execution.current_step_id = null;
    await execution.save();
    return execution;
  }

  execution.current_step_id = nextStepId;
  execution.status = 'in_progress';
  await execution.save();

  const workflow = await Workflow.findOne({ id: execution.workflow_id });
  const steps = await Step.find({ workflow_id: workflow.id }).sort({ order: 1 }).lean();
  const rules = await Rule.find({ step_id: { $in: steps.map((s) => s.id) } }).lean();

  const stepsById = steps.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const rulesByStep = rules.reduce((acc, r) => {
    if (!acc[r.step_id]) acc[r.step_id] = [];
    acc[r.step_id].push(r);
    return acc;
  }, {});

  execution = await runEngine(execution, stepsById, rulesByStep);
  return execution;
}

async function retryFailedStep(executionId) {
  let execution = await Execution.findOne({ id: executionId });
  if (!execution) {
    const err = new Error('Execution not found');
    err.status = 404;
    throw err;
  }
  if (execution.status !== 'failed') {
    const err = new Error('Execution is not in failed status');
    err.status = 400;
    throw err;
  }

  execution.retries += 1;
  execution.pending_next_step_id = null;
  execution.pending_next_step_name = null;
  execution.status = 'in_progress';
  await execution.save();

  const workflow = await Workflow.findOne({ id: execution.workflow_id });
  const steps = await Step.find({ workflow_id: workflow.id }).sort({ order: 1 }).lean();
  const rules = await Rule.find({ step_id: { $in: steps.map((s) => s.id) } }).lean();

  const stepsById = steps.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});
  const rulesByStep = rules.reduce((acc, r) => {
    if (!acc[r.step_id]) acc[r.step_id] = [];
    acc[r.step_id].push(r);
    return acc;
  }, {});

  execution = await runEngine(execution, stepsById, rulesByStep, {
    retryCurrentStepOnly: true,
  });
  return execution;
}

async function runEngine(execution, stepsById, rulesByStep, options = {}) {
  const { retryCurrentStepOnly = false } = options;
  let iterations = 0;
  const maxIterations = execution.max_iterations || MAX_ITERATIONS_DEFAULT;

  let currentStepId = execution.current_step_id;

  if (!currentStepId) {
    execution.status = 'completed';
    return execution.save();
  }

  while (currentStepId && iterations < maxIterations) {
    iterations += 1;
    const step = stepsById[currentStepId];
    if (!step) {
      execution.logs.push({
        step_id: currentStepId,
        step_name: 'Unknown step',
        step_type: 'unknown',
        evaluated_rules: [],
        selected_next_step_id: null,
        next_step_name: null,
        selected_rule: null,
        status: 'failed',
        error_message: 'Step not found in workflow definition',
        started_at: new Date(),
        ended_at: new Date(),
      });
      execution.status = 'failed';
      execution.current_step_id = currentStepId;
      await execution.save();
      return execution;
    }

    const logEntry = {
      step_id: step.id,
      step_name: step.name,
      step_type: step.step_type,
      evaluated_rules: [],
      selected_next_step_id: null,
      next_step_name: null,
      selected_rule: null,
      message: null,
      status: 'in_progress',
      error_message: null,
      started_at: new Date(),
    };

    try {
      if (!retryCurrentStepOnly || (retryCurrentStepOnly && execution.current_step_id === step.id)) {
        await handleStep(step, execution, logEntry);
      }

      const { nextStepId, ruleLogs, selectedRule, nextStepName } = evaluateRulesForStep(
        step,
        rulesByStep[step.id] || [],
        execution.data,
        stepsById
      );

      logEntry.evaluated_rules = ruleLogs;
      logEntry.selected_next_step_id = nextStepId || null;
      logEntry.next_step_name = nextStepName || null;
      logEntry.selected_rule = selectedRule
        ? {
            id: selectedRule.id,
            condition: selectedRule.condition,
            priority: selectedRule.priority,
            is_fallback: selectedRule.is_fallback,
          }
        : null;
      logEntry.status = step.step_type === 'approval' ? 'paused' : 'completed';
      logEntry.ended_at = new Date();

      execution.logs.push(logEntry);

      if (step.step_type === 'approval') {
        execution.status = 'paused';
        // Store chosen next step, but keep current_step_id on the approval step.
        execution.pending_next_step_id = nextStepId || null;
        execution.pending_next_step_name = nextStepName || null;
        execution.current_step_id = step.id;
        await execution.save();
        return execution;
      }

      if (!nextStepId) {
        execution.status = 'completed';
        execution.current_step_id = null;
        await execution.save();
        return execution;
      }

      execution.current_step_id = nextStepId;
      currentStepId = nextStepId;
    } catch (err) {
      logEntry.status = 'failed';
      logEntry.error_message = err.message || 'Error executing step';
      logEntry.ended_at = new Date();
      execution.logs.push(logEntry);
      execution.status = 'failed';
      execution.current_step_id = step.id;
      execution.pending_next_step_id = null;
      execution.pending_next_step_name = null;
      await execution.save();
      return execution;
    }
  }

  if (iterations >= maxIterations) {
    execution.logs.push({
      step_id: execution.current_step_id,
      step_name: 'Loop protection',
      step_type: 'system',
      evaluated_rules: [],
      selected_next_step_id: null,
      next_step_name: null,
      selected_rule: null,
      status: 'failed',
      error_message: `Max iterations (${maxIterations}) exceeded, possible infinite loop`,
      started_at: new Date(),
      ended_at: new Date(),
    });
    execution.status = 'failed';
    await execution.save();
  }

  return execution;
}

async function handleStep(step, execution, logEntry) {
  switch (step.step_type) {
    case 'task':
      await simulateTask(step, execution, logEntry);
      break;
    case 'approval':
      await simulateApproval(step, execution, logEntry);
      break;
    case 'notification':
      await simulateNotification(step, execution, logEntry);
      break;
    default:
      throw new Error(`Unsupported step type: ${step.step_type}`);
  }
}

async function simulateTask(step, execution, logEntry) {
  logEntry.status = 'completed';
}

async function simulateApproval(step, execution, logEntry) {
  logEntry.status = 'paused';
}

async function simulateNotification(step, execution, logEntry) {
  const messageTemplate = step.metadata?.message || 'Notification sent';
  const renderedMessage = messageTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return execution.data[key] != null ? execution.data[key] : '';
  });
  logEntry.message = renderedMessage;
}

function evaluateRulesForStep(step, rules, data, stepsById) {
  const ruleLogs = [];
  if (!rules || rules.length === 0) {
    return { nextStepId: null, ruleLogs, selectedRule: null, nextStepName: null };
  }

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  let selectedRule = null;
  const fallbackRules = [];

  for (const rule of sorted) {
    const isFallbackKeyword =
      typeof rule.condition === 'string' &&
      rule.condition.trim().toUpperCase() === 'DEFAULT';
    const isFallback = Boolean(rule.is_default || isFallbackKeyword);

    if (isFallback) {
      fallbackRules.push(rule);
      continue;
    }

    const result = evaluateCondition(rule.condition, data);
    ruleLogs.push({
      rule_id: rule.id,
      condition: rule.condition,
      result,
      priority: rule.priority,
      is_selected: false,
      is_fallback: false,
    });

    if (result && !selectedRule) {
      selectedRule = rule;
    }
  }

  // Only execute fallback rules if no other rule matched.
  if (!selectedRule && fallbackRules.length > 0) {
    const fallbackRule = fallbackRules[0];
    ruleLogs.push({
      rule_id: fallbackRule.id,
      condition: fallbackRule.condition,
      result: true,
      priority: fallbackRule.priority,
      is_selected: true,
      is_fallback: true,
    });
    selectedRule = fallbackRule;
  }

  // Highlight selected non-fallback rule.
  if (selectedRule && !ruleLogs.find((l) => l.rule_id === selectedRule.id)) {
    // If the selected rule was not already logged (should not happen), add it.
    ruleLogs.push({
      rule_id: selectedRule.id,
      condition: selectedRule.condition,
      result: true,
      priority: selectedRule.priority,
      is_selected: true,
      is_fallback: false,
    });
  } else {
    ruleLogs.forEach((log) => {
      if (log.rule_id === selectedRule.id) {
        // eslint-disable-next-line no-param-reassign
        log.is_selected = true;
      }
    });
  }

  const nextStepId = selectedRule ? selectedRule.next_step_id || null : null;
  const nextStepName = nextStepId && stepsById[nextStepId] ? stepsById[nextStepId].name : null;

  return {
    nextStepId,
    ruleLogs,
    selectedRule: selectedRule
      ? {
          id: selectedRule.id,
          condition: selectedRule.condition,
          priority: selectedRule.priority,
          is_fallback: Boolean(
            selectedRule.is_default ||
              (typeof selectedRule.condition === 'string' &&
                selectedRule.condition.trim().toUpperCase() === 'DEFAULT')
          ),
        }
      : null,
    nextStepName,
  };
}

module.exports = {
  executeWorkflow,
  resumeFromApproval,
  retryFailedStep,
};

