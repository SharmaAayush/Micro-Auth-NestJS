export type User = {
  id: number;
  email: string;
  password: string;
  name: string;
};

export const users: User[] = [
  {
    id: 1,
    email: 'user1@example.com',
    password: 'password123',
    name: 'User One',
  },
  {
    id: 2,
    email: 'user2@example.com',
    password: 'password456',
    name: 'User Two',
  },
];
