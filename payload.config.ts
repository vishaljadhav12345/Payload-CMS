import { buildConfig } from 'payload/config';
import path from 'path';
import Users from './collections/Users';
import Workflows from './collections/Workflows';
import WorkflowLogs from './collections/WorkflowLogs';
import { evaluateAndAdvanceWorkflow, logWorkflowAction, sendWorkflowNotification } from './utilities/evaluateAndAdvanceWorkflow';
// import WorkflowPanel from './admin/components/WorkflowPanel';
// TODO: Ensure WorkflowPanel component exists at the specified path or update the path accordingly.

// Example Collections to be extended
import { CollectionConfig } from 'payload/types';
import payload from 'payload';
import { BaseDatabaseAdapter } from 'payload/dist/database/types';
import { Payload } from 'payload/dist/payload';

const createWorkflowEnabledCollection = (slug: string): CollectionConfig => ({
  slug: slug,
  admin: {
    useAsTitle: 'title',
    components: {
      edit: {
        // Custom edit components can be added here if supported by Payload CMS
      },
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea',
    },
    // Workflow-related fields
    {
      name: 'workflowStatus',
      type: 'select',
      options: ['not_started', 'in_progress', 'completed', 'rejected', 'cancelled'],
      defaultValue: 'not_started',
      admin: { readOnly: true },
    },
    {
      name: 'currentWorkflow',
      type: 'relationship',
      relationTo: 'workflows',
      admin: { readOnly: true },
    },
    {
      name: 'currentStep',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'workflowHistory',
      type: 'array',
      fields: [
        { name: 'stepId', type: 'text' },
        { name: 'status', type: 'select', options: ['pending', 'approved', 'rejected'] },
        { name: 'assignedTo', type: 'text' },
        { name: 'lastActionBy', type: 'relationship', relationTo: 'users' },
        { name: 'lastActionDate', type: 'date' },
      ],
      admin: { readOnly: true },
    },
  ],
  hooks: {
    afterChange: [async ({ doc, req, collection }) => {
      const { payload: payloadInstance } = req;

      // Find workflows applicable to this collection
      const workflows = await payloadInstance.find({
        collection: 'workflows',
        where: {
          appliesTo: {
            contains: collection.slug,
          },
        },
      });

      if (workflows.docs.length === 0) {
        return doc; // No workflow applies to this collection
      }

      // Assuming for simplicity, one workflow per collection for now.
      const workflow = workflows.docs[0]; 

      let currentWorkflowStatus = doc.workflowStatus || 'not_started';
      let currentStepId = doc.currentStep;

      // Initialize workflow for new documents or if not started
      if (currentWorkflowStatus === 'not_started' || !currentStepId) {
        const firstStep = workflow.steps[0];
        if (firstStep) {
          currentStepId = firstStep.stepId;
          currentWorkflowStatus = 'in_progress';
          await payloadInstance.update({
            collection: collection.slug,
            id: doc.id,
            data: {
              workflowStatus: currentWorkflowStatus,
              currentWorkflow: workflow.id,
              currentStep: currentStepId,
            },
          });
          // Log workflow initiation
          await logWorkflowAction({
            workflowId: workflow.id,
            documentId: doc.id,
            collectionSlug: collection.slug,
            stepId: currentStepId,
            action: 'triggered',
            user: req.user ? req.user.id : null,
            comment: 'Workflow initiated',
          });
          // Send notification for the first step
          await sendWorkflowNotification(workflow, firstStep, doc, req.user);
        }
      }

      // Further logic to evaluate step completion, transition to next step, etc.
      await evaluateAndAdvanceWorkflow({
        doc, 
        req, 
        collection, 
        workflow, 
        currentStepId,
        currentWorkflowStatus
      });

      return doc;
    }],
  },
});

const Blogs = createWorkflowEnabledCollection('blogs');
const Products = createWorkflowEnabledCollection('products');
const Contracts = createWorkflowEnabledCollection('contracts');

