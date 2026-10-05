export type UserRole = 'developer' | 'admin' | 'technician' | 'viewer';

export interface UserPermissions {
  canAddTools: boolean;
  canEditTools: boolean;
  canDeleteTools: boolean;
  canExportDownload: boolean;
  canAccessAppsScript: boolean;
  canAccessBackups: boolean;
  canAccessNotifications: boolean;
  canManageUsers: boolean;
}

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash?: string;
  permissions: UserPermissions;
  createdAt: string;
  lastLogin?: string;
}

export interface AuthState {
  currentUser: AppUser | null;
  isUnlocked: boolean; // True if logged in as developer, admin, or user with elevated permissions
  role: UserRole;
}
