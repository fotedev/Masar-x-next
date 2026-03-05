"use client";

import * as Switch from "@radix-ui/react-switch";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Edit3,
  Save,
  X,
  RefreshCw,
  Zap,
  Clock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationSettings } from "@/components/NotificationManager";
import { AdminProfileImage } from "@/components/AdminProfileImage";
import { useUserAcademic } from "@/hooks/useUserAcademic";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    displayName,
    isAdmin,
    loading: authLoading,
    isAdminLoading,
    adminRole,
    updateDisplayName,
    refreshAdminStatus,
  } = useAuth();
  const {
    academic,
    levels,
    departments,
    loading: academicLoading,
    optionsLoading,
    setUserAcademic,
  } = useUserAcademic();

  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(displayName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(academic.level ?? 1);
  const [semester, setSemester] = useState<number>(academic.semester ?? 1);
  const [departmentId, setDepartmentId] = useState<string>(
    academic.department_id || "",
  );
  const [showExtraAssets, setShowExtraAssets] = useState(false);
  const [extraAssetsUpdatedAt, setExtraAssetsUpdatedAt] = useState<
    string | null
  >(null);

  // Cooldown period: 2 hours (in milliseconds)
  const COOLDOWN_MS = 2 * 60 * 60 * 1000;

  // Calculate remaining cooldown time
  const cooldownRemaining = useMemo(() => {
    if (!extraAssetsUpdatedAt) return 0;
    const lastUpdate = new Date(extraAssetsUpdatedAt).getTime();
    const elapsed = Date.now() - lastUpdate;
    return Math.max(0, COOLDOWN_MS - elapsed);
  }, [extraAssetsUpdatedAt]);

  // Check if cooldown is active
  const isCooldownActive = cooldownRemaining > 0;

  // Format remaining time for display
  const formatCooldownTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours} ساعة و ${minutes} دقيقة`;
    return `${minutes} دقيقة`;
  };

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (data) {
          setShowExtraAssets(data.show_extra_assets || false);
          setExtraAssetsUpdatedAt(data.show_extra_assets_updated_at || null);
          setNewDisplayName(data.full_name || displayName || "");
        }
      };
      fetchProfile();
    }
  }, [user, displayName]);

  useEffect(() => {
    if (academic.level != null) setLevel(academic.level);
  }, [academic.level]);

  useEffect(() => {
    if (academic.semester != null) setSemester(academic.semester);
  }, [academic.semester]);

  useEffect(() => {
    if (academic.department_id != null) setDepartmentId(academic.department_id);
  }, [academic.department_id]);

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || newDisplayName.trim() === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayName(newDisplayName.trim());
      setIsEditing(false);
      toast.success("تم تحديث الاسم بنجاح");
    } catch {
      toast.error("حدث خطأ في تحديث اسم المستخدم ");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleExtraAssets = async (enabled: boolean) => {
    if (!user) return;

    // Best practice: enabling TRW requires the unlock/code flow (logo taps).
    // Profile page allows disabling only once the flag is already enabled.
    if (enabled === true && showExtraAssets === false) {
      return;
    }

    // Check cooldown
    if (isCooldownActive) {
      toast.error("Cooldown Active", {
        description: `يرجى الانتظار ${formatCooldownTime(cooldownRemaining)} قبل التغيير مرة أخرى.`,
      });
      return;
    }

    try {
      setIsSaving(true);
      const { data, error } = await supabase
        .from("profiles")
        .update({
          show_extra_assets: enabled,
        })
        .eq("id", user.id)
        .select("show_extra_assets_updated_at")
        .single();

      if (error) throw error;

      setShowExtraAssets(enabled);
      setExtraAssetsUpdatedAt(data?.show_extra_assets_updated_at ?? null);

      // Force a custom event to notify Header and other components
      window.dispatchEvent(
        new CustomEvent("profileUpdate", {
          detail: { show_extra_assets: enabled },
        }),
      );

      toast.success(enabled ? "System Update" : "System Revert", {
        description: enabled
          ? "Extra assets visibility enabled."
          : "Extra assets visibility disabled.",
        className: enabled
          ? "bg-black text-white border-red-900 shadow-[0_0_20px_rgba(255,0,0,0.3)] font-mono"
          : "",
      });
    } catch (err: unknown) {
      const maybeMessage =
        typeof err === "object" && err && "message" in err
          ? String((err as { message?: unknown }).message)
          : "";
      toast.error("System Error", {
        description: maybeMessage || "Failed to update preferences.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setNewDisplayName(displayName || "");
    setIsEditing(false);
  };

  const handleSaveAcademic = async () => {
    if (!user) return;
    setIsSavingAcademic(true);
    setAcademicError(null);
    try {
      const result = await setUserAcademic(
        {
          level,
          semester,
          department_id: departmentId || null,
        },
        { isProfileUpdate: true },
      );
      if (!result.success) {
        setAcademicError(
          result.message || "حدث خطأ أثناء حفظ المعلومات الأكاديمية",
        );
        setTimeout(() => setAcademicError(null), 5000);
      } else {
        toast.success("تم تحديث البيانات الأكاديمية");
      }
    } catch {
      setAcademicError("حدث خطأ أثناء حفظ المعلومات الأكاديمية");
      setTimeout(() => setAcademicError(null), 5000);
    } finally {
      setIsSavingAcademic(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-brand-navy flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-bold animate-pulse">
            جاري التحميل...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            يجب تسجيل الدخول أولاً
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            يرجى تسجيل الدخول لرؤية ملفك الشخصي
          </p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-4xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8 text-right"
      dir="rtl"
    >
      <div className="modern-card overflow-hidden sm:rounded-3xl border-0 sm:border">
        {/* Header Section */}
        <div className="bg-gradient-to-br from-brand-navy to-brand-blue px-6 sm:px-10 py-12 sm:py-16 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl animate-pulse" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-sky/10 rounded-full -ml-24 -mb-24 blur-2xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center text-center sm:text-right gap-6 sm:gap-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-sky to-white/20 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
              <AdminProfileImage
                size="xl"
                className="bg-white/10 backdrop-blur-md border-4 border-white/20 shadow-2xl relative"
                editable={true}
              />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-sm">
                {displayName}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center gap-2">
                  {isAdmin ? (
                    <Shield className="w-4 h-4 text-brand-sky" />
                  ) : (
                    <User className="w-4 h-4 text-brand-sky" />
                  )}
                  <span className="text-sm font-bold tracking-wide">
                    {isAdmin
                      ? adminRole === "doctor"
                        ? "ادمن دكتور"
                        : adminRole === "student"
                          ? "ادمن طالب"
                          : "ادمن"
                      : "مستخدم"}
                  </span>
                </div>
                <button
                  onClick={() => refreshAdminStatus()}
                  disabled={isAdminLoading}
                  className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90 duration-300 disabled:opacity-60 bg-white/5 border border-white/10 shadow-sm"
                  title="تحديث رتبة الحساب"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-white ${isAdminLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-5 sm:p-10 space-y-10 bg-white dark:bg-brand-navy/30">
          {/* Personal Info Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(var(--brand-blue),0.5)]" />
                المعلومات الشخصية
              </h2>
            </div>
            <div className="grid gap-5">
              <div className="group relative bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 transition-all duration-300 hover:shadow-xl hover:shadow-brand-blue/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <User className="w-7 h-7 text-brand-blue" />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor="profile-display-name"
                        className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1 block"
                      >
                        اسم المستخدم
                      </label>
                      {isEditing ? (
                        <div className="relative mt-2">
                          <input
                            id="profile-display-name"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            className="w-full px-5 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-slate-900 dark:text-white font-bold focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-lg text-right"
                            maxLength={50}
                            autoFocus
                          />
                        </div>
                      ) : (
                        <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                          {displayName || "غير محدد"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 sm:pt-0">
                    {isEditing ? (
                      <div className="flex gap-3">
                        <button
                          onClick={handleSaveDisplayName}
                          disabled={isSaving}
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Save className="w-5 h-5" />
                          <span>حفظ</span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all active:scale-95"
                        >
                          <X className="w-5 h-5" />
                          <span>إلغاء</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue rounded-2xl font-bold hover:bg-brand-blue hover:text-white transition-all duration-300"
                      >
                        <Edit3 className="w-5 h-5" />
                        <span>تعديل الاسم</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <div className="bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center gap-5">
                  <div className="w-14 h-14 bg-brand-orange/10 dark:bg-brand-orange/20 rounded-2xl flex items-center justify-center">
                    <Mail className="w-7 h-7 text-brand-orange" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                      البريد الإلكتروني
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white text-lg break-all">
                      {user.email}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center gap-5">
                  <div className="w-14 h-14 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl flex items-center justify-center">
                    <Shield className="w-7 h-7 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                      نوع الحساب
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">
                      {isAdmin
                        ? adminRole === "doctor"
                          ? "ادمن دكتور"
                          : adminRole === "student"
                            ? "ادمن طالب"
                            : "ادمن"
                        : "مستخدم"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Academic Info Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(var(--brand-blue),0.5)]" />
                المسار الأكاديمي
              </h2>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.02] p-7 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group relative overflow-hidden">
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-2xl">
                    🎓
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                      المسار الحالي
                    </p>
                    <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                      {academicLoading
                        ? "جاري التحميل..."
                        : `${
                            levels.find((l) => l.level_number === level)
                              ?.name || "مستوى غير محدد"
                          } • ترم ${semester}`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_0.8fr_auto] gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      المستوى
                    </label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(Number(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-right font-bold outline-none disabled:opacity-50"
                      disabled={optionsLoading}
                    >
                      {optionsLoading ? (
                        <option>جاري تحميل المستويات...</option>
                      ) : (
                        levels.map((l) => (
                          <option key={l.id} value={l.level_number ?? 0}>
                            {l.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      القسم
                    </label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-right font-bold outline-none disabled:opacity-50"
                      disabled={optionsLoading}
                    >
                      <option value="">
                        {optionsLoading ? "جاري التحميل..." : "اختر القسم"}
                      </option>
                      {!optionsLoading &&
                        departments
                          .filter((d) => {
                            const selectedLevel = levels.find(
                              (l) => l.level_number === level,
                            );
                            return (
                              !d.academic_level_id ||
                              d.academic_level_id === selectedLevel?.id
                            );
                          })
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase">
                      الترم
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(Number(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-right font-bold outline-none"
                    >
                      <option value={1}>ترم 1</option>
                      <option value={2}>ترم 2</option>
                    </select>
                  </div>
                  <button
                    onClick={handleSaveAcademic}
                    disabled={isSavingAcademic}
                    className="h-[52px] bg-brand-blue text-white px-8 rounded-2xl font-black hover:bg-brand-sky active:scale-95 transition-all"
                  >
                    {isSavingAcademic ? (
                      <RefreshCw className="animate-spin w-5 h-5" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {academicError && (
                  <p className="text-red-500 text-sm font-bold">
                    {academicError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Special Settings Section */}
          {showExtraAssets && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                  <span className="w-2 h-8 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                  إعدادات الحساب الخاصة
                </h2>
              </div>
              <div className="group relative bg-slate-50 dark:bg-white/[0.02] p-4 sm:p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 transition-all duration-300">
                <div className="flex flex-col gap-4 sm:gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-5 min-w-0">
                      <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-red-600/10 dark:bg-red-600/20 rounded-2xl flex items-center justify-center shadow-inner">
                        <Zap className="w-7 h-7 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                            Show Extra Content
                          </h3>
                        </div>
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                          Enable permanent access to additional sections and
                          features
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      {/* Cooldown indicator */}
                      {isCooldownActive && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100/80 text-amber-800 ring-1 ring-amber-200/70 shadow-sm dark:bg-amber-900/25 dark:text-amber-200 dark:ring-amber-700/30">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-black tabular-nums">
                            {formatCooldownTime(cooldownRemaining)}
                          </span>
                        </div>
                      )}

                      <Switch.Root
                        checked={showExtraAssets}
                        onCheckedChange={handleToggleExtraAssets}
                        disabled={isSaving || isCooldownActive}
                        dir="rtl"
                        className={`
                          group relative h-8 w-14 rounded-full outline-none
                          transition-all duration-300 ease-in-out
                          focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-brand-navy
                          disabled:cursor-not-allowed disabled:opacity-50
                          ${
                            showExtraAssets
                              ? "bg-red-600 shadow-[0_0_16px_4px_rgba(220,38,38,0.35)]"
                              : "bg-slate-200 dark:bg-slate-700 shadow-inner"
                          }
                        `}
                      >
                        <Switch.Thumb
                          className={`
                            absolute top-1 h-6 w-6 rounded-full
                            transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                            will-change-[inset-inline-start]
                            [inset-inline-start:0.25rem]
                            data-[state=checked]:[inset-inline-start:calc(100%-1.5rem-0.25rem)]
                            data-[state=checked]:shadow-[0_0_8px_2px_rgba(220,38,38,0.5)]
                            ${
                              showExtraAssets
                                ? "bg-white scale-90"
                                : "bg-white shadow-md"
                            }
                            group-active:scale-75
                          `}
                        />
                      </Switch.Root>
                    </div>
                  </div>
                </div>
                {/* Cooldown info */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-bold">ملاحظة:</span> يمكنك تغيير هذا
                    الإعداد مرة واحدة كل ساعتين لمنع الاستخدام الخاطئ.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Notifications Settings Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-brand-orange rounded-full shadow-[0_0_15px_rgba(var(--brand-orange),0.5)]" />
                إعدادات الإشعارات
              </h2>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.02] p-6 sm:p-10 rounded-[3rem] border border-slate-100 dark:border-white/5">
              <NotificationSettings />
            </div>
          </section>

          {/* Activity Logs Section */}
          <section>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(var(--brand-blue),0.5)]" />
              سجل النشاط
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="p-7 bg-slate-50 dark:bg-white/[0.02] rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  تاريخ الانضمام
                </p>
                <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                  {user.created_at
                    ? new Date(user.created_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "غير محدد"}
                </p>
              </div>
              <div className="p-7 bg-slate-50 dark:bg-white/[0.02] rounded-[2.5rem] border border-slate-100 dark:border-white/5">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">
                  آخر نشاط مسجل
                </p>
                <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString(
                        "ar-EG",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "غير محدد"}
                </p>
              </div>
            </div>
          </section>

          {/* Footer Actions */}
          <div className="pt-10 flex flex-col sm:flex-row gap-4 border-t border-slate-100 dark:border-white/5">
            <button
              onClick={() => router.push("/")}
              className="w-full sm:w-auto px-12 py-4 bg-brand-blue text-white rounded-2xl font-black hover:bg-brand-sky shadow-xl shadow-brand-blue/25 transition-all duration-300 active:scale-95 text-center"
            >
              العودة للرئيسية
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full sm:w-auto px-12 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-2xl font-black hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-300 active:scale-95 text-center"
            >
              رجوع
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
