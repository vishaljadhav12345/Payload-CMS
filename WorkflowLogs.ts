import { CollectionConfig } from 'payload/types';

const WorkflowLogs: CollectionConfig = {
  slug: 'workflowLogs',
  admin: {
    useAsTitle: 'action',
    // Logs should not be editable via Admin UI
  },
  fields: [
    {
      name: 'workflow',
      type: 'relationship',
      relationTo: 'workflows',
      required: true,
    },
    {
      name: 'document',
      type: 'relationship',
      relationTo: ["blogs", "products", "contracts"], // Example collections, extend as needed
      required: true,
      admin: {
        description: "The document this log entry pertains to.",
      },
    },
    {
      name: 'stepId',
      type: 'text',
      required: true,
    },
    {
      name: 'action',
      type: 'select',
      options: ['approved', 'rejected', 'commented', 'triggered', 'escalated', 'reassigned'],
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'comment',
      type: 'textarea',
    },
    {
      name: 'outcome',
      type: 'text',
      admin: {
        description: 'Specific outcome of an approval/review step (e.g., approved, rejected).',
      },
    },
  ],
  // Ensure immutability: prevent updates and deletes via hooks if necessary
  hooks: {
    beforeChange: [({ req, operation }: { req: any; operation: 'create' | 'update' | 'delete' }) => {
      if (operation === 'update' || operation === 'delete') {
        throw new Error('Workflow logs are immutable and cannot be updated or deleted.');
      }
    }],
  },
};

export default WorkflowLogs;


