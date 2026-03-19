const Workflow = require('./models/Workflow');
const Step = require('./models/Step');
const Rule = require('./models/Rule');

async function seedSampleData() {
  const workflow = await Workflow.findOne({ name: 'Expense Approval' });
  if (workflow) {
    const steps = await Step.find({ workflow_id: workflow.id }).lean();
    const managerApproval = steps.find((s) => s.name === 'Manager Approval');
    const financeNotification = steps.find((s) => s.name === 'Finance Notification');
    const rejectionTask = steps.find((s) => s.name === 'Task Rejection');

    if (!managerApproval || !financeNotification || !rejectionTask) {
      // If steps are missing, re-seed by creating a new workflow is outside scope.
      return;
    }

    const managerRules = await Rule.find({ step_id: managerApproval.id }).lean();
    const financeRules = await Rule.find({ step_id: financeNotification.id }).lean();
    const rejectionRules = await Rule.find({ step_id: rejectionTask.id }).lean();

    // Manager rules
    const financeRule = managerRules.find(
      (r) => r.next_step_id === financeNotification.id && r.priority === 1
    );
    if (!financeRule) {
      await Rule.create({
        step_id: managerApproval.id,
        condition: 'amount > 100',
        next_step_id: financeNotification.id,
        priority: 1,
        is_default: false,
      });
    } else {
      await Rule.updateOne(
        { id: financeRule.id },
        { condition: 'amount > 100', next_step_id: financeNotification.id, is_default: false }
      );
    }

    const fallbackRule = managerRules.find(
      (r) => r.next_step_id === rejectionTask.id && r.priority === 100
    );
    if (!fallbackRule) {
      await Rule.create({
        step_id: managerApproval.id,
        condition: 'DEFAULT',
        next_step_id: rejectionTask.id,
        priority: 100,
        is_default: false,
      });
    } else {
      await Rule.updateOne(
        { id: fallbackRule.id },
        { condition: 'DEFAULT', next_step_id: rejectionTask.id, is_default: false }
      );
    }

    // Finance notification end rule
    const financeEndRule = financeRules.find((r) => r.next_step_id === null && r.priority === 1);
    if (!financeEndRule) {
      await Rule.create({
        step_id: financeNotification.id,
        condition: 'DEFAULT',
        next_step_id: null,
        priority: 1,
        is_default: false,
      });
    } else {
      await Rule.updateOne(
        { id: financeEndRule.id },
        { condition: 'DEFAULT', next_step_id: null, is_default: false }
      );
    }

    // Rejection task end rule
    const rejectionEndRule = rejectionRules.find((r) => r.next_step_id === null && r.priority === 1);
    if (!rejectionEndRule) {
      await Rule.create({
        step_id: rejectionTask.id,
        condition: 'DEFAULT',
        next_step_id: null,
        priority: 1,
        is_default: false,
      });
    } else {
      await Rule.updateOne(
        { id: rejectionEndRule.id },
        { condition: 'DEFAULT', next_step_id: null, is_default: false }
      );
    }

    return;
  }

  const workflowCreated = await Workflow.create({
    name: 'Expense Approval',
    input_schema: {
      amount: { type: 'number', required: true },
      country: { type: 'string', required: true },
      employee: { type: 'string', required: true },
    },
    is_active: true,
  });

  const managerApproval = await Step.create({
    workflow_id: workflowCreated.id,
    name: 'Manager Approval',
    step_type: 'approval',
    order: 1,
    metadata: {},
  });

  const financeNotification = await Step.create({
    workflow_id: workflowCreated.id,
    name: 'Finance Notification',
    step_type: 'notification',
    order: 2,
    metadata: {
      message: 'Expense approved for {{employee}} with amount {{amount}}',
    },
  });

  const rejectionTask = await Step.create({
    workflow_id: workflowCreated.id,
    name: 'Task Rejection',
    step_type: 'task',
    order: 3,
    metadata: {},
  });

  workflowCreated.start_step_id = managerApproval.id;
  await workflowCreated.save();

  await Rule.create({
    step_id: managerApproval.id,
    condition: "amount > 100",
    next_step_id: financeNotification.id,
    priority: 1,
    is_default: false,
  });

  await Rule.create({
    step_id: managerApproval.id,
    condition: 'DEFAULT',
    next_step_id: rejectionTask.id,
    priority: 100,
    is_default: false,
  });

  // Default rule after finance notification to end workflow
  await Rule.create({
    step_id: financeNotification.id,
    condition: 'DEFAULT',
    next_step_id: null,
    priority: 1,
    is_default: false,
  });

  // Default rule after rejection task to end workflow
  await Rule.create({
    step_id: rejectionTask.id,
    condition: 'DEFAULT',
    next_step_id: null,
    priority: 1,
    is_default: false,
  });
}

module.exports = {
  seedSampleData,
};

