import { motion } from "framer-motion";
import { LectureHero } from "./lecture-detail/LectureHero";
import { LectureVideoPlayer } from "./lecture-detail/LectureVideoPlayer";
import { LectureExplanationSection } from "./lecture-detail/LectureExplanationSection";
import { LectureHomeworkSection } from "./lecture-detail/LectureHomeworkSection";
import { LectureExamsSection } from "./lecture-detail/LectureExamsSection";
import type { ContentItem, LectureIndexItem } from "./lecture-detail/types";

export function LectureDetailView(props: {
  isRTL: boolean;
  locale: string;
  isAdmin: boolean;
  user: unknown;
  subjectName?: string;
  selectedLecture: LectureIndexItem | null;
  explanationItems: ContentItem[];
  homeworkItems: ContentItem[];
  examItems: ContentItem[];
  activeVideoUrl: string | null;
  activeVideoTitle: string | null;
  isTheatreMode: boolean;
  completedContent: Set<string>;
  tSubjectPage: (key: string) => string;
  getYouTubeId: (url: string) => string | null;
  onBackToSubjects: () => void;
  onBackToLectures: () => void;
  onToggleTheatreMode: () => void;
  onCloseVideo: () => void;
  onToggleProgress: (contentId: string) => void;
  onViewContent: (item: ContentItem) => void;
  onAddVideo: () => void;
  onAddFile: () => void;
  onAddExam: () => void;
}) {
  const {
    isRTL,
    locale,
    isAdmin,
    user,
    subjectName,
    selectedLecture,
    explanationItems,
    homeworkItems,
    examItems,
    activeVideoUrl,
    activeVideoTitle,
    isTheatreMode,
    completedContent,
    tSubjectPage,
    getYouTubeId,
    onBackToSubjects,
    onBackToLectures,
    onToggleTheatreMode,
    onCloseVideo,
    onToggleProgress,
    onViewContent,
    onAddVideo,
    onAddFile,
    onAddExam,
  } = props;

  const lectureTitle =
    selectedLecture?.label || tSubjectPage("lectureDefaultTitle");

  const formatYmd = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  };

  const createdAtCandidates = [
    ...explanationItems.map((s) => s.created_at),
    ...homeworkItems.map((v) => v.created_at),
    ...examItems.map((f) => f.created_at),
  ]
    .filter(Boolean)
    .map((v) => new Date(v as string))
    .filter((d) => !Number.isNaN(d.getTime()));

  const lectureAddedAt = createdAtCandidates.length
    ? createdAtCandidates.sort((a, b) => a.getTime() - b.getTime())[0]
    : null;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05,
            delayChildren: 0.2,
          },
        },
      }}
      className={`space-y-8 pb-20 ${isRTL ? "text-right" : "text-left"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: -10 },
          show: { opacity: 1, y: 0 },
        }}
        className={`flex flex-col gap-8 ${
          isTheatreMode && activeVideoUrl ? "mx-auto" : ""
        }`}
      >
        <LectureHero
          isTheatreMode={isTheatreMode}
          hasActiveVideo={!!activeVideoUrl}
          onBackToSubjects={onBackToSubjects}
          onBackToLectures={onBackToLectures}
          backToSubjectsTitle={`${tSubjectPage("backToSubjects")} ${subjectName || ""}`}
          backToLecturesLabel={tSubjectPage("backToLectures")}
          lectureContentLabel={tSubjectPage("lectureContent")}
          lectureTitle={lectureTitle}
          lectureInfoLabel={tSubjectPage("lectureInfo")}
          addedDateLabel={tSubjectPage("addedDate")}
          sourcesCountLabel={tSubjectPage("sourcesCount")}
          examsLabel={tSubjectPage("exams")}
          addedDateValue={lectureAddedAt ? formatYmd(lectureAddedAt) : "—"}
          sourcesCountValue={explanationItems.length}
          examsCountValue={examItems.length}
          explanationCount={explanationItems.length}
          explanationLabel={tSubjectPage("explanation")}
          homeworkCount={homeworkItems.length}
          homeworkLabel={tSubjectPage("homework")}
          examCount={examItems.length}
          examLabel={tSubjectPage("examLabel")}
        />

        <LectureVideoPlayer
          activeVideoUrl={activeVideoUrl}
          activeVideoTitle={activeVideoTitle}
          isTheatreMode={isTheatreMode}
          getYouTubeId={getYouTubeId}
          onToggleTheatreMode={onToggleTheatreMode}
          onCloseVideo={onCloseVideo}
          theatreModeLabel={tSubjectPage("theatreMode")}
          exitTheatreModeLabel={tSubjectPage("exitTheatreMode")}
          videoPlayerLabel={tSubjectPage("videoPlayer")}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0 },
          }}
          className="lg:col-span-8 space-y-12"
        >
          <LectureExplanationSection
            explanationItems={explanationItems}
            completedContent={completedContent}
            locale={locale}
            user={user}
            isAdmin={isAdmin}
            onAddVideo={onAddVideo}
            onAddFile={onAddFile}
            onToggleProgress={onToggleProgress}
            onViewContent={onViewContent}
            title={tSubjectPage("explanationsAndLessons")}
            videoLabel={tSubjectPage("video")}
            fileLabel={tSubjectPage("file")}
            noContentLabel={tSubjectPage("noExplanationContent")}
            viewContentLabel={tSubjectPage("viewContent")}
            contentTypeVideoLabel={tSubjectPage("contentType.video")}
            contentTypeSummaryLabel={tSubjectPage("contentType.summary")}
            contentTypeFileLabel={tSubjectPage("contentType.file")}
            liveTag={tSubjectPage("liveTag")}
            markLessonAsCompletedLabel={tSubjectPage("markLessonAsCompleted")}
            unmarkLessonCompletedLabel={tSubjectPage("unmarkLessonCompleted")}
            mustLoginErrorLabel={tSubjectPage("errors.mustLogin")}
          />

          <LectureHomeworkSection
            homeworkItems={homeworkItems}
            completedContent={completedContent}
            onToggleProgress={onToggleProgress}
            title={tSubjectPage("assignmentsAndHomework")}
            downloadHomeworkLabel={tSubjectPage("downloadHomework")}
            markAsCompletedLabel={tSubjectPage("markAsCompleted")}
            unmarkCompletedLabel={tSubjectPage("unmarkCompleted")}
          />
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1 },
          }}
          className="lg:col-span-4 space-y-8"
        >
          <LectureExamsSection
            isRTL={isRTL}
            examItems={examItems}
            completedContent={completedContent}
            isAdmin={isAdmin}
            onToggleProgress={onToggleProgress}
            onViewContent={onViewContent}
            onAddExam={onAddExam}
            title={tSubjectPage("exams")}
            noExamsLabel={tSubjectPage("noExams")}
            markAsCompletedLabel={tSubjectPage("markAsCompleted")}
            unmarkCompletedLabel={tSubjectPage("unmarkCompleted")}
            startChallengeLabel={tSubjectPage("startChallenge")}
            addExamLabel={tSubjectPage("addExam")}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
