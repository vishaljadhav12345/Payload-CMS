
import { PayloadRequest } from 'payload/dist/express/types';
import payload from 'payload';
import { CollectionConfig } from 'payload/types';

interface WorkflowStep {
  stepId: string;
  name: string;
  type: 'approval' | 'review' | 'sign-off' | 'comment-only';
  assignedTo: { assigneeType: 'role' | 'user'; role?: string; user?: string };
  conditions?: Array<{ field: string; operator: string; value: any }>;
  slaHours?: number;
  nextSteps?: Array<{ outcome: string; nextStepId: string }>; // For conditional branching
}

interface WorkflowDoc {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

interface DocumentWithWorkflow extends Record<string, any> {
  id: string;
  workflowStatus: 'not_started' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  currentWorkflow?: string | WorkflowDoc;
  currentStep?: string;
}

// Helper to log workflow actions
export const logWorkflowAction = async ({ workflowId, documentId, collectionSlug, stepId, action, user, comment, outcome }) => {
  await payload.create({
    collection: 'workflowLogs',
    data: {
      workflow: workflowId,
      document: { relationTo: collectionSlug, value: documentId },
      stepId,
      action,
      user,
      timestamp: new Date().toISOString(),
      comment,
      outcome,
    },
  });
};

// Helper to send notifications (simulated)
export const sendWorkflowNotification = async (workflow: WorkflowDoc, step: WorkflowStep, doc: DocumentWithWorkflow, user: any) => {
  console.log(`\n--- Workflow Notification ---`);
  console.log(`Workflow: ${workflow.name}`);
  console.log(`Document: ${doc.id} (${doc.title || doc.name || doc.id}) in ${doc.collection}`);
  console.log(`Current Step: ${step.name} (${step.type})`);
  console.log(`Assigned To: ${step.assignedTo.assigneeType === 'role' ? step.assignedTo.role : step.assignedTo.user}`);
  console.log(`Action Required: Please ${step.type} this document.`);
  console.log(`-----------------------------\n`);
  // In a real application, integrate with an email service here.
};

// Helper to check step conditions
const checkConditions = (doc: DocumentWithWorkflow, conditions?: Array<{ field: string; operator: string; value: any }>): boolean => {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions, so always met
  }
  return conditions.every(condition => {
    const docValue = doc[condition.field];
    switch (condition.operator) {
      case 'equals': return docValue === condition.value;
      case 'notEquals': return docValue !== condition.value;
      case 'greaterThan': return docValue > condition.value;
      case 'lessThan': return docValue < condition.value;
      case 'contains': return String(docValue).includes(String(condition.value));
      // Add more operators as needed
      default: return false;
    }
  });
};

export const evaluateAndAdvanceWorkflow = async ({
  doc,
  req,
  collection,
  workflow,
  currentStepId,
  currentWorkflowStatus,
}: {
  doc: DocumentWithWorkflow;
  req: PayloadRequest;
  collection: CollectionConfig;
  workflow: WorkflowDoc;
  currentStepId: string;
  currentWorkflowStatus: string;
}) => {
  const currentStep = workflow.steps.find(s => s.stepId === currentStepId);

  if (!currentStep) {
    console.error(`Workflow Error: Current step ${currentStepId} not found in workflow ${workflow.name}`);
    return;
  }

  // 1. Enforce Permission-Based Step Locking (Conceptual)
  // This is primarily handled by Admin UI components preventing unauthorized actions.
  // On the backend, any action API (e.g., approve/reject) would verify user roles/ID
  // against `currentStep.assignedTo` before processing the action.
  // For `afterChange` hook, we assume the change was made by an authorized user
  // or that the change itself doesn't constitute a step action unless explicitly triggered.

  // 2. Evaluate Step Conditions
  const conditionsMet = checkConditions(doc, currentStep.conditions);

  // If conditions are not met, the step is not yet active or cannot proceed.
  // The document remains in the current step until conditions are met.
  if (!conditionsMet) {
    console.log(`Workflow: Conditions for step '${currentStep.name}' not met for document ${doc.id}. Waiting.`);
    return;
  }

  // 3. Handle SLA and Auto-Escalation (Bonus)
  if (currentStep.slaHours) {
    // In a real system, you'd store the step start time and run a cron job
    // to check for overdue steps. For this example, we'll just log.
    console.log(`SLA for step '${currentStep.name}' is ${currentStep.slaHours} hours.`);
    // Logic for checking if SLA is passed and triggering escalation (e.g., sending another notification)
    // would go here, likely in a separate scheduled task.
  }

  // 4. Determine Next Step (Conditional Branching Bonus)
  // This part assumes an action (e.g., 'approved', 'rejected') has been performed
  // and recorded, or that the step type is 'comment-only' and automatically advances.
  // For `afterChange`, we primarily react to changes that *might* complete a step.
  // Actual step completion and advancement will often be triggered by custom API endpoints
  // (e.g., /workflows/action) or Admin UI actions that update the document.

  // If the step is 'comment-only', it might auto-advance once conditions are met.
  if (currentStep.type === 'comment-only') {
    const nextStepIndex = workflow.steps.findIndex(s => s.stepId === currentStepId) + 1;
    const nextStep = workflow.steps[nextStepIndex];

    if (nextStep) {
      await payload.update({
        collection: doc.collection,
        id: doc.id,
        data: {
          currentStep: nextStep.stepId,
        },
      });
      await logWorkflowAction({
        workflowId: workflow.id,
        documentId: doc.id,
        collectionSlug: collection.slug,
        stepId: currentStepId,
        action: 'completed',
        user: req.user ? req.user.id : null,
        comment: 'Comment-only step auto-completed',
        outcome: 'completed',
      });
      await sendWorkflowNotification(workflow, nextStep, doc, req.user);
      console.log(`Workflow: Document ${doc.id} advanced to step '${nextStep.name}'.`);
    } else {
      // Workflow completed
      await payload.update({
        collection: doc.collection,
        id: doc.id,
        data: {
          workflowStatus: 'completed',
          currentStep: undefined,
        },
      });
      await logWorkflowAction({
        workflowId: workflow.id,
        documentId: doc.id,
        collectionSlug: collection.slug,
        stepId: currentStepId,
        action: 'completed',
        user: req.user ? req.user.id : null,
        comment: 'Workflow completed',
        outcome: 'completed',
      });
      console.log(`Workflow: Document ${doc.id} workflow completed.`);
    }
  }

  // For 'approval', 'review', 'sign-off' types, advancement will typically happen
  // via a custom API endpoint (e.g., POST /workflows/action) that updates the document
  // and then triggers this `afterChange` hook again.
  // The `afterChange` hook would then re-evaluate based on the new state.
};

