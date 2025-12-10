import React from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmText?: string;
  isConfirming: boolean;
  children: React.ReactNode;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  confirmText = 'Confirm',
  isConfirming,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 sm:p-8 border border-slate-200 dark:border-slate-700 transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <div className="mt-3 text-slate-600 dark:text-slate-300">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 gap-3">
          <Button onClick={onClose} variant="secondary" className="w-full sm:w-auto" disabled={isConfirming}>
            Cancel
          </Button>
          <Button onClick={onConfirm} className="w-full sm:w-auto !bg-red-600 hover:!bg-red-700 focus:!ring-red-500" disabled={isConfirming}>
            {isConfirming ? <><Spinner /> Deleting...</> : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};