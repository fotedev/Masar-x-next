"use client";

import { useState, useMemo } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Trash } from "lucide-react";
import {
  Newspaper,
  Plus,
  AlertTriangle,
  Sparkles,
  Search,
  Flag,
  X as CloseIcon,
  Download,
  FileText as FileIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useNews } from "@/hooks/useNews";
import { News, Database } from "@/types/database";
import { NewsSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { AppealFormModal } from "@/components/AppealFormModal";
import { AddNewsModal } from "@/components/AddNewsModal";

// استخدام نوع News من قاعدة البيانات
type NewsItem = News & { summary?: string };

function NewsPage() {
  const t = useTranslations("news");
  const locale = useLocale();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { notifyAdmins, notifyAllUsers } = useNotifications();
  const {
    news,
    loading,
    showAddNews,
    setShowAddNews,
    newNews,
    setNewNews,
    deleteNews,
    addNews,
  } = useNews();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [appealModal, setAppealModal] = useState<{
    isOpen: boolean;
    contentId: string;
    contentTitle: string;
  }>({ isOpen: false, contentId: "", contentTitle: "" });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const categories = [
    { id: "all", label: t("categoryAll"), icon: Newspaper, color: "blue" },
    {
      id: "announcement",
      label: t("categoryAnnouncement"),
      icon: AlertTriangle,
      color: "orange",
    },
    {
      id: "update",
      label: t("categoryUpdate"),
      icon: Sparkles,
      color: "green",
    },
    {
      id: "important",
      label: t("categoryImportant"),
      icon: AlertTriangle,
      color: "red",
    },
  ];

  const filteredNews = useMemo(() => {
    const validatedNews = news.map((item) => {
      const validation = NewsSchema.safeParse(item);
      if (!validation.success) {
        logger.error(`Validation failed for news item ${item.id}:`, validation.error.format());
        return item as NewsItem;
      }
      return validation.data as NewsItem;
    });

    let filtered = validatedNews;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((item) => item.type === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.content.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return filtered;
  }, [news, selectedCategory, searchTerm]);

  const getCategoryColor = (category: string) => {
    const categoryConfig = categories.find((cat) => cat.id === category);
    return categoryConfig?.color || "blue";
  };

  const handleAddNewsItem = async (
    newsData: Database["public"]["Tables"]["news"]["Insert"],
    fileUrl: string | null,
    imageUrls: string[] | null,
    customCategory: string | null,
  ) => {
    if (!newsData.title.trim() || !newsData.content.trim()) {
      return;
    }

    try {
      const addedNews = await addNews(
        newsData,
        fileUrl,
        imageUrls,
        customCategory,
      );

      if (addedNews) {
        notifyAdmins(
          t("reviewRequired"),
          t("reviewRequiredDesc", {
            title: newsData.title,
            type:
              newsData.type === "announcement"
                ? t("newsTypeAnnouncement")
                : newsData.type === "update"
                  ? t("newsTypeUpdate")
                  : t("newsTypeImportant"),
          }),
          "admin_submission",
          addedNews.id,
          "news",
        );

        notifyAllUsers(
          t("newNewsTitle"),
          t("newNewsDesc", { title: newsData.title }),
          "content_published",
          addedNews.id,
          "news",
        );

        setShowAddNews(false);
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">
            {t("loadingNews")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-blue rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-start">
            <Newspaper className="w-12 h-12 flex-shrink-0" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                {t("pageTitle")}
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                {t("pageDescription")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {user ? (
              <button
                onClick={() => setShowAddNews(true)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-xl transition-colors font-bold shadow-lg backdrop-blur-md border border-white/10"
              >
                <Plus className="w-4 h-4" />
                <span>{t("addNews")}</span>
              </button>
            ) : (
              <button
                onClick={() => router.push("/login")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-xl transition-colors font-bold shadow-lg backdrop-blur-md border border-white/10"
              >
                {t("loginToAddNews")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <label htmlFor="news-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <Search className={`absolute ${locale === 'ar' ? 'right-4' : 'left-4'} top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5`} />
            <input
              id="news-search"
              name="newsSearch"
              type="text"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full ${locale === 'ar' ? 'pr-12 pl-5' : 'pl-12 pr-5'} py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-brand-blue focus:border-transparent bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 outline-none transition-all`}
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category.id
                  ? category.id === "announcement"
                    ? "bg-brand-orange/10 dark:bg-brand-orange/20 text-brand-orange dark:text-brand-orange border border-brand-orange/20 dark:border-brand-orange/30"
                    : `bg-${category.color}-50 dark:bg-${category.color}-900/50 text-${category.color}-700 dark:text-${category.color}-300 border border-${category.color}-200 dark:border-${category.color}-800`
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              <category.icon className="w-4 h-4" />
              <span>{category.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* نموذج إضافة خبر جديد */}
      <AddNewsModal
        showAddNews={showAddNews}
        newNews={newNews}
        onSetShowAddNews={setShowAddNews}
        onSetNewNews={setNewNews}
        onAddNews={handleAddNewsItem}
      />

      {/* News Items */}
      {filteredNews.length === 0 ? (
        <div className="text-center py-12 modern-card border-dashed border-2 border-slate-200 dark:border-slate-800 min-h-[400px] flex flex-col items-center justify-center">
          <Newspaper className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t("noNews")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t("noNewsDescription")}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredNews.map((item) => (
            <div key={item.id} className="modern-card p-6">
              {/* Category Badge */}
              <div
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium mb-4 bg-${getCategoryColor(
                  item.type,
                )}-100 dark:bg-${getCategoryColor(
                  item.type,
                )}-900/30 text-${getCategoryColor(
                  item.type,
                )}-800 dark:text-${getCategoryColor(item.type)}-300`}
              >
                {(() => {
                  const category = categories.find(
                    (cat) => cat.id === item.type,
                  );
                  const IconComponent = category?.icon;
                  return IconComponent && <IconComponent className="w-3 h-3" />;
                })()}
                <span>
                  {item.custom_category ||
                    categories.find((cat) => cat.id === item.type)?.label}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                {item.title}
              </h2>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                {item.content}
              </p>

              {/* Images Display */}
              {item.image_urls && item.image_urls.length > 0 && (
                <div
                  className={`grid gap-2 mb-4 ${
                    item.image_urls.length === 1
                      ? "grid-cols-1"
                      : item.image_urls.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-2 sm:grid-cols-3"
                  }`}
                >
                  {item.image_urls.map((url, index) => (
                    <div
                      key={index}
                      className="relative aspect-video rounded-lg overflow-hidden border border-gray-100 dark:border-gray-700 cursor-pointer bg-gray-50 dark:bg-gray-900"
                    >
                      <Image
                        src={url}
                        alt={`${item.title} - صورة ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-contain hover:scale-105 transition-transform duration-300"
                        onClick={() => setSelectedImage(url)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* File Attachment Display */}
              {item.file_url && (
                <div className="mb-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-500/10 p-2 rounded-lg">
                        <FileIcon className="w-5 h-5 text-red-500" />
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {t("attachedFile")}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("attachedFileDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-brand-blue transition-colors"
                        title={t("previewFile")}
                      >
                        <Search className="w-5 h-5" />
                      </a>
                      <a
                        href={
                          item.file_url.includes("/upload/")
                            ? item.file_url.replace(
                                "/upload/",
                                "/upload/fl_attachment/",
                              )
                            : item.file_url
                        }
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-brand-blue transition-colors"
                        title={t("downloadFile")}
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {item.summary && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4 border-l-4 border-blue-400">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      {t("summary")}:
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {item.summary}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() =>
                    setAppealModal({
                      isOpen: true,
                      contentId: item.id,
                      contentTitle: item.title,
                    })
                  }
                  className="flex items-center gap-2 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 text-sm font-medium transition-colors"
                >
                  <Flag className="w-4 h-4" />
                  <span>{t("appealNews")}</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => deleteNews(item.id)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium transition-colors"
                  >
                    <Trash className="w-4 h-4" />
                    <span>{t("deleteNews")}</span>
                  </button>
                )}

                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString("ar-EG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "غير معروف"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppealFormModal
        isOpen={appealModal.isOpen}
        onClose={() =>
          setAppealModal({ isOpen: false, contentId: "", contentTitle: "" })
        }
        contentId={appealModal.contentId}
        contentType="news"
        contentTitle={appealModal.contentTitle}
      />

      {/* Image Modal (Lightbox) */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>

          <div
            className="relative w-full h-full max-w-5xl max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedImage}
              alt="News Full Preview"
              fill
              className="object-contain animate-in zoom-in-95 duration-300"
              sizes="(max-width: 1024px) 100vw, 1024px"
              priority
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button
              onClick={() => window.open(selectedImage, "_blank")}
              className="flex items-center gap-2 px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm font-medium border border-white/10 backdrop-blur-md"
            >
              <Download className="w-4 h-4" />
              <span>{t("download")}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewsPage;
