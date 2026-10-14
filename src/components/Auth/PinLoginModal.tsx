import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, ArrowRight, Shield, Beer, X } from 'lucide-react';
import { StaffRole, StaffUser } from '../../types/taproom';
import { BigLakeLogo } from '../BigLakeLogo';

interface PinLoginModalProps {
  isOpen: boolean;
  onSuccess: (role: StaffRole, staffName: string) => void;
  onClose?: () => void;
  currentRole?: StaffRole | null;
  staffUsers?: StaffUser[];
}

export const PinLoginModal: React.FC<PinLoginModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
  currentRole = null,
  staffUsers = [],
}) => {
  const [pin, setPin] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Can only dismiss if user already has an active session
  const canDismiss = Boolean(currentRole && onClose);

  const evaluatePin = useCallback(
    (codeToTest: string) => {
      // 1. Dynamic check against active staff members loaded from "👥 Staff & Permissions"
      const activeStaff = (staffUsers || []).filter((u) => u.status === 'Active');
      const matchedUser = activeStaff.find((u) => {
        const userPin =
          u.pin ||
          (u.role === 'Manager' || u.role === 'Shift Supervisor' ? '9999' : '1234');
        return userPin === codeToTest;
      });

      if (matchedUser) {
        setIsError(false);
        setErrorMessage('');
        setPin('');
        const resolvedRole: StaffRole =
          matchedUser.role === 'Manager' || matchedUser.role === 'Shift Supervisor'
            ? 'Manager'
            : 'Bartender';
        onSuccess(resolvedRole, matchedUser.name);
        return;
      }

      // 2. Emergency fallback PINs if sheet is offline or default PINs used
      if (codeToTest === '9999') {
        setIsError(false);
        setErrorMessage('');
        setPin('');
        onSuccess('Manager', 'Manager (Fallback)');
        return;
      }

      if (codeToTest === '1234') {
        setIsError(false);
        setErrorMessage('');
        setPin('');
        onSuccess('Bartender', 'Bartender (Fallback)');
        return;
      }

      // Invalid PIN: shake feedback and clear
      setIsError(true);
      setErrorMessage('Invalid PIN. Please check with your manager');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(150);
        } catch {
          // ignore
        }
      }

      setTimeout(() => {
        setPin('');
        setIsError(false);
      }, 500);
    },
    [staffUsers, onSuccess]
  );

  const handleKeyPress = useCallback(
    (numStr: string) => {
      if (isError) return;
      if (pin.length >= 4) return;

      const nextPin = pin + numStr;
      setPin(nextPin);
      setErrorMessage('');

      // When 4th digit is entered, automatically evaluate immediately
      if (nextPin.length === 4) {
        evaluatePin(nextPin);
      }
    },
    [pin, isError, evaluatePin]
  );

  const handleBackspace = useCallback(() => {
    if (isError) return;
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
  }, [isError]);

  const handleClear = useCallback(() => {
    setPin('');
    setIsError(false);
    setErrorMessage('');
  }, []);

  const handleManualEnter = useCallback(() => {
    if (pin.length === 0) return;
    evaluatePin(pin);
  }, [pin, evaluatePin]);

  // Physical keyboard listener for desktop and connected iPad keyboards
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleManualEnter();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (canDismiss && onClose) {
          onClose();
        } else {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyPress, handleBackspace, handleManualEnter, handleClear, canDismiss, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsError(false);
      setErrorMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .pin-shake {
          animation: pinShake 0.4s ease-in-out;
        }
      `}</style>

      <div
        className={`w-full max-w-[360px] bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center select-none ${
          isError ? 'pin-shake border-rose-500/60 shadow-rose-950/50' : ''
        }`}
      >
        {/* Header / Dismiss */}
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BigLakeLogo variant="compact" size="sm" className="h-6" />
          </div>
          {canDismiss && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close and stay in current session"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Title */}
        <div className="text-center mt-1 mb-2">
          <h2 className="text-lg font-black text-white tracking-tight flex items-center justify-center gap-1.5">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Staff PIN Login</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter 4-digit PIN for access</p>
        </div>

        {/* Masked PIN Dots */}
        <div className="flex items-center justify-center gap-3.5 my-3 h-8">
          {[0, 1, 2, 3].map((index) => {
            const isFilled = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  isError
                    ? 'bg-rose-500 border-2 border-rose-400 scale-125 shadow-lg shadow-rose-500/60'
                    : isFilled
                    ? 'bg-amber-400 border-2 border-amber-300 scale-125 shadow-md shadow-amber-400/50'
                    : 'bg-slate-800 border-2 border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Error or Hint feedback */}
        <div className="h-5 text-center flex items-center justify-center mb-2">
          {errorMessage ? (
            <span className="text-[11px] font-bold text-rose-400 animate-in fade-in duration-150">
              {errorMessage}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Fast iPad tap or keyboard entry</span>
          )}
        </div>

        {/* Touch-Friendly Keypad (0-9, Clear, Enter) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-[300px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeyPress(digit)}
              className="h-13 sm:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-black text-xl text-white border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center touch-manipulation"
            >
              {digit}
            </button>
          ))}

          {/* Clear / Backspace */}
          <button
            type="button"
            onClick={pin.length > 0 ? handleBackspace : handleClear}
            className="h-13 sm:h-14 rounded-2xl bg-slate-850 hover:bg-slate-800 active:bg-slate-700 font-bold text-xs sm:text-sm text-slate-300 border border-slate-750 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 touch-manipulation"
            title="Clear or delete digit"
          >
            <Delete className="w-4 h-4 text-slate-400" />
            <span>Clear</span>
          </button>

          {/* Zero */}
          <button
            type="button"
            onClick={() => handleKeyPress('0')}
            className="h-13 sm:h-14 rounded-2xl bg-slate-800/90 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-black text-xl text-white border border-slate-700/80 shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center touch-manipulation"
          >
            0
          </button>

          {/* Enter / Submit */}
          <button
            type="button"
            onClick={handleManualEnter}
            disabled={pin.length === 0}
            className="h-13 sm:h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs sm:text-sm text-slate-950 border border-amber-400/80 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 touch-manipulation"
            title="Submit PIN"
          >
            <span>Enter</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>

        {/* Quick Role Shortcuts (Touch Friendly for quick staff shifts) */}
        <div className="w-full mt-4 pt-3.5 border-t border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => evaluatePin('1234')}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Quick Sign In: Bartender (1234)"
          >
            <Beer className="w-3.5 h-3.5 text-amber-400" />
            <span>1234: Bartender</span>
          </button>

          <button
            type="button"
            onClick={() => evaluatePin('9999')}
            className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700/80 text-[11px] font-bold text-purple-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Quick Sign In: Manager (9999)"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>9999: Manager</span>
          </button>
        </div>
      </div>
    </div>
  );
};