export default buildConfig({
  serverURL: 'http://localhost:3000',
  admin: {
    user: Users.slug,
  },
  collections: [
    Users,
    Workflows,
    WorkflowLogs,
    Blogs,
    Products,
    Contracts,
  ],
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
  },
  endpoints: [
    {
      path: '/workflows/trigger',
      method: 'post',
      handler: async (req, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
          }

          const { collectionSlug, documentId, workflowId } = req.body;

          if (!collectionSlug || !documentId) {
            return res.status(400).json({ message: 'Missing collectionSlug or documentId' });
          }

          const doc = await payload.findByID({
            collection: collectionSlug,
            id: documentId,
          });

          if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
          }

          let workflowToTrigger;
          if (workflowId) {
            workflowToTrigger = await payload.findByID({
              collection: 'workflows',
              id: workflowId,
            });
            if (!workflowToTrigger) {
              return res.status(404).json({ message: 'Specified workflow not found' });
            }
          } else {
            const workflows = await payload.find({
              collection: 'workflows',
              where: {
                appliesTo: {
                  contains: collectionSlug,
                },
              },
            });
            if (workflows.docs.length === 0) {
              return res.status(404).json({ message: 'No applicable workflow found for this collection' });
            }
            workflowToTrigger = workflows.docs[0];
          }

          const firstStep = workflowToTrigger.steps[0];
          if (!firstStep) {
            return res.status(400).json({ message: 'Workflow has no steps defined' });
          }

          await payload.update({
            collection: collectionSlug,
            id: documentId,
            data: {
              workflowStatus: 'in_progress',
              currentWorkflow: workflowToTrigger.id,
              currentStep: firstStep.stepId,
            },
          });

          await logWorkflowAction({
            workflowId: workflowToTrigger.id,
            documentId: doc.id,
            collectionSlug: collectionSlug,
            stepId: firstStep.stepId,
            action: 'triggered',
            user: req.user.id,
            comment: 'Workflow manually triggered',
          });

          await evaluateAndAdvanceWorkflow({
            doc: { ...doc, workflowStatus: 'in_progress', currentWorkflow: workflowToTrigger.id, currentStep: firstStep.stepId },
            req,
            collection: payload.collections[collectionSlug].config,
            workflow: workflowToTrigger,
            currentStepId: firstStep.stepId,
            currentWorkflowStatus: 'in_progress',
          });

          return res.status(200).json({ message: 'Workflow triggered successfully', workflow: workflowToTrigger.id });
        } catch (error) {
          console.error('Error triggering workflow:', error);
          return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
      },
    },
    {
      path: '/workflows/status/:docId',
      method: 'get',
      handler: async (req, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
          }

          const { docId } = req.params;
          const { collectionSlug } = req.query;

          if (!collectionSlug) {
            return res.status(400).json({ message: 'Missing collectionSlug query parameter' });
          }

          const doc = await payload.findByID({
            collection: collectionSlug as string,
            id: docId,
          });

          if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
          }

          let currentWorkflowDetails: any = undefined;
          let currentStepDetails: any = undefined;

          if (doc.currentWorkflow) {
            currentWorkflowDetails = await payload.findByID({
              collection: 'workflows',
              id: typeof doc.currentWorkflow === 'object' && doc.currentWorkflow !== null && 'id' in doc.currentWorkflow
                ? String((doc.currentWorkflow as { id: string | number }).id)
                : String(doc.currentWorkflow),
            });

            if (doc.currentStep && currentWorkflowDetails) {
              currentStepDetails = currentWorkflowDetails.steps.find(
                (step) => step.stepId === doc.currentStep
              );
            }
          }

          const workflowLogs = await payload.find({
            collection: 'workflowLogs',
            where: {
              'document.value': {
                equals: docId,
              },
              'document.relationTo': {
                equals: collectionSlug,
              },
            },
            sort: '-timestamp',
          });

          return res.status(200).json({
            documentId: doc.id,
            collectionSlug: collectionSlug,
            workflowStatus: doc.workflowStatus,
            currentWorkflow: currentWorkflowDetails ? { id: currentWorkflowDetails.id, name: currentWorkflowDetails.name } : null,
            currentStep: currentStepDetails || null,
            workflowLogs: workflowLogs.docs.map(log => ({
              id: log.id,
              stepId: log.stepId,
              action: log.action,
              user: (log.user && typeof log.user === 'object' && 'id' in log.user && 'name' in log.user)
                ? { id: (log.user as any).id, name: (log.user as any).name }
                : null,
              timestamp: log.timestamp,
              comment: log.comment,
              outcome: log.outcome,
            })),
          });
        } catch (error) {
          console.error('Error fetching workflow status:', error);
          return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
      },
    },
    {
      path: '/workflows/action',
      method: 'post',
      handler: async (req, res) => {
        try {
          if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
          }

          const { documentId, collectionSlug, workflowId, stepId, action, outcome, comment } = req.body;

          if (!documentId || !collectionSlug || !workflowId || !stepId || !action) {
            return res.status(400).json({ message: 'Missing required fields' });
          }

          const doc = await payload.findByID({
            collection: collectionSlug,
            id: documentId,
          });

          if (!doc) {
            return res.status(404).json({ message: 'Document not found' });
          }

          const workflow = await payload.findByID({
            collection: 'workflows',
            id: workflowId,
          });

          if (!workflow) {
            return res.status(404).json({ message: 'Workflow definition not found' });
          }

          const steps = Array.isArray(workflow.steps) ? workflow.steps as Array<{ stepId: string; assignedTo: any; nextSteps?: any[] }> : [];
          const currentStep = steps.find(s => s.stepId === stepId);

          if (!currentStep) {
            return res.status(404).json({ message: 'Current step not found in workflow definition' });
          }

          let isAuthorized = false;
          if (currentStep.assignedTo.assigneeType === 'user') {
            isAuthorized = currentStep.assignedTo.user === req.user.id;
          } else if (currentStep.assignedTo.assigneeType === 'role') {
            isAuthorized = req.user.roles && req.user.roles.includes(currentStep.assignedTo.role);
          }

          if (!isAuthorized) {
            return res.status(403).json({ message: 'Forbidden: You are not authorized to perform this action on this step.' });
          }

          await logWorkflowAction({
            workflowId: workflowId,
            documentId: documentId,
            collectionSlug: collectionSlug,
            stepId: stepId,
            action: action,
            user: req.user.id,
            comment: comment,
            outcome: outcome,
          });

          let nextStepId: string | null = null;
          if (currentStep.nextSteps && currentStep.nextSteps.length > 0) {
            const branch = currentStep.nextSteps.find(ns => ns.outcome === outcome);
            if (branch) {
              nextStepId = branch.nextStepId;
            }
          }

          if (!nextStepId) {
            const stepsArray = Array.isArray(workflow.steps) ? workflow.steps as Array<{ stepId: string }> : [];
            const currentStepIndex = stepsArray.findIndex(s => s.stepId === stepId);
            const nextSequentialStep = stepsArray[currentStepIndex + 1];
            if (nextSequentialStep) {
              nextStepId = nextSequentialStep.stepId;
            }
          }

          let updatedWorkflowStatus = doc.workflowStatus;
          if (!nextStepId) {
            updatedWorkflowStatus = 'completed';
          }

          await payload.update({
            collection: collectionSlug,
            id: documentId,
            data: {
              workflowStatus: updatedWorkflowStatus,
              ...(nextStepId !== null ? { currentStep: nextStepId } : {}),
            },
          });

          if (nextStepId) {
            const updatedDoc = await payload.findByID({ collection: collectionSlug, id: documentId });
            await evaluateAndAdvanceWorkflow({
              doc: updatedDoc,
              req,
              collection: payload.collections[collectionSlug].config,
              workflow,
              currentStepId: nextStepId,
              currentWorkflowStatus: updatedWorkflowStatus,
            });
          }

          return res.status(200).json({ message: 'Workflow action performed successfully', nextStep: nextStepId });
        } catch (error) {
          console.error('Error performing workflow action:', error);
          return res.status(500).json({ message: 'Internal server error', error: error.message });
        }
      },
    },
  ],
  db: function (args: { payload: Payload; }): BaseDatabaseAdapter {
    throw new Error('Function not implemented.');
  },
  editor: undefined
});


