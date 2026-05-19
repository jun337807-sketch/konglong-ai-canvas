import { CreateUserInput, UpdateUserInput, User } from '../types/user';
import { UserService } from '../services/userService';

export interface UserRepository {
  list(): Promise<User[]>;
  getByUsername(username: string): Promise<User | undefined>;
  create(input: CreateUserInput): Promise<User>;
  updateByUsername(username: string, updates: UpdateUserInput): Promise<User>;
}

function mapApiUser(apiUser: any): User {
  return {
    id: apiUser.id,
    username: apiUser.username,
    displayName: apiUser.display_name,
    role: apiUser.role,
    status: apiUser.status,
    createdAt: apiUser.created_at,
    updatedAt: apiUser.updated_at,
    lastLogin: apiUser.last_login_at || undefined,
    actions: [],
    permissions: {
      workspace: apiUser.role === 'admin',
      canvas: true,
      isAdmin: apiUser.role === 'admin'
    }
  };
}

class ApiFirstUserRepository implements UserRepository {
  async list(): Promise<User[]> {
    try {
      const res = await fetch('/api/users').then(r => r.json());
      if (res.success) return (res.users || []).map(mapApiUser);
    } catch (e) {
      console.warn('Failed to load users from API, falling back to local storage', e);
    }
    return UserService.getUsers();
  }

  async getByUsername(username: string): Promise<User | undefined> {
    const users = await this.list();
    return users.find(user => user.username === username);
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: input.username,
          password: input.password,
          displayName: input.displayName,
          role: input.role
        })
      }).then(r => r.json());
      if (res.success && res.user) return mapApiUser(res.user);
      throw new Error(res.error || 'Failed to create user');
    } catch (e) {
      console.warn('Failed to create user via API, falling back to local storage', e);
      return UserService.createUser(input);
    }
  }

  async updateByUsername(username: string, updates: UpdateUserInput): Promise<User> {
    try {
      const current = await this.getByUsername(username);
      if (!current) throw new Error('user not found');

      const res = await fetch(`/api/users/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: updates.displayName,
          password: updates.password,
          role: updates.role,
          status: updates.status,
          lastLoginAt: updates.lastLogin
        })
      }).then(r => r.json());

      if (res.success && res.user) return mapApiUser(res.user);
      throw new Error(res.error || 'Failed to update user');
    } catch (e) {
      console.warn('Failed to update user via API, falling back to local storage', e);
      return UserService.updateUserByUsername(username, updates);
    }
  }
}

export const userRepository: UserRepository = new ApiFirstUserRepository();
