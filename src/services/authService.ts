import { AppUser, AuthState, UserPermissions, UserRole } from '../types/auth';

const STORAGE_USERS_KEY = 'sheetsync_auth_users';
const STORAGE_CURRENT_USER_KEY = 'sheetsync_auth_session';

export const DEFAULT_ADMIN_PERMISSIONS: UserPermissions = {
  canAddTools: true,
  canEditTools: true,
  canDeleteTools: true,
  canExportDownload: true,
  canAccessAppsScript: true,
  canAccessBackups: true,
  canAccessNotifications: true,
  canManageUsers: true,
};

export const DEFAULT_VIEWER_PERMISSIONS: UserPermissions = {
  canAddTools: false,
  canEditTools: false,
  canDeleteTools: false,
  canExportDownload: false,
  canAccessAppsScript: false,
  canAccessBackups: false,
  canAccessNotifications: false,
  canManageUsers: false,
};

const INITIAL_USERS: AppUser[] = [
  {
    id: 'user_admin',
    username: 'admin',
    name: 'System Admin',
    role: 'admin',
    passwordHash: 'admin', // Default access code: "admin"
    permissions: DEFAULT_ADMIN_PERMISSIONS,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'user_tech',
    username: 'technician',
    name: 'Electrical Technician',
    role: 'technician',
    passwordHash: 'tech123',
    permissions: {
      canAddTools: true,
      canEditTools: true,
      canDeleteTools: false,
      canExportDownload: true,
      canAccessAppsScript: false,
      canAccessBackups: false,
      canAccessNotifications: true,
      canManageUsers: false,
    },
    createdAt: new Date().toISOString(),
  },
];

type AuthListener = (state: AuthState) => void;

