import { motion } from "framer-motion";
import { DashboardHero } from "./dashboard/DashboardHero";
import { DashboardStats } from "./dashboard/DashboardStats";
import { DashboardLectureList } from "./dashboard/DashboardLectureList";

type LectureIndexItem = {
  key: string;
  label: string;
  order: number;
  counts: {
    summaries: number;
    videos: number;
    files: number;
    exams: number;
  };
};

type DashboardData = {
  professor: string;
  professorGender?: "male" | "female";
  description: string;
  progress: number;
  schedule: string;
  nextLecture: string;
  totalLectures: string;
};

export function SubjectDashboard(props: {
  isRTL: boolean;
  isAdmin: boolean;
  normalizedSubjectName: string;
  dashboardData: DashboardData;
  lectureIndex: LectureIndexItem[];
  totalPossibleItems: number;
  tSubjectPage: (key: string) => string;
  onBackToSubjects: () => void;
  onEditSubject: () => void;
  onAddLecture: () => void;
  onSelectLecture: (lectureKey: string) => void;
}) {
  const {
    isRTL,
    isAdmin,
    normalizedSubjectName,
    dashboardData,
    lectureIndex,
    totalPossibleItems,
    tSubjectPage,
    onBackToSubjects,
    onEditSubject,
    onAddLecture,
    onSelectLecture,
  } = props;

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
      className={`space-y-12 pb-12 ${isRTL ? "text-right" : "text-left"}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <DashboardHero
        isRTL={isRTL}
        isAdmin={isAdmin}
        normalizedSubjectName={normalizedSubjectName}
        dashboardData={dashboardData}
        tSubjectPage={tSubjectPage}
        onBackToSubjects={onBackToSubjects}
        onEditSubject={onEditSubject}
      />

      <DashboardStats
        lectureCount={lectureIndex.length}
        totalLectures={dashboardData.totalLectures}
        totalPossibleItems={totalPossibleItems}
        tSubjectPage={tSubjectPage}
      />

      <DashboardLectureList
        isRTL={isRTL}
        isAdmin={isAdmin}
        lectureIndex={lectureIndex}
        tSubjectPage={tSubjectPage}
        onAddLecture={onAddLecture}
        onSelectLecture={onSelectLecture}
      />
    </motion.div>
  );
}
