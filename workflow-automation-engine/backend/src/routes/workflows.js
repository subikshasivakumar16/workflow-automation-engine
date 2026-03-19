const express = require('express');
const Workflow = require('../models/Workflow');
const Step = require('../models/Step');
const Rule = require('../models/Rule');

const router = express.Router();

// Create workflow
router.post('/', async (req, res) => {
  const { name, input_schema, start_step_id, is_active } = req.body;
  const workflow = await Workflow.create({
    name,
    input_schema: input_schema || {},
    start_step_id: start_step_id || null,
    is_active: is_active !== undefined ? is_active : true,
  });
  res.status(201).json(workflow);
});

// List workflows with pagination and search
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const query = {};
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Workflow.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Workflow.countDocuments(query),
  ]);

  const workflowIds = items.map((w) => w.id);
  const steps = await Step.find({ workflow_id: { $in: workflowIds } }).sort({ order: 1 }).lean();

  const stepsByWorkflowId = steps.reduce((acc, s) => {
    if (!acc[s.workflow_id]) acc[s.workflow_id] = [];
    acc[s.workflow_id].push(s);
    return acc;
  }, {});

  const stepById = steps.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {});

  const decoratedItems = items.map((wf) => {
    const wfStartId = wf.start_step_id || (stepsByWorkflowId[wf.id] && stepsByWorkflowId[wf.id][0] ? stepsByWorkflowId[wf.id][0].id : null);
    const wfStart = wfStartId ? stepById[wfStartId] : null;
    return {
      ...wf.toObject(),
      start_step_name: wfStart ? wfStart.name : null,
    };
  });

  res.json({
    items: decoratedItems,
    total,
    page: Number(page),
    limit: Number(limit),
  });
});

// Get workflow details including steps and rules
router.get('/:id', async (req, res) => {
  const workflow = await Workflow.findOne({ id: req.params.id });
  if (!workflow) {
    return res.status(404).json({ message: 'Workflow not found' });
  }
  const steps = await Step.find({ workflow_id: workflow.id }).sort({ order: 1 }).lean();

  // Derive start step name if missing (best-effort for old records).
  const startStepId = workflow.start_step_id || (steps.length > 0 ? steps[0].id : null);
  const startStep = startStepId ? steps.find((s) => s.id === startStepId) : null;

  const rules = await Rule.find({ step_id: { $in: steps.map((s) => s.id) } }).lean();
  const rulesByStep = rules.reduce((acc, r) => {
    if (!acc[r.step_id]) acc[r.step_id] = [];
    acc[r.step_id].push(r);
    return acc;
  }, {});
  const stepsWithRules = steps.map((s) => ({
    ...s,
    rules: rulesByStep[s.id] || [],
  }));
  res.json({
    workflow: {
      ...workflow.toObject(),
      start_step_name: startStep ? startStep.name : null,
    },
    steps: stepsWithRules,
  });
});

// Update workflow (create new version)
router.put('/:id', async (req, res) => {
  const existing = await Workflow.findOne({ id: req.params.id });
  if (!existing) {
    return res.status(404).json({ message: 'Workflow not found' });
  }

  const newVersion = existing.version + 1;

  existing.is_active = false;
  await existing.save();

  const { name, input_schema, start_step_id, is_active } = req.body;

  // Create a new workflow version document and copy steps + rules.
  const updatedWorkflow = await Workflow.create({
    name: name || existing.name,
    input_schema: input_schema || existing.input_schema,
    start_step_id: null,
    is_active: is_active !== undefined ? is_active : true,
    version: newVersion,
  });

  const oldSteps = await Step.find({ workflow_id: existing.id }).sort({ order: 1 }).lean();
  const oldStepIds = oldSteps.map((s) => s.id);

  const stepIdMap = {};
  for (const oldStep of oldSteps) {
    const newStep = await Step.create({
      workflow_id: updatedWorkflow.id,
      name: oldStep.name,
      step_type: oldStep.step_type,
      order: oldStep.order,
      metadata: oldStep.metadata || {},
    });
    stepIdMap[oldStep.id] = newStep.id;
  }

  const oldRules = await Rule.find({ step_id: { $in: oldStepIds } }).lean();
  for (const oldRule of oldRules) {
    const mappedNext = stepIdMap[oldRule.next_step_id] || null;
    await Rule.create({
      step_id: stepIdMap[oldRule.step_id],
      condition: oldRule.condition,
      next_step_id: mappedNext,
      priority: oldRule.priority,
      is_default: oldRule.is_default || false,
    });
  }

  // Map requested start_step_id (if provided) or fallback to previous start_step_id.
  const resolvedStartOldId = start_step_id || existing.start_step_id || (oldSteps[0] ? oldSteps[0].id : null);
  const resolvedStartNewId = resolvedStartOldId ? stepIdMap[resolvedStartOldId] : null;
  updatedWorkflow.start_step_id = resolvedStartNewId;
  await updatedWorkflow.save();

  res.json(updatedWorkflow);
});

// Delete workflow
router.delete('/:id', async (req, res) => {
  const workflow = await Workflow.findOneAndDelete({ id: req.params.id });
  if (!workflow) {
    return res.status(404).json({ message: 'Workflow not found' });
  }
  const steps = await Step.find({ workflow_id: workflow.id }).lean();
  const stepIds = steps.map((s) => s.id);
  if (stepIds.length > 0) {
    await Rule.deleteMany({ step_id: { $in: stepIds } });
  }
  await Step.deleteMany({ workflow_id: workflow.id });
  res.json({ message: 'Workflow deleted' });
});

module.exports = router;

