import { User, CreateUserInput, UpdateUserInput } from '../types/user';
// import { v4 as uuidv4 } from 'uuid'; // Removed uuid dependency


const USERS_STORAGE_KEY = 'dino_persist_users_v2'; // Changed key to avoid conflict with legacy data

/**
 * 用户服务 - 原型级持久化设计
 * 目前使用 localStorage 进行临时持久化
 * 未来迁移到真实后端时，只需将这里的方法替换为真实的 API 请求即可
 * 例如:
 * getUsers() -> fetch('/api/users')
 * createUser(data) -> fetch('/api/users', { method: 'POST', body: JSON.stringify(data) })
 */
export class UserService {
  
  // 模拟从数据库获取全量非删除用户
  static getUsers(): User[] {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      // 默认初始化一个管理员账号，方便测试
      const defaultAdmin: User = {
        id: crypto.randomUUID(),
        username: 'admin',
        displayName: '系统管理员',
        password: 'admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        permissions: { workspace: true, canvas: true, isAdmin: true },
        lastLogin: '从未登录',
        actions: []
      };
      this.saveUsers([defaultAdmin]);
      return [defaultAdmin];
    }
    try {
      const users: User[] = JSON.parse(raw);
      return users.filter(u => u.status !== 'deleted');
    } catch (e) {
      console.error('Failed to parse users from localStorage', e);
      return [];
    }
  }

  // 获取单个用户
  static getUserById(id: string): User | undefined {
    const users = this.getAllUsersIncludeDeleted();
    return users.find(u => u.id === id && u.status !== 'deleted');
  }
  
  static getUserByUsername(username: string): User | undefined {
    const users = this.getAllUsersIncludeDeleted();
    return users.find(u => u.username === username && u.status !== 'deleted');
  }

  // 创建用户
  static createUser(input: CreateUserInput): User {
    const users = this.getAllUsersIncludeDeleted();
    
    if (users.some(u => u.username === input.username && u.status !== 'deleted')) {
      throw new Error('用户名已存在');
    }

    const newUser: User = {
      role: 'user', // default Role
      displayName: input.username,
      permissions: { workspace: false, canvas: false, isAdmin: false },
      lastLogin: '从未登录',
      actions: [],
      ...input,
      id: crypto.randomUUID(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveUsers(users);
    
    return newUser;
  }

  // 更新用户
  static updateUser(id: string, updates: UpdateUserInput): User {
    const users = this.getAllUsersIncludeDeleted();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('用户不存在');
    }

    const updatedUser = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    users[index] = updatedUser;
    this.saveUsers(users);
    
    return updatedUser;
  }

  static updateUserByUsername(username: string, updates: UpdateUserInput): User {
    const user = this.getUserByUsername(username);
    if (!user) throw new Error('用户不存在');
    return this.updateUser(user.id, updates);
  }

  // 禁用用户
  static disableUser(id: string): User {
    return this.updateUser(id, { status: 'disabled' });
  }
  
  static enableUser(id: string): User {
    return this.updateUser(id, { status: 'active' });
  }

  // 软删除用户
  static softDeleteUser(id: string): void {
    const users = this.getAllUsersIncludeDeleted();
    const index = users.findIndex(u => u.id === id);
    
    if (index !== -1) {
      users[index].status = 'deleted';
      users[index].updatedAt = new Date().toISOString();
      this.saveUsers(users);
    }
  }
  
  // 恢复被软删除的用户
  static restoreUser(id: string): void {
    const users = this.getAllUsersIncludeDeleted();
    const index = users.findIndex(u => u.id === id);
    
    if (index !== -1 && users[index].status === 'deleted') {
      users[index].status = 'active';
      users[index].updatedAt = new Date().toISOString();
      this.saveUsers(users);
    }
  }

  // --- 内部私有方法 ---
  
  private static getAllUsersIncludeDeleted(): User[] {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  private static saveUsers(users: User[]): void {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
}
