"use client";

import React, { useEffect, useState } from "react";
import { Lock, X, LogOut, CheckCircle2 } from "lucide-react";
import { signInToPuter, signOutFromPuter, getPuterStatus } from "@/lib/puter";

interface PuterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PuterSettingsModal: React.FC<PuterSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(() => getPuterStatus());

  useEffect(() => {
    if (!isOpen) return;
    setStatus(getPuterStatus());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInToPuter();
      setStatus(getPuterStatus());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      setStatus((prev) => ({ ...prev, isSignedIn: false }));
      signOutFromPuter();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md modern-card p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              إعدادات Puter
            </h3>
            {status.isSignedIn && (
              <span className="flex items-center gap-1 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">
                <CheckCircle2 className="w-3 h-3" />
                متصل
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          يستخدم مساعد مسار X خدمة Puter.js لتوفير أفضل أداء للذكاء الاصطناعي.
          يتم إدارة المصادقة والتكاليف تلقائياً عبر حساب Puter الخاص بك.
        </p>

        <div className="space-y-3">
          {!status.isSignedIn ? (
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full brand-button py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Lock className="w-5 h-5" />
              )}
              <span>تسجيل الدخول عبر Puter</span>
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              disabled={isLoading}
              className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <LogOut className="w-5 h-5" />
              )}
              <span>تسجيل الخروج</span>
            </button>
          )}

          <p className="text-[10px] text-center text-slate-400 mt-4">
            تسجيل الدخول يسمح لك باستخدام مواردك الخاصة في Puter لتجنب حدود
            الاستخدام المجانية.
          </p>
        </div>
      </div>
    </div>
  );
};
