const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const WorkflowSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    input_schema: {
      type: Object,
      default: {},
    },
    start_step_id: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Workflow', WorkflowSchema);

