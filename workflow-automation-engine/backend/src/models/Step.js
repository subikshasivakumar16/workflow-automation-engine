const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const StepSchema = new mongoose.Schema(
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
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    step_type: {
      type: String,
      enum: ['task', 'approval', 'notification'],
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Step', StepSchema);

