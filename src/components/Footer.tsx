"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../contexts/AuthContext";
import {
  BookOpen,
  Newspaper,
  LayoutDashboard,
  MessageSquare,
  Github,
  Heart,
  ExternalLink,
  Shield,
} from "lucide-react";

export function Footer() {
  const { displayName } = useAuth();
  const phoneNumber = "201207688761";
  const whatsappUrl = `https://wa.me/${phoneNumber}`;
  const trwWhatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(
    `أنا الطالب: ${displayName || "زائر"}، أريد الانضمام إلى قسم TRW`,
  )}`;

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-8 pb-6 mt-auto transition-colors">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Masar X Logo"
                width={40}
                height={40}
                className="object-contain w-10 h-10"
              />
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                Masar X
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
              منصة تعليمية متكاملة تهدف إلى تسهيل مشاركة الملخصات والمصادر
              الدراسية بين الطلاب، لتعزيز التعاون وتحقيق أفضل النتائج.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
              روابط سريعة
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <LayoutDashboard className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span>الرئيسية</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/news"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <Newspaper className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span>الأخبار</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/subjects"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <BookOpen className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span>المواد الدراسية</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/quizzes"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <MessageSquare className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span>الامتحانات</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <span className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    ❓
                  </span>
                  <span>الأسئلة الشائعة</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-slate-600 dark:text-slate-400 hover:text-brand-blue dark:hover:text-brand-blue transition-colors flex items-center gap-2 text-sm font-medium group"
                >
                  <Shield className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <span>سياسة الخصوصية</span>
                </Link>
              </li>
              <li className="pt-2 border-t border-slate-100 dark:border-white/5 mt-2">
                <a
                  href={trwWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 group/trw"
                >
                  <div className="flex items-center gap-2 text-red-500 dark:text-red-400 hover:text-red-600 transition-colors text-sm font-bold animate-pulse group-hover/trw:animate-none">
                    <span>The Real World</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover/trw:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 pr-7 leading-tight">
                    تواصل على واتساب للانضمام إلى القسم الغير اكاديمي
                  </p>
                </a>
              </li>
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
              الدعم والمساعدة
            </h3>
            <div className="space-y-3">
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                هل لديك استفسار أو واجهت مشكلة؟
              </p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-2xl transition-all duration-300 font-bold text-sm shadow-lg shadow-green-500/20 group"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 19 19"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="transition-transform group-hover:scale-110"
                >
                  <path
                    d="M15.255 3.713a8 8 0 0 0-5.684-2.36c-4.433 0-8.043 3.603-8.043 8.036 0 1.394.364 2.771 1.045 3.974l-1.164 4.26 4.354-1.14a8.06 8.06 0 0 0 3.8.957c4.434 0 8.044-3.61 8.044-8.043 0-2.145-.84-4.172-2.352-5.692zM4.283 13.11c-.76-.863-1.18-2.312-1.18-3.72a6.467 6.467 0 0 1 6.46-6.46 6.42 6.42 0 0 1 4.568 1.891 6.42 6.42 0 0 1 1.892 4.568 6.467 6.467 0 0 1-6.46 6.46c-1.258 0-2.596-.404-3.562-1.06l-2.343.609z"
                    fill="currentColor"
                  ></path>
                  <path
                    d="M11.748 10.434c.182.064 1.148.539 1.346.641.198.103.333.15.38.23.048.08.048.475-.119.934s-.95.879-1.33.934c-.34.048-.768.072-1.242-.079a12 12 0 0 1-1.125-.412c-1.979-.854-3.27-2.842-3.364-2.976-.103-.143-.8-1.069-.8-2.035s.507-1.448.689-1.646a.72.72 0 0 1 .522-.246h.38c.12 0 .285-.047.444.34.166.396.562 1.362.61 1.465a.38.38 0 0 1 .015.349c-.063.134-.095.213-.198.324a8 8 0 0 1-.293.348c-.095.095-.198.206-.087.404.119.198.507.84 1.093 1.362.752.673 1.385.879 1.583.974s.309.079.428-.048c.118-.135.49-.578.625-.776s.261-.166.443-.095z"
                    fill="currentColor"
                  ></path>
                </svg>
                <span>تواصل</span>
              </a>
            </div>
          </div>

          {/* Developer Section */}
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
              المطور
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  <Github className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                </div>
                <div>
                  <h4 className="text-slate-900 dark:text-white font-bold text-sm">
                    Aboalayoun
                  </h4>
                  <p className="text-slate-500 dark:text-slate-500 text-xs">
                    AI student
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  window.open("https://github.com/Aboalayoun", "_blank")
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group"
              >
                <span>متابعة على GitHub</span>
                <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 dark:text-slate-500 text-xs font-medium">
            © {new Date().getFullYear()} Masar X - جميع الحقوق محفوظة
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-500">
            <span className="text-brand-blue font-bold">Aboalayoun</span>
            <span>by</span>
            <Heart className="w-3 h-3 text-white fill-white animate-pulse" />
            <span>Made with</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
