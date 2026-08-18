
import { useTranslations } from "next-intl";
import { Brain, FileText, Trash2 } from "lucide-react";
import {
  ASSISTANT_MODE_BUTTON,
  ASSISTANT_SELECT,
  ASSISTANT_ACTION_BUTTONS,
} from "@/constants/assistantUIStyles";

/**
 * AssistantControls Component
 *
 * عنصر التحكمات - يحتوي على:
 * - زر التبديل بين الأنماط
 * - منتقيات (المادة والامتحان)
 * - أزرار الإجراءات (ابدأ الامتحان، تلخيص، حذف)
 *
 * @param {Object} props - خصائص المكون
 * @param {string} props.currentMode - النمط الحالي ('student_agent', 'group_rag', 'cs_assistant')
 * @param {Function} props.onModeChange - دالة عند تغيير النمط
 * @param {string[]} props.subjects - قائمة المواد المتاحة
 * @param {string} props.selectedSubject - المادة المختارة
 * @param {Function} props.onSubjectChange - دالة عند تغيير المادة
 * @param {string[]} props.exams - قائمة الامتحانات المتاحة
 * @param {string} props.selectedExam - الامتحان المختار
 * @param {Function} props.onExamChange - دالة عند تغيير الامتحان
 * @param {Function} props.onStartExam - دالة عند الضغط على "ابدأ الامتحان"
 * @param {Function} props.onSummarize - دالة عند الضغط على "تلخيص"
 * @param {Function} props.onClear - دالة عند الضغط على "مسح"
 * @param {boolean} props.isExamDisabled - هل زر الامتحان معطل
 * @param {boolean} props.isSummarizeDisabled - هل زر التلخيص معطل
 *
 * @example
 * <AssistantControls
 *   currentMode="student_agent"
 *   onModeChange={(mode) => setMode(mode)}
 *   subjects={['Math', 'English']}
 *   selectedSubject="Math"
 *   onSubjectChange={(s) => setSubject(s)}
 *   exams={['Exam 1', 'Exam 2']}
 *   selectedExam="Exam 1"
 *   onExamChange={(e) => setExam(e)}
 *   onStartExam={() => startExam()}
 *   onSummarize={() => summarize()}
 *   onClear={() => clearChat()}
 *   isExamDisabled={false}
 *   isSummarizeDisabled={false}
 * />
 */
interface AssistantControlsProps {
  currentMode: "student_agent" | "group_rag" | "cs_assistant";
  onModeChange: (mode: "student_agent" | "group_rag" | "cs_assistant") => void;
  subjects: string[];
  selectedSubject: string;
  onSubjectChange: (subject: string) => void;
  exams: string[];
  selectedExam: string;
  onExamChange: (exam: string) => void;
  onStartExam: () => void;
  onSummarize: () => void;
  onClear: () => void;
  isExamDisabled?: boolean;
  isSummarizeDisabled?: boolean;
}

export function AssistantControls({
  currentMode,
  onModeChange,
  subjects,
  selectedSubject,
  onSubjectChange,
  exams,
  selectedExam,
  onExamChange,
  onStartExam,
  onSummarize,
  onClear,
  isExamDisabled = false,
  isSummarizeDisabled = false,
}: AssistantControlsProps) {
  const t = useTranslations("assistant");

  const getToggleTitle = () => {
    const titles = {
      student_agent: t("toggleToCodeAssistant"),
      group_rag: t("toggleToGroupChat"),
      cs_assistant: t("toggleToStudentAssistant"),
    };
    return titles[currentMode] || t("toggleToStudentAssistant");
  };

  const getNextModeName = () => {
    const nextModes = {
      student_agent: t("codeAssistantMode"),
      group_rag: t("groupChatMode"),
      cs_assistant: t("studentAssistantMode"),
    };
    return nextModes[currentMode] || t("studentAssistantMode");
  };

  const handleToggleMode = () => {
    const modeMap = {
      student_agent: "cs_assistant" as const,
      group_rag: "student_agent" as const,
      cs_assistant: "group_rag" as const,
    };
    onModeChange(modeMap[currentMode]);
  };

  return (
    <>
      {/* Mode Toggle Button */}
      <button
        onClick={handleToggleMode}
        className={ASSISTANT_MODE_BUTTON.base}
        title={getToggleTitle()}
      >
        {/* Mobile Icon */}
        <span className={ASSISTANT_MODE_BUTTON.icon}>
          <Brain className={ASSISTANT_MODE_BUTTON.iconSvg} />
        </span>
        {/* Desktop Text */}
        <span className={ASSISTANT_MODE_BUTTON.text}>
          تبديل: {getNextModeName()}
        </span>
      </button>

      {/* Selectors: Subject & Exam */}
      <div className={ASSISTANT_SELECT.wrapper}>
        {/* Subject Selector */}
        <select
          value={selectedSubject}
          onChange={(e) => onSubjectChange(e.target.value)}
          className={ASSISTANT_SELECT.input}
        >
          <option value="">{t("selectSubject")}</option>
          {subjects.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>

        {/* Exam Selector */}
        <select
          value={selectedExam}
          onChange={(e) => onExamChange(e.target.value)}
          disabled={isExamDisabled}
          className={`${ASSISTANT_SELECT.input} ${ASSISTANT_SELECT.disabled}`}
        >
          <option value="">
            {exams.length === 0 ? t("noExams") : t("selectExam")}
          </option>
          {exams.map((exam) => (
            <option key={exam} value={exam}>
              {exam}
            </option>
          ))}
        </select>

        {/* Start Exam Button */}
        <button
          onClick={onStartExam}
          disabled={isExamDisabled}
          className={ASSISTANT_ACTION_BUTTONS.startExam}
          title={t("startExam")}
        >
          ابدأ
        </button>
      </div>

      {/* Divider (Desktop Only) */}
      <div className={ASSISTANT_ACTION_BUTTONS.divider}></div>

      {/* Summarize Button */}
      <button
        onClick={onSummarize}
        disabled={isSummarizeDisabled}
        className={`${ASSISTANT_ACTION_BUTTONS.summarize} ${
          isSummarizeDisabled ? "text-slate-300" : "hover:text-slate-600"
        }`}
        title={t("summarize")}
      >
        <FileText className={ASSISTANT_ACTION_BUTTONS.summarizeIcon} />
      </button>

      {/* Clear Button */}
      <button
        onClick={onClear}
        className={ASSISTANT_ACTION_BUTTONS.delete}
        title={t("clear")}
      >
        <Trash2 className={ASSISTANT_ACTION_BUTTONS.deleteIcon} />
      </button>
    </>
  );
}

export default AssistantControls;
