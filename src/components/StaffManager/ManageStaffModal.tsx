import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  KeyRound,
  Eye,
  EyeOff,
  Shield,
  Beer,
  CheckCircle2,
  AlertCircle,
  Delete,
  Search,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { StaffUser, StaffRole } from '../../types/taproom';

interface ManageStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUsers: StaffUser[];
  onUpdateStaffPin: (staffName: string, newPin: string) => void;
}

export const ManageStaffModal: React.FC<ManageStaffModalProps> = ({
  isOpen,
  onClose,
  staffUsers,
  onUpdateStaffPin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Manager' | 'Bartender'>('ALL');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Staff currently being edited
  const [editingStaffName, setEditingStaffName] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const activeStaff = useMemo(() => {
    return staffUsers.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.title && u.title.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesRole =
        roleFilter === 'ALL'
          ? true
          : roleFilter === 'Manager'
          ? u.role === 'Manager' || u.role === 'Shift Supervisor'
          : u.role === 'Bartender';
      return matchesSearch && matchesRole;
    });
  }, [staffUsers, searchQuery, roleFilter]);

  const togglePinReveal = (staffName: string) => {
    setRevealedPins((prev) => ({
      ...prev,
      [staffName]: !prev[staffName],
    }));
  };

  const handleStartEdit = (staff: StaffUser) => {
    setEditingStaffName(staff.name);
    setNewPinValue('');
    setPinError('');
  };

  const handleCancelEdit = () => {
    setEditingStaffName(null);
    setNewPinValue('');
    setPinError('');
  };

  const handleKeypadPress = (digit: string) => {
    if (newPinValue.length >= 4) return;
    setNewPinValue((prev) => prev + digit);
    setPinError('');
  };

  const handleKeypadBackspace = () => {
    setNewPinValue((prev) => prev.slice(0, -1));
    setPinError('');
  };

  const handleSavePin = (targetStaff: StaffUser) => {
    // 1. Exactly 4 digits numeric validation
    if (!/^\d{4}$/.test(newPinValue)) {
      setPinError('PIN must be exactly 4 digits');
      return;
    }

    // 2. Prevent duplicate PINs assigned to DIFFERENT roles
    const targetIsManager =
      targetStaff.role === 'Manager' || targetStaff.role === 'Shift Supervisor';

    const conflictingStaff = staffUsers.find((other) => {
      if (other.name === targetStaff.name) return false;
      const otherPin =
        other.pin ||
        (other.role === 'Manager' || other.role === 'Shift Supervisor' ? '9999' : '1234');
      if (otherPin !== newPinValue) return false;

      const otherIsManager =
        other.role === 'Manager' || other.role === 'Shift Supervisor';
      return targetIsManager !== otherIsManager;
    });

    if (conflictingStaff) {
      setPinError(
        `PIN is already assigned to ${conflictingStaff.name} (${conflictingStaff.role}). Roles cannot share PINs.`
      );
      return;
    }

    onUpdateStaffPin(targetStaff.name, newPinValue);
    showToast(`PIN updated for ${targetStaff.name}`);
    setEditingStaffName(null);
    setNewPinValue('');
    setPinError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-60 bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-2xl shadow-xl shadow-emerald-950/50 flex items-center gap-2 text-xs animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Manage Staff & PINs</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Manager Only
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure team terminal access PINs and permission levels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-800/80 bg-slate-900/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search staff name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            {(['ALL', 'Manager', 'Bartender'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === 'ALL' ? 'All Staff' : r === 'Manager' ? 'Managers' : 'Bartenders'}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Table / List */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-5 space-y-2.5">
          {activeStaff.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No staff members matching criteria.
            </div>
          ) : (
            activeStaff.map((staff) => {
              const effectivePin =
                staff.pin ||
                (staff.role === 'Manager' || staff.role === 'Shift Supervisor'
                  ? '9999'
                  : '1234');
              const isRevealed = Boolean(revealedPins[staff.name]);
              const isEditing = editingStaffName === staff.name;

              return (
                <div
                  key={staff.id}
                  className={`rounded-2xl border transition-all ${
                    isEditing
                      ? 'bg-blue-950/20 border-blue-500/50 shadow-lg p-4'
                      : 'bg-slate-850/70 hover:bg-slate-850 border-slate-800 p-3 sm:p-4'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Left: Staff Name, Title, and Role */}
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                        {staff.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-white">{staff.name}</span>
                          {/* Role Badge */}
                          {staff.role === 'Manager' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1">
                              <Shield className="w-3 h-3 text-purple-400" />
                              <span>Manager</span>
                            </span>
                          ) : staff.role === 'Shift Supervisor' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                              <Shield className="w-3 h-3 text-indigo-400" />
                              <span>Supervisor</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1">
                              <Beer className="w-3 h-3 text-amber-400" />
                              <span>Bartender</span>
                            </span>
                          )}

                          {/* Status Badge */}
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                              staff.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                staff.status === 'Active' ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>{staff.status}</span>
                          </span>
                        </div>
                        {staff.title && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{staff.title}</div>
                        )}
                      </div>
                    </div>

                    {/* Right: Masked PIN Display & Action */}
                    {!isEditing && (
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700/80">
                          <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-xs font-bold text-slate-200 tracking-wider">
                            {isRevealed ? effectivePin : '••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePinReveal(staff.name)}
                            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={isRevealed ? 'Mask PIN' : 'Reveal PIN'}
                          >
                            {isRevealed ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStartEdit(staff)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                          <span>Edit PIN</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline PIN Keypad Editor */}
                  {isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col items-center">
                      <div className="text-center mb-3">
                        <div className="text-xs font-bold text-slate-300">
                          Set 4-Digit Access PIN for <strong className="text-white">{staff.name}</strong>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Terminal role: {staff.role}
                        </div>
                      </div>

                      {/* 4 PIN Dots */}
                      <div className="flex items-center justify-center gap-3 mb-2">
                        {[0, 1, 2, 3].map((index) => {
                          const isFilled = newPinValue.length > index;
                          return (
                            <div
                              key={index}
                              className={`w-3.5 h-3.5 rounded-full transition-all ${
                                isFilled
                                  ? 'bg-blue-400 border-2 border-blue-300 scale-110 shadow-sm'
                                  : 'bg-slate-800 border-2 border-slate-700'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Error display */}
                      {pinError && (
                        <div className="text-[11px] font-bold text-rose-400 mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{pinError}</span>
                        </div>
                      )}

                      {/* Compact Keypad (0-9, Clear) */}
                      <div className="grid grid-cols-3 gap-1.5 w-full max-w-[240px] my-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                          <button
                            key={digit}
                            type="button"
                            onClick={() => handleKeypadPress(digit)}
                            className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 active:text-white font-bold text-base text-white border border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                          >
                            {digit}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={handleKeypadBackspace}
                          className="h-10 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-slate-750 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Delete className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleKeypadPress('0')}
                          className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-blue-600 active:text-white font-bold text-base text-white border border-slate-700 transition-all cursor-pointer flex items-center justify-center"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewPinValue('')}
                          className="h-10 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs border border-slate-750 transition-all cursor-pointer flex items-center justify-center"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Save / Cancel buttons */}
                      <div className="flex items-center gap-2 mt-3 w-full max-w-[240px]">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSavePin(staff)}
                          disabled={newPinValue.length !== 4}
                          className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Save PIN</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>PIN changes save optimistically and sync to "👥 Staff & Permissions"</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
