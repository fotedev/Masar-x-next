
import { Sparkles } from "lucide-react";

interface QuizImportModalProps {
  importMode: "json" | "text";
  setImportMode: (mode: "json" | "text") => void;
  importJson: string;
  setImportJson: (value: string) => void;
  isGenerating: boolean;
  onImport: (mode: "json" | "text") => void;
  onClose: () => void;
  t: (key: string) => string;
}

export function QuizImportModal({
  importMode,
  setImportMode,
  importJson,
  setImportJson,
  isGenerating,
  onImport,
  onClose,
  t,
}: QuizImportModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 w-full max-w-2xl">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          {importMode === "json"
            ? t("quizzes.importFromNotebookLM")
            : t("quizzes.generateWithAI")}
        </h3>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setImportMode("json")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              importMode === "json"
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            {t("quizzes.importJSON")}
          </button>
          <button
            onClick={() => setImportMode("text")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              importMode === "text"
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{t("quizzes.generateText")}</span>
            </div>
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {importMode === "json"
            ? t("quizzes.pasteJSONHere")
            : t("quizzes.pasteTextHere")}
        </p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          className="w-full h-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
          placeholder={
            importMode === "json"
              ? '[{"question": "...", "options": ["..."], "correctAnswer": 0, "explanation": "..."}]'
              : t("quizzes.pasteTextInputPlaceholder")
          }
        />
        <div className="flex justify-end gap-4 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            {t("quizzes.cancel")}
          </button>
          {importMode === "json" ? (
            <button
              onClick={() => onImport("json")}
              disabled={!importJson.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("quizzes.import")}
            </button>
          ) : (
            <button
              onClick={() => onImport("text")}
              disabled={!importJson.trim() || isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>{t("quizzes.generate")}...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t("quizzes.generate")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
