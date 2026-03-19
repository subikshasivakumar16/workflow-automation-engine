const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ExecutionLogSchema = new mongoose.Schema(
  {
    step_id: String,
    step_name: String,
    step_type: String,
    message: String,
    evaluated_rules: [
      {
        rule_id: String,
        condition: String,
        result: Boolean,
        priority: Number,
        is_selected: Boolean,
        is_fallback: Boolean,
      },
    ],
    selected_next_step_id: String,
    next_step_name: String,
    selected_rule: {
      type: Object,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'paused'],
    },
    error_message: String,
    started_at: {
      type: Date,
      default: Date.now,
    },
    ended_at: {
      type: Date,
    },
  },
  { _id: false }
);

const ExecutionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    workflow_id: {
      type: String,
      required: true,
    },
    workflow_version: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed', 'canceled', 'paused'],
      default: 'pending',
    },
    data: {
      type: Object,
      default: {},
    },
    logs: [ExecutionLogSchema],
    current_step_id: {
      type: String,
      default: null,
    },
    pending_next_step_id: {
      type: String,
      default: null,
    },
    pending_next_step_name: {
      type: String,
      default: null,
    },
    retries: {
      type: Number,
      default: 0,
    },
    triggered_by: {
      type: String,
      default: 'system',
    },
    max_iterations: {
      type: Number,
      default: 100,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Execution', ExecutionSchema);

