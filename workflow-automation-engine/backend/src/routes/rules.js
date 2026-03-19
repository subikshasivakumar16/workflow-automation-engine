const express = require('express');
const Rule = require('../models/Rule');

const router = express.Router();

// Add rule
router.post('/steps/:step_id/rules', async (req, res) => {
  const { step_id } = req.params;
  const { condition, next_step_id, priority, is_default } = req.body;
  const rule = await Rule.create({
    step_id,
    condition: condition || '',
    next_step_id: next_step_id || null,
    priority: priority || 1,
    is_default: is_default || false,
  });
  res.status(201).json(rule);
});

// List rules
router.get('/steps/:step_id/rules', async (req, res) => {
  const { step_id } = req.params;
  const rules = await Rule.find({ step_id }).sort({ priority: 1 });
  res.json(rules);
});

// Update rule
router.put('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const rule = await Rule.findOneAndUpdate({ id }, req.body, { new: true });
  if (!rule) {
    return res.status(404).json({ message: 'Rule not found' });
  }
  res.json(rule);
});

// Delete rule
router.delete('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const rule = await Rule.findOneAndDelete({ id });
  if (!rule) {
    return res.status(404).json({ message: 'Rule not found' });
  }
  res.json({ message: 'Rule deleted' });
});

module.exports = router;

