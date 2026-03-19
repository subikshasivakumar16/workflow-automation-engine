const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const RuleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: uuidv4,
      unique: true,
      index: true,
    },
    step_id: {
      type: String,
      required: true,
      index: true,
    },
    condition: {
      type: String,
      required: true,
    },
    next_step_id: {
      type: String,
      required: false,
    },
    priority: {
      type: Number,
      required: true,
      default: 1,
    },
    is_default: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rule', RuleSchema);

