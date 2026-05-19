export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: "admin" | "user";
  status: "active" | "disabled" | "deleted";
  createdAt: string;
  updatedAt: string;
  
  // App specific legacy fields
  password?: string;
  permissions?: {
    workspace: boolean;
    canvas: boolean;
    isAdmin: boolean;
  };
  lastLogin?: string;
  actions?: Array<{ id: string; time: string; action: string; }>;
}

export type CreateUserInput = Omit<User, "id" | "createdAt" | "updatedAt" | "status">;
export type UpdateUserInput = Partial<Omit<User, "id" | "createdAt" | "updatedAt">>;
