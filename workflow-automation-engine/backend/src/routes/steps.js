const express = require('express');
const Step = require('../models/Step');
const Workflow = require('../models/Workflow');

const router = express.Router();

// Add step
router.post('/workflows/:workflow_id/steps', async (req, res) => {
  const { workflow_id } = req.params;
  const { name, step_type, order, metadata } = req.body;

  if (!name || !step_type || typeof order !== 'number') {
    return res.status(400).json({ message: 'name, step_type, and order are required' });
  }

  const step = await Step.create({
    workflow_id,
    name,
    step_type,
    order,
    metadata: metadata || {},
  });

  // If start_step_id is missing, assign the first created step as start.
  const workflow = await Workflow.findOne({ id: workflow_id });
  if (workflow && !workflow.start_step_id) {
    workflow.start_step_id = step.id;
    await workflow.save();
  }
  res.status(201).json(step);
});

// List steps
router.get('/workflows/:workflow_id/steps', async (req, res) => {
  const { workflow_id } = req.params;
  const steps = await Step.find({ workflow_id }).sort({ order: 1 });
  res.json(steps);
});

// Update step
router.put('/steps/:id', async (req, res) => {
  const { id } = req.params;
  const step = await Step.findOneAndUpdate({ id }, req.body, { new: true });
  if (!step) {
    return res.status(404).json({ message: 'Step not found' });
  }
  res.json(step);
});

// Delete step
router.delete('/steps/:id', async (req, res) => {
  const { id } = req.params;
  const step = await Step.findOneAndDelete({ id });
  if (!step) {
    return res.status(404).json({ message: 'Step not found' });
  }
  res.json({ message: 'Step deleted' });
});

module.exports = router;

