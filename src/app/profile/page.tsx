"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Shield, Edit3, Save, X, RefreshCw } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationSettings } from "../../components/NotificationManager";
import { AdminProfileImage } from "../../components/AdminProfileImage";
import { useUserAcademic } from "@/hooks/useUserAcademic";

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    displayName,
    isAdmin,
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

    setUserAcademic,
  } = useUserAcademic();
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(displayName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [level, setLevel] = useState<number>(academic.level ?? 1);
  const [semester, setSemester] = useState<number>(academic.semester ?? 1);
  const [departmentId, setDepartmentId] = useState<string>(
    academic.department_id || "",
  );

  useEffect(() => {
    if (academic.level != null) setLevel(academic.level);
  }, [academic.level]);

  useEffect(() => {
    if (academic.semester != null) setSemester(academic.semester);
  }, [academic.semester]);
  useEffect(() => {
    if (academic.department_id != null) setDepartmentId(academic.department_id);
  }, [academic.department_id]);

  // Note: Admin status is now cached and doesn't need refresh on every visit

  const handleSaveDisplayName = async () => {
    if (!newDisplayName.trim() || newDisplayName.trim() === displayName) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateDisplayName(newDisplayName.trim());
      setIsEditing(false);
    } catch {
      alert("حدث خطأ في تحديث اسم المستخدم ");
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
    try {
      const ok = await setUserAcademic({
        level,
        semester,
        department_id: departmentId || null,
      });
      if (!ok) {
        alert("حدث خطأ أثناء حفظ المعلومات الأكاديمية");
      }
    } catch {
      alert("حدث خطأ أثناء حفظ المعلومات الأكاديمية");
    } finally {
      setIsSavingAcademic(false);
    }
  };

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
    <div className="max-w-4xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8">
      <div className="modern-card overflow-hidden sm:rounded-3xl border-0 sm:border">
        {/* Header */}
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

        {/* Profile Content */}
        <div className="p-5 sm:p-10 space-y-10 bg-white dark:bg-brand-navy/30">
          {/* Personal Information */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(var(--brand-blue),0.5)]" />
                المعلومات الشخصية
              </h2>
            </div>
            <div className="grid gap-5">
              {/* Display Name */}
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
                            name="displayName"
                            type="text"
                            autoComplete="name"
                            value={newDisplayName}
                            onChange={(e) => setNewDisplayName(e.target.value)}
                            className="w-full px-5 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-slate-900 dark:text-white font-bold focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-lg"
                            placeholder="أدخل اسم المستخدم"
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
                          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-emerald-500/25 active:scale-95 disabled:opacity-50"
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
                        className="flex items-center gap-2 px-6 py-3 bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue rounded-2xl font-bold hover:bg-brand-blue hover:text-white transition-all duration-300 group/btn"
                      >
                        <Edit3 className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" />
                        <span>تعديل الاسم</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Email & Account Type Grid */}
              <div className="grid sm:grid-cols-2 gap-5">
                {/* Email */}
                <div className="bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center gap-5 group">
                  <div className="w-14 h-14 bg-brand-orange/10 dark:bg-brand-orange/20 rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
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

                {/* Account Type */}
                <div className="bg-slate-50 dark:bg-white/[0.02] p-6 rounded-[2.5rem] border border-slate-100 dark:border-white/5 flex items-center gap-5 group">
                  <div className="w-14 h-14 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl flex items-center justify-center shadow-inner group-hover:-rotate-12 transition-transform duration-500">
                    <Shield className="w-7 h-7 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                      نوع الحساب
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white text-lg">
                        {isAdmin
                          ? adminRole === "doctor"
                            ? "ادمن دكتور"
                            : adminRole === "student"
                              ? "ادمن طالب"
                              : "ادمن"
                          : "مستخدم"}
                      </p>
                      {isAdmin && (
                        <span className="px-3 py-1 bg-gradient-to-r from-brand-orange to-orange-600 text-white text-[10px] font-black rounded-full shadow-lg shadow-brand-orange/20 uppercase tracking-tighter">
                          {adminRole === "doctor"
                            ? "صلاحيات كاملة"
                            : "صلاحيات محدودة"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Academic */}
              <div className="bg-slate-50 dark:bg-white/[0.02] p-7 rounded-[2.5rem] border border-slate-100 dark:border-white/5 group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-blue/20 group-hover:bg-brand-blue transition-colors duration-500" />
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand-blue/10 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                      🎓
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                        المسار الأكاديمي الحالي
                      </p>
                      <p className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                        {academicLoading && !academic.level
                          ? "جاري التحميل..."
                          : `${levels.find((l) => l.level_number === academic.level)?.name || "مستوى غير محدد"} • ترم ${academic.semester ?? "؟"}`}
                      </p>
                      {academic.department_id && (
                        <p className="text-sm font-bold text-brand-blue mt-1">
                          {
                            departments.find(
                              (d) => d.id === academic.department_id,
                            )?.name
                          }
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <div className="grid grid-cols-1 sm:flex gap-3">
                      <select
                        id="profile-academic-level"
                        name="academicLevel"
                        value={level}
                        onChange={(e) => setLevel(Number(e.target.value))}
                        disabled={academicLoading || isSavingAcademic}
                        className="px-5 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-slate-900 dark:text-white font-bold focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all"
                      >
                        <option value="">اختر المستوى</option>
                        {levels.map((l) => (
                          <option key={l.id} value={l.level_number ?? 0}>
                            {l.name}
                          </option>
                        ))}
                      </select>

                      <select
                        id="profile-academic-department"
                        name="academicDepartment"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={academicLoading || isSavingAcademic || !level}
                        className="px-5 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-slate-900 dark:text-white font-bold focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all"
                      >
                        <option value="">اختر القسم</option>
                        {departments
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

                      <select
                        id="profile-academic-semester"
                        name="academicSemester"
                        value={semester}
                        onChange={(e) => setSemester(Number(e.target.value))}
                        disabled={academicLoading || isSavingAcademic}
                        className="px-5 py-3 border-2 border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-brand-navy/50 text-slate-900 dark:text-white font-bold focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all"
                      >
                        <option value={1}>ترم 1</option>
                        <option value={2}>ترم 2</option>
                      </select>
                    </div>

                    <button
                      onClick={handleSaveAcademic}
                      disabled={academicLoading || isSavingAcademic}
                      className="px-10 py-3 bg-brand-blue text-white rounded-2xl font-black hover:bg-brand-sky shadow-xl shadow-brand-blue/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingAcademic && (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      )}
                      <span>
                        {isSavingAcademic ? "جاري الحفظ..." : "حفظ التغييرات"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Notification Settings */}
          <section>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-orange rounded-full shadow-[0_0_15px_rgba(var(--brand-orange),0.5)]" />
              تنبيهات المنصة
            </h2>
            <div className="bg-slate-50 dark:bg-white/[0.02] rounded-[2.5rem] p-8 border border-slate-100 dark:border-white/5 shadow-sm">
              <NotificationSettings />
            </div>
          </section>

          {/* Account Information */}
          <section>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-2 h-8 bg-brand-blue rounded-full shadow-[0_0_15px_rgba(var(--brand-blue),0.5)]" />
              سجل النشاط
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Registration Date */}
              <div className="p-7 bg-slate-50 dark:bg-white/[0.02] rounded-[2.5rem] border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-brand-navy/40 transition-all duration-300">
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
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

              {/* Last Sign In */}
              <div className="p-7 bg-slate-50 dark:bg-white/[0.02] rounded-[2.5rem] border border-slate-100 dark:border-white/5 group hover:bg-white dark:hover:bg-brand-navy/40 transition-all duration-300">
                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-2">
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

          {/* Actions */}
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
