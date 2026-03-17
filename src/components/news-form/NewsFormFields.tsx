import React from "react";

type TranslationValues = Record<string, string | number | Date>;
type TranslationFn = (key: string, values?: TranslationValues) => string;

type NewsDraft = {
  title: string;
  content: string;
  type: string;
};

interface NewsFormFieldsProps {
  newNews: NewsDraft;
  onSetNewNews: (news: NewsDraft) => void;
  customCategory: string;
  setCustomCategory: (val: string) => void;
  t: TranslationFn;
}

export function NewsFormFields({
  newNews,
  onSetNewNews,
  customCategory,
  setCustomCategory,
  t,
}: NewsFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("newsTitle")}
        </label>
        <input
          type="text"
          value={newNews.title}
          onChange={(e) => onSetNewNews({ ...newNews, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder={t("newsPlaceholder")}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("newsType")}
        </label>
        <select
          value={newNews.type}
          onChange={(e) =>
            onSetNewNews({
              ...newNews,
              type: e.target.value,
            })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="announcement">{t("newsTypeAnnouncement")}</option>
          <option value="update">{t("newsTypeUpdate")}</option>
          <option value="important">{t("newsTypeImportant")}</option>
          <option value="custom">{t("newsTypeCustom")}</option>
        </select>
      </div>

      {newNews.type === "custom" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t("newsCustomCategory")}
          </label>
          <input
            type="text"
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            placeholder={t("newsCustomCategoryPlaceholder")}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t("newsContent")}
        </label>
        <textarea
          value={newNews.content}
          onChange={(e) =>
            onSetNewNews({ ...newNews, content: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white min-h-[100px]"
          placeholder={t("newsContentPlaceholder")}
        />
      </div>
    </div>
  );
}
