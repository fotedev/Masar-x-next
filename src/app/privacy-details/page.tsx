'use client';

import {
  Shield,
  Eye,
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  Info,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyDetailsPage() {
  const router = useRouter();
  const dataTypes = [
    {
      title: "الاسم الكامل والبريد الإلكتروني عند التسجيل",
      icon: "user",
      purpose: "المصادقة والتواصل",
      details: [
        "يتم استخدام الاسم الكامل لعرض هويتك في الملف الشخصي وفي التفاعلات مع المحتوى",
        "البريد الإلكتروني ضروري للمصادقة على الحساب وإرسال إشعارات مهمة",
        "يتم تشفير جميع البيانات وتخزينها بشكل آمن في قاعدة البيانات",
      ],
      necessity: "أساسي للمصادقة",
    },
    {
      title: "المستوى الدراسي والتخصص الأكاديمي",
      icon: "graduation",
      purpose: "تخصيص التجربة الدراسية",
      details: [
        "يساعد في عرض المحتوى المناسب لمستواك الدراسي",
        "يسهل العثور على الملخصات والمواد ذات الصلة بتخصصك",
        "يحسن من دقة الاقتراحات والمحتوى الموصى به",
      ],
      necessity: "مفيد للتخصيص",
    },
    {
      title: "الملخصات والمصادر الدراسية التي تقوم برفعها",
      icon: "file-text",
      purpose: "مشاركة المعرفة والمحتوى التعليمي",
      details: [
        "يتم حفظ المحتوى الذي تقوم برفعه لمشاركته مع الطلاب الآخرين",
        "يساعد في بناء مكتبة دراسية شاملة ومفيدة",
        "يتم التحقق من جودة المحتوى قبل نشره للجميع",
      ],
      necessity: "أساسي للوظائف",
    },
    {
      title: "التعليقات والتقييمات والتفاعلات مع المحتوى",
      icon: "message-circle",
      purpose: "تحسين جودة المحتوى والتفاعل",
      details: [
        "يساعد في فهم آراء المستخدمين وتحسين المحتوى",
        "يبني مجتمعاً دراسياً تفاعلياً ومفيداً",
        "يساعد في تحديد المحتوى الأكثر جودة وفائدة",
      ],
      necessity: "مفيد للتحسين",
    },
    {
      title: "بيانات الأداء في الاختبارات والامتحانات",
      icon: "bar-chart",
      purpose: "تتبع التقدم الدراسي وتحسين التعلم",
      details: [
        "يساعد في تحليل نقاط القوة والضعف في المواد المختلفة",
        "يوفر إحصائيات مفيدة لتحسين أسلوب الدراسة",
        "يحافظ على سرية النتائج ولا يتم مشاركتها مع الآخرين",
      ],
      necessity: "مفيد للتتبع",
    },
    {
      title: "الصورة الشخصية (في حال إضافتها للملف الشخصي)",
      icon: "camera",
      purpose: "تعزيز التفاعل الشخصي",
      details: [
        "تظهر صورتك في ملفك الشخصي وفي التعليقات والتفاعلات",
        "تساعد في بناء هوية شخصية موثوقة في المجتمع الدراسي",
        "يمكن حذفها أو تغييرها في أي وقت من إعدادات الملف الشخصي",
      ],
      necessity: "اختياري",
    },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "user":
        return "👤";
      case "graduation":
        return "🎓";
      case "file-text":
        return "📄";
      case "message-circle":
        return "💬";
      case "bar-chart":
        return "📊";
      case "camera":
        return "📸";
      default:
        return "📋";
    }
  };

  const getNecessityColor = (necessity: string) => {
    switch (necessity) {
      case "أساسي للمصادقة":
        return "text-red-600 bg-red-50 dark:bg-red-900/20";
      case "أساسي للوظائف":
        return "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
      case "مفيد للتخصيص":
        return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
      case "مفيد للتحسين":
        return "text-green-600 bg-green-50 dark:bg-green-900/20";
      case "مفيد للتتبع":
        return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
      default:
        return "text-gray-600 bg-gray-50 dark:bg-gray-900/20";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <button
            onClick={() => router.push("/privacy-policy")}
            className="inline-flex items-center gap-2 text-brand-blue hover:text-brand-blue/80 transition-colors mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة إلى سياسة الخصوصية
          </button>

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-brand-blue/10 dark:bg-brand-blue/20 mb-6 shadow-xl shadow-brand-blue/5 animate-in fade-in zoom-in duration-700">
              <Eye className="w-10 h-10 text-brand-blue" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
              تفاصيل المعلومات المجمعة
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-3xl mx-auto">
              شرح مفصل لكل نوع من المعلومات التي نجمعها وأسباب جمعها
            </p>
          </div>
        </div>

        {/* Data Types Grid */}
        <div className="space-y-8">
          {dataTypes.map((dataType, index) => (
            <div
              key={index}
              className="modern-card p-8 sm:p-10 hover:shadow-2xl transition-all duration-500 group"
            >
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue/10 to-brand-blue/20 dark:from-brand-blue/20 dark:to-brand-blue/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform text-2xl">
                  {getIcon(dataType.icon)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {dataType.title}
                    </h2>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getNecessityColor(
                        dataType.necessity
                      )}`}
                    >
                      {dataType.necessity}
                    </span>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-blue-900 dark:text-blue-100">
                        الغرض من الجمع:
                      </span>
                    </div>
                    <p className="text-blue-800 dark:text-blue-200 font-medium">
                      {dataType.purpose}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <ChevronRight className="w-5 h-5 text-brand-blue" />
                      التفاصيل والشرح:
                    </h3>
                    <ul className="space-y-3">
                      {dataType.details.map((detail, detailIndex) => (
                        <li
                          key={detailIndex}
                          className="flex items-start gap-3 text-slate-600 dark:text-slate-400 font-medium"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="mt-12 modern-card p-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                التزامنا بالأمان والخصوصية
              </h3>
              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <p>
                  جميع المعلومات المجمعة محمية بأحدث تقنيات التشفير والأمان. لا
                  نستخدم بياناتك لأغراض تجارية أو مشاركتها مع أطراف ثالثة.
                </p>
                <p>
                  يمكنك في أي وقت طلب حذف بياناتك أو تعديل إعدادات الخصوصية من
                  خلال صفحة ملفك الشخصي.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
