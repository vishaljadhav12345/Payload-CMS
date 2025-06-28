import { CollectionConfig } from 'payload/types';

const Workflows: CollectionConfig = {
  slug: 'workflows',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'appliesTo',
      type: 'relationship',
      relationTo: 'collections',
      hasMany: true,
      admin: {
        description: 'Select the collections this workflow applies to.',
      },
    },
    {
      name: 'steps',
      type: 'array',
      fields: [
        {
          name: 'stepId',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            description: 'Unique identifier for this step (e.g., initial_review, legal_approval)',
          },
        },
        {
          name: 'name',
          type: 'text',
          required: true,
        },
        {
          name: 'type',
          type: 'select',
          options: ['approval', 'review', 'sign-off', 'comment-only'],
          required: true,
        },
        {
          name: 'assignedTo',
          type: 'group',
          fields: [
            {
              name: 'assigneeType',
              type: 'select',
              options: ['role', 'user'],
              required: true,
            },
            {
              name: 'role',
              type: 'select',
              options: [], // Populate with actual roles from your Payload config
              admin: {
                condition: (_, siblingData) => siblingData.assigneeType === 'role',
              },
            },
            {
              name: 'user',
              type: 'relationship',
              relationTo: 'users',
              admin: {
                condition: (_, siblingData) => siblingData.assigneeType === 'user',
              },
            },
          ],
        },
        {
          name: 'conditions',
          type: 'array',
          fields: [
            {
              name: 'field',
              type: 'text',
              required: true,
            },
            {
              name: 'operator',
              type: 'select',
              options: ['equals', 'notEquals', 'greaterThan', 'lessThan', 'contains'],
              required: true,
            },
            {
              name: 'value',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'slaHours',
          type: 'number',
          admin: {
            description: 'Service Level Agreement in hours for this step. (Bonus)',
          },
        },
        {
          name: 'nextSteps',
          type: 'array',
          fields: [
            {
              name: 'outcome',
              type: 'text',
              required: true,
              admin: {
                description: 'e.g., approved, rejected, completed',
              },
            },
            {
              name: 'nextStepId',
              type: 'text',
              required: true,
              admin: {
                description: 'The stepId of the next step to transition to.',
              },
            },
          ],
          admin: {
            description: 'Define conditional branching based on step outcome. (Bonus)',
          },
        },
      ],
    },
  ],
};

export default Workflows;


