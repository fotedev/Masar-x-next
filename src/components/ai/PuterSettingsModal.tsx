"use client";

import React, { useEffect, useState } from "react";
import { X, LogOut, CheckCircle2, Brain } from "lucide-react";
import { signInToPuter, signOutFromPuter, getPuterStatus } from "@/lib/puter";
import { toast } from "sonner";

interface PuterSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PuterSettingsModal: React.FC<PuterSettingsModalProps> = ({
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
      const newStatus = getPuterStatus();
      setStatus(newStatus);
      if (newStatus.isSignedIn) {
        toast.success("تم تفعيل الوضع المتقدم بنجاح");
        onClose();
      }
    } catch (error) {
      console.error("Sign in error:", error);
      toast.error("فشل تفعيل الوضع المتقدم", {
        description: "تأكد من السماح بالنافذة المنبثقة وحاول مرة أخرى.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      signOutFromPuter();
      setStatus({ isReady: true, isSignedIn: false });
      toast.success("تم إيقاف الوضع المتقدم");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="w-full max-w-lg modern-card overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Decorative Header Background */}
        <div className="h-24 bg-gradient-to-r from-indigo-600 to-purple-600 relative">
          <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-10 right-8">
            <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center p-4 border-4 border-slate-50 dark:border-slate-900">
              <Brain className="w-10 h-10 text-indigo-500" />
            </div>
          </div>
        </div>

        <div className="pt-14 p-8">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              تفعيل ميزة AI
            </h3>
            {status.isSignedIn && (
              <span className="flex items-center gap-1 text-[11px] bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1 rounded-full font-bold border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                مفعل الآن
              </span>
            )}
          </div>

          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed text-sm">
            قم بالتسجيل للحصول علي Free Tier
          </p>

          {!status.isSignedIn ? (
            <div className="space-y-6">
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>تسجيل الدخول</span>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-green-500/5 dark:bg-green-500/10 rounded-3xl border border-green-500/20 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  تم التسجيل بنجاح
                </h4>
              </div>

              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-2 hover:text-red-500 transition-colors rounded-2xl"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    <span>إيقاف الوضع المتقدم</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PuterSettingsModal;