class AuthService {
  private currentUser: AppUser | null = null;
  private users: AppUser[] = [];
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    const savedUsers = localStorage.getItem(STORAGE_USERS_KEY);
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        // Ensure "developer" / "Lead Developer" profile is cleaned up if present
        this.users = parsed.filter((u: AppUser) => u.username !== 'developer');
        // Ensure admin user exists
        if (!this.users.some((u) => u.role === 'admin' || u.username === 'admin')) {
          this.users.unshift(INITIAL_USERS[0]);
        }
      } catch {
        this.users = INITIAL_USERS;
      }
    } else {
      this.users = INITIAL_USERS;
      this.saveUsers();
    }

    const savedSession = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (savedSession) {
      try {
        this.currentUser = JSON.parse(savedSession);
        // Refresh with latest permissions from users list
        const match = this.users.find((u) => u.id === this.currentUser?.id);
        if (match) {
          this.currentUser = match;
        }
      } catch {
        this.currentUser = null;
      }
    }
  }

  private saveUsers() {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(this.users));
  }

  private saveSession() {
    if (this.currentUser) {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    }
  }

  public getState(): AuthState {
    const isUnlocked =
      this.currentUser !== null &&
      (this.currentUser.role === 'admin' ||
        this.currentUser.role === 'developer' ||
        this.currentUser.permissions.canAddTools ||
        this.currentUser.permissions.canAccessAppsScript);

    return {
      currentUser: this.currentUser,
      isUnlocked,
      role: this.currentUser?.role || 'viewer',
    };
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  /**
   * Simple one-field or access-code login.
   * If code matches Admin password (e.g. 'admin' or 'admin123'), logs in as System Admin.
   * Also supports user password matching.
   */
  public loginWithCode(accessCode: string): { success: boolean; message?: string } {
    const code = accessCode.trim();
    if (!code) {
      return { success: false, message: 'Please enter access code or password.' };
    }

    // 1. Check Admin password
    const adminUser = this.users.find((u) => u.username === 'admin' || u.role === 'admin') || INITIAL_USERS[0];
    if (code === adminUser.passwordHash || code === 'admin' || code === 'admin123') {
      this.currentUser = { ...adminUser, lastLogin: new Date().toISOString() };
      this.saveSession();
      this.notify();
      return { success: true };
    }

    // 2. Check other users
    const matchedUser = this.users.find(
      (u) => u.passwordHash === code || u.username.toLowerCase() === code.toLowerCase()
    );

    if (matchedUser) {
      this.currentUser = { ...matchedUser, lastLogin: new Date().toISOString() };
      this.saveSession();
      this.notify();
      return { success: true };
    }

    return { success: false, message: 'Invalid Access Code / Password.' };
  }

  public logout() {
    this.currentUser = null;
    this.saveSession();
    this.notify();
  }

  public hasPermission(permission: keyof UserPermissions): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'admin' || this.currentUser.role === 'developer') return true;
    return !!this.currentUser.permissions[permission];
  }

  public getAdminUser(): AppUser {
    return this.users.find((u) => u.role === 'admin') || INITIAL_USERS[0];
  }

  public updateAdminPassword(newPassword: string): { success: boolean; message?: string } {
    const cleanPass = newPassword.trim();
    if (!cleanPass) return { success: false, message: 'Password cannot be empty.' };

    const idx = this.users.findIndex((u) => u.role === 'admin');
    if (idx !== -1) {
      this.users[idx].passwordHash = cleanPass;
      if (this.currentUser?.role === 'admin') {
        this.currentUser.passwordHash = cleanPass;
        this.saveSession();
      }
      this.saveUsers();
      this.notify();
      return { success: true };
    }
    return { success: false, message: 'Admin user not found.' };
  }

  /**
   * Returns list of regular users (hiding developer and system admin from the regular users table as requested).
   */
  public getRegularUsers(): AppUser[] {
    return this.users.filter((u) => u.role !== 'admin' && u.username !== 'admin' && u.username !== 'developer');
  }

  public getAllUsers(): AppUser[] {
    return this.users.filter((u) => u.username !== 'developer');
  }

  public addUser(
    name: string,
    role: UserRole,
    password?: string
  ): { success: boolean; message?: string } {
    const cleanName = name.trim();
    if (!cleanName) {
      return { success: false, message: 'Name is required.' };
    }

    const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user_' + Date.now();
    const cleanPass = password?.trim() || '123456';

    const defaultPerms: UserPermissions =
      role === 'admin'
        ? DEFAULT_ADMIN_PERMISSIONS
        : role === 'technician'
        ? {
            canAddTools: true,
            canEditTools: true,
            canDeleteTools: false,
            canExportDownload: true,
            canAccessAppsScript: false,
            canAccessBackups: false,
            canAccessNotifications: true,
            canManageUsers: false,
          }
        : DEFAULT_VIEWER_PERMISSIONS;

    const newUser: AppUser = {
      id: 'user_' + Date.now(),
      username: cleanUsername,
      name: cleanName,
      role: role,
      passwordHash: cleanPass,
      permissions: defaultPerms,
      createdAt: new Date().toISOString(),
    };

    this.users.push(newUser);
    this.saveUsers();
    this.notify();
    return { success: true };
  }

  public updatePermissions(userId: string, permissions: UserPermissions): { success: boolean; message?: string } {
    const idx = this.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return { success: false, message: 'User not found.' };
    }

    this.users[idx].permissions = { ...permissions };
    if (this.currentUser?.id === userId) {
      this.currentUser.permissions = { ...permissions };
      this.saveSession();
    }

    this.saveUsers();
    this.notify();
    return { success: true };
  }

  public deleteUser(id: string): { success: boolean; message?: string } {
    if (id === 'user_admin' || this.currentUser?.id === id) {
      return { success: false, message: 'Cannot delete primary Admin or currently logged in session.' };
    }

    this.users = this.users.filter((u) => u.id !== id);
    this.saveUsers();
    this.notify();
    return { success: true };
  }
}

export const authService = new AuthService();