// This logic would typically be part of an explicit action handler (e.g., when a user clicks 'Approve' or 'Reject')
// For demonstration, let's assume 'actionOutcome' is passed to a function that advances the workflow.

export const advanceWorkflowWithOutcome = async (
  doc: DocumentWithWorkflow,
  workflow: WorkflowDoc,
  currentStep: WorkflowStep,
  actionOutcome: string,
  user: any,
  collection: CollectionConfig
) => {
  let nextStepId: string | null = null;

  if (currentStep.nextSteps && currentStep.nextSteps.length > 0) {
    const branch = currentStep.nextSteps.find(ns => ns.outcome === actionOutcome);
    if (branch) {
      nextStepId = branch.nextStepId;
    } else {
      // No specific branch for this outcome, fall back to sequential or error
      console.warn(`No specific branch defined for outcome '${actionOutcome}' from step '${currentStep.stepId}'.`);
    }
  }

  if (!nextStepId) {
    // Fallback to next sequential step if no branching or no matching outcome
    const currentStepIndex = workflow.steps.findIndex(s => s.stepId === currentStep.stepId);
    const nextSequentialStep = workflow.steps[currentStepIndex + 1];
    if (nextSequentialStep) {
      nextStepId = nextSequentialStep.stepId;
    }
  }

  if (nextStepId) {
    const nextStep = workflow.steps.find(s => s.stepId === nextStepId);
    if (nextStep) {
      await payload.update({
        collection: collection.slug,
        id: doc.id,
        data: {
          currentStep: nextStep.stepId,
          // Update workflow history array if applicable
        },
      });
      await logWorkflowAction({
        workflowId: workflow.id,
        documentId: doc.id,
        collectionSlug: doc.collection,
        stepId: currentStep.stepId,
        action: actionOutcome, // Log the specific action (approved/rejected)
        user: user.id,
        comment: 'Step completed and workflow advanced',
        outcome: actionOutcome,
      });
      await sendWorkflowNotification(workflow, nextStep, doc, user);
      console.log(`Workflow: Document ${doc.id} advanced to step '${nextStep.name}' via conditional branching.`);
    } else {
      console.error(`Workflow Error: Next step ${nextStepId} not found.`);
    }
  } else {
    // Workflow completed if no next step
    await payload.update({
      collection: doc.collection,
      id: doc.id,
      data: {
        workflowStatus: 'completed',
        currentStep: undefined,
      },
    });
    await logWorkflowAction({
      workflowId: workflow.id,
      documentId: doc.id,
        collectionSlug: doc.collection,
        stepId: currentStep.stepId,
      action: actionOutcome,
      user: user.id,
      comment: 'Workflow completed',
      outcome: actionOutcome,
    });
    console.log(`Workflow: Document ${doc.id} workflow completed.`);
  }
};


