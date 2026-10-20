'use client';

import React, { useId, useRef, useState } from 'react';
import { 
  X, 
  Lock, 
  ShieldCheck, 
  User, 
  CheckCircle2, 
  Info
} from 'lucide-react';
import { UserRole } from '@/types/seo';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onRoleChange,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const titleId = useId();
  const descriptionId = useId();
  const roleGroupName = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useDialogFocus(isOpen, onClose, closeButtonRef);

  if (!isOpen) return null;

  const handleSave = () => {
    onRoleChange(selectedRole);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h3 id={titleId} className="text-base font-bold text-slate-900">
                User Authentication &amp; Permissions
              </h3>
              <p className="text-xs text-slate-500">
                Milestone 1 Role Simulation Preview (PRD Sec 12)
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close authentication and permissions dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <fieldset className="mt-4 space-y-3">
          <legend id={descriptionId} className="text-xs text-slate-600">
            Select a demo identity to test role-based access control and dashboard capabilities:
          </legend>

          {/* Role 1: Admin */}
          <label className="block cursor-pointer">
            <input
              type="radio"
              name={roleGroupName}
              value="admin"
              checked={selectedRole === 'admin'}
              onChange={() => setSelectedRole('admin')}
              className="peer sr-only"
            />
            <span
              className={`block rounded-xl border p-4 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 ${
                selectedRole === 'admin'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
                  <span className="font-bold text-xs text-slate-900">
                    Administrator (Admin Role)
                  </span>
                </span>
                {selectedRole === 'admin' && (
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                )}
              </span>
              <span className="mt-1.5 block text-[11px] text-slate-500">
                Full access to project management, keyword research, SERP analysis, and FR-08 operational visibility logs.
              </span>
            </span>
          </label>

          {/* Role 2: Researcher */}
          <label className="block cursor-pointer">
            <input
              type="radio"
              name={roleGroupName}
              value="researcher"
              checked={selectedRole === 'researcher'}
              onChange={() => setSelectedRole('researcher')}
              className="peer sr-only"
            />
            <span
              className={`block rounded-xl border p-4 transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600 ${
                selectedRole === 'researcher'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  <User className="h-5 w-5 text-slate-600" aria-hidden="true" />
                  <span className="font-bold text-xs text-slate-900">
                    SEO Researcher (Standard User)
                  </span>
                </span>
                {selectedRole === 'researcher' && (
                  <CheckCircle2 className="h-4 w-4 text-indigo-600" aria-hidden="true" />
                )}
              </span>
              <span className="mt-1.5 block text-[11px] text-slate-500">
                Access to personal projects, keyword discovery, and CSV report downloads. Admin system logs hidden.
              </span>
            </span>
          </label>
        </fieldset>

        {/* Security Notice */}
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200 flex items-start gap-2">
          <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Production Security Note:</strong> Real authentication with hashed passwords, JWT session cookies, and database user tables will be integrated in Milestone 7.
          </span>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200"
          >
            Switch Active Role
          </button>
        </div>
      </div>
    </div>
  );
};
