import { CollectionConfig } from 'payload/types';

const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      options: [
        'admin',
        'editor',
        'user',
      ],
      defaultValue: 'user',
      required: true,
      hasMany: true,
    },
  ],
};

export default Users;


