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
    loading: academicLoading,
    setUserAcademic,
  } = useUserAcademic();
  const [isEditing, setIsEditing] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(displayName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAcademic, setIsSavingAcademic] = useState(false);
  const [level, setLevel] = useState<number>(academic.level ?? 1);
  const [semester, setSemester] = useState<number>(academic.semester ?? 1);

  useEffect(() => {
    if (academic.level != null) setLevel(academic.level);
  }, [academic.level]);

  useEffect(() => {
    if (academic.semester != null) setSemester(academic.semester);
  }, [academic.semester]);

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
    if (![1, 2, 3, 4].includes(level)) return;
    if (![1, 2].includes(semester)) return;

    setIsSavingAcademic(true);
    try {
      const ok = await setUserAcademic({ level, semester });
      if (!ok) {
        alert("حدث خطأ أثناء حفظ المستوى/الترم");
      }
    } catch {
      alert("حدث خطأ أثناء حفظ المستوى/الترم");
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="modern-card overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-navy to-brand-blue px-6 sm:px-10 py-10 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex items-center gap-6">
            <AdminProfileImage
              size="xl"
              className="bg-white/10 backdrop-blur-md border-2 border-white/20"
              editable={true}
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {displayName}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-brand-sky font-semibold flex items-center gap-2">
                  {isAdmin ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                  {isAdmin
                    ? adminRole === "doctor"
                      ? "ادمن دكتور"
                      : adminRole === "student"
                        ? "ادمن طالب"
                        : "ادمن"
                    : "مستخدم"}
                </p>
                <button
                  onClick={() => refreshAdminStatus()}
                  disabled={isAdminLoading}
                  className="p-1.5 hover:bg-white/20 rounded-full transition-all active:rotate-180 duration-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  title="تحديث رتبة الحساب"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-brand-sky ${isAdminLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6 sm:p-10 space-y-10">
          {/* Personal Information */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-brand-blue rounded-full" />
              المعلومات الشخصية
            </h2>
            <div className="grid gap-4">
              {/* Display Name */}
              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="bg-brand-blue/10 p-2.5 rounded-xl">
                    <User className="w-5 h-5 text-brand-blue" />
                  </div>
                  <div>
                    <label
                      htmlFor="profile-display-name"
                      className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                    >
                      اسم المستخدم
                    </label>
                    {isEditing ? (
                      <input
                        id="profile-display-name"
                        name="displayName"
                        type="text"
                        autoComplete="name"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className="mt-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                        placeholder="أدخل اسم المستخدم"
                        maxLength={50}
                      />
                    ) : (
                      <p className="font-bold text-slate-900 dark:text-white text-lg">
                        {displayName || "غير محدد"}
                      </p>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveDisplayName}
                      disabled={isSaving}
                      className="p-2.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all disabled:opacity-50"
                    >
                      <Save className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2.5 text-brand-blue hover:bg-brand-blue/5 rounded-xl transition-all"
                  >
                    <Edit3 className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="bg-brand-orange/10 p-2.5 rounded-xl">
                  <Mail className="w-5 h-5 text-brand-orange" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    البريد الإلكتروني
                  </p>
                  <p className="font-bold text-slate-900 dark:text-white text-lg">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Account Type */}
              <div className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="bg-brand-blue/10 p-2.5 rounded-xl">
                  <Shield className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    نوع الحساب
                  </p>
                  <div className="flex items-center gap-3">
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
                      <span className="px-3 py-1 bg-brand-orange text-white text-xs font-bold rounded-full shadow-lg shadow-brand-orange/20">
                        {adminRole === "doctor"
                          ? "صلاحيات كاملة"
                          : "صلاحيات محدودة"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      المستوى والترم
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white text-lg">
                      {academicLoading
                        ? "جاري التحميل..."
                        : `المستوى ${academic.level ?? "غير محدد"} - ترم ${academic.semester ?? "غير محدد"}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label htmlFor="profile-academic-level" className="sr-only">
                      المستوى
                    </label>
                    <select
                      id="profile-academic-level"
                      name="academicLevel"
                      value={level}
                      onChange={(e) => setLevel(Number(e.target.value))}
                      disabled={academicLoading || isSavingAcademic}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                    >
                      <option value={1}>المستوى الأول</option>
                      <option value={2}>المستوى الثاني</option>
                      <option value={3}>المستوى الثالث</option>
                      <option value={4}>المستوى الرابع</option>
                    </select>

                    <label
                      htmlFor="profile-academic-semester"
                      className="sr-only"
                    >
                      الترم
                    </label>
                    <select
                      id="profile-academic-semester"
                      name="academicSemester"
                      value={semester}
                      onChange={(e) => setSemester(Number(e.target.value))}
                      disabled={academicLoading || isSavingAcademic}
                      className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none transition-all"
                    >
                      <option value={1}>ترم 1</option>
                      <option value={2}>ترم 2</option>
                    </select>

                    <button
                      onClick={handleSaveAcademic}
                      disabled={academicLoading || isSavingAcademic}
                      className="px-5 py-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-sky shadow-lg shadow-brand-blue/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingAcademic ? "جاري الحفظ..." : "حفظ"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-brand-orange rounded-full" />
              إعدادات الإشعارات
            </h2>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800">
              <NotificationSettings />
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="w-1.5 h-6 bg-brand-blue rounded-full" />
              معلومات الحساب
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Registration Date */}
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  تاريخ التسجيل
                </p>
                <p className="font-bold text-slate-900 dark:text-white">
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
              <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  آخر دخول
                </p>
                <p className="font-bold text-slate-900 dark:text-white">
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
          </div>

          {/* Actions */}
          <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => router.push("/")}
              className="w-full sm:w-auto px-10 py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-sky shadow-lg shadow-brand-blue/25 transition-all duration-300"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
