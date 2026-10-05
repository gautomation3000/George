import React, { useState } from 'react';
import { AuthState, AppUser, UserRole, UserPermissions } from '../types/auth';
import { authService } from '../services/authService';
import {
  Lock,
  Unlock,
  KeyRound,
  UserPlus,
  Users,
  CheckCircle2,
  Trash2,
  X,
  LogOut,
  Info,
  Shield,
  Key
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  authState: AuthState;
}

export const AuthModal: React.FC<Props> = ({ isOpen, onClose, authState }) => {
  const [accessCode, setAccessCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add User State - Single Line (Name, Password, Role)
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('technician');

  // Change Admin Password State
  const [adminNewPass, setAdminNewPass] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = authService.loginWithCode(accessCode);
    if (res.success) {
      setSuccessMsg('Logged in successfully!');
      setAccessCode('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 500);
    } else {
      setErrorMsg(res.message || 'Invalid code.');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setSuccessMsg('Logged out.');
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 400);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!newName.trim()) {
      setErrorMsg('Please enter a name.');
      return;
    }

    const res = authService.addUser(newName, newRole, newPassword);
    if (res.success) {
      setSuccessMsg(`User "${newName}" added.`);
      setNewName('');
      setNewPassword('');
      setTimeout(() => setSuccessMsg(null), 1500);
    } else {
      setErrorMsg(res.message || 'Failed to add user.');
    }
  };

  const handleTogglePermission = (user: AppUser, permKey: keyof UserPermissions) => {
    const updatedPerms: UserPermissions = {
      ...user.permissions,
      [permKey]: !user.permissions[permKey],
    };
    authService.updatePermissions(user.id, updatedPerms);
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (confirm(`Delete user "${name}"?`)) {
      const res = authService.deleteUser(id);
      if (!res.success) {
        alert(res.message);
      }
    }
  };

  const handleSaveAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNewPass.trim()) return;
    const res = authService.updateAdminPassword(adminNewPass);
    if (res.success) {
      setSuccessMsg('Admin password updated successfully.');
      setAdminNewPass('');
      setTimeout(() => setSuccessMsg(null), 2000);
    } else {
      setErrorMsg(res.message || 'Error updating password.');
    }
  };

  const regularUsers = authService.getRegularUsers();
  const isUnlocked = authState.isUnlocked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Simple & Clean */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isUnlocked
                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  : 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400'
              }`}
            >
              {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isUnlocked ? 'Admin Control' : 'Login'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {isUnlocked && (
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg flex items-center gap-1 font-medium transition-colors"
                title="Logout to Viewer Mode"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {!isUnlocked ? (
            /* SIMPLE LOGIN (ONE FIELD: ACCESS CODE / PASSWORD) */
            <form onSubmit={handleLogin} className="space-y-3.5 py-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Access Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    autoFocus
                    required
                    placeholder="Enter access code..."
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <span>Log in</span>
              </button>
            </form>
          ) : (
            /* ADMIN UNLOCKED: USER MANAGEMENT & PERMISSION EDITING */
            <div className="space-y-4">
              {/* + ADD USER: SINGLE ROW (Name, Password, Role, Submit) */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Add User
                </p>
                <form onSubmit={handleCreateUser} className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full sm:flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500"
                  />

                  <input
                    type="password"
                    placeholder="Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full sm:w-28 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500"
                  />

                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full sm:w-28 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="technician">Technician</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  <button
                    type="submit"
                    className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shrink-0 transition-colors"
                  >
                    + Add
                  </button>
                </form>
              </div>

              {/* USER MANAGEMENT & DIRECT EDITABLE PERMISSIONS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span className="font-semibold">User Permissions (Click to toggle)</span>
                  <span className="text-[11px]">{regularUsers.length} Users</span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                  {regularUsers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No regular users created yet. Use form above to add users.
                    </div>
                  ) : (
                    regularUsers.map((u) => (
                      <div key={u.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white">
                              {u.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">
                              {u.role}
                            </span>
                          </div>

                          {/* Interactive, editable permission pills */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePermission(u, 'canAddTools')}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all ${
                                u.permissions.canAddTools
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-60 line-through'
                              }`}
                              title="Click to toggle: Add Tools"
                            >
                              +Add Tool
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePermission(u, 'canEditTools')}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all ${
                                u.permissions.canEditTools
                                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-60 line-through'
                              }`}
                              title="Click to toggle: Edit Tool Data"
                            >
                              Edit Data
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePermission(u, 'canDeleteTools')}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all ${
                                u.permissions.canDeleteTools
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-60 line-through'
                              }`}
                              title="Click to toggle: Delete Tool"
                            >
                              Delete
                            </button>

                            <button
                              type="button"
                              onClick={() => handleTogglePermission(u, 'canExportDownload')}
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition-all ${
                                u.permissions.canExportDownload
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent opacity-60 line-through'
                              }`}
                              title="Click to toggle: Export / Download"
                            >
                              Export
                            </button>
                          </div>
                        </div>

                        {/* Delete User */}
                        <div className="self-end sm:self-center">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* CHANGE ADMIN PASSWORD */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Change Admin Password</span>
                </p>
                <form onSubmit={handleSaveAdminPassword} className="flex gap-2">
                  <input
                    type="password"
                    required
                    placeholder="New admin password"
                    value={adminNewPass}
                    onChange={(e) => setAdminNewPass(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-medium"
                  >
                    Save
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
