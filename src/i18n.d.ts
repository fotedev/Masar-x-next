declare global {
  // Use implementation aspects of `next-intl` to get the types
  // from our specific messages.
  type IntlMessages = Messages;
}

type Messages = {
  addFile: typeof import("./messages/ar/addFile.json");
  addSubjectModal: typeof import("./messages/ar/addSubjectModal.json");
  addSummary: typeof import("./messages/ar/addSummary.json");
  addVideo: typeof import("./messages/ar/addVideo.json");
  adminDashboard: typeof import("./messages/ar/adminDashboard.json");
  aiAssistant: typeof import("./messages/ar/aiAssistant.json");
  appeals: typeof import("./messages/ar/appeals.json");
  auth: typeof import("./messages/ar/auth.json");
  authPages: typeof import("./messages/ar/authPages.json");
  common: typeof import("./messages/ar/common.json");
  courseDetail: typeof import("./messages/ar/courseDetail.json");
  courses: typeof import("./messages/ar/courses.json");
  editSummary: typeof import("./messages/ar/editSummary.json");
  errorBoundary: typeof import("./messages/ar/errorBoundary.json");
  fileDropzone: typeof import("./messages/ar/fileDropzone.json");
  footer: typeof import("./messages/ar/footer.json");
  header: typeof import("./messages/ar/header.json");
  home: typeof import("./messages/ar/home.json");
  lectureSelect: typeof import("./messages/ar/lectureSelect.json");
  metadata: typeof import("./messages/ar/metadata.json");
  nav: typeof import("./messages/ar/nav.json");
  news: typeof import("./messages/ar/news.json");
  notFound: typeof import("./messages/ar/notFound.json");
  notifications: typeof import("./messages/ar/notifications.json");
  onboarding: typeof import("./messages/ar/onboarding.json");
  privacyDetails: typeof import("./messages/ar/privacyDetails.json");
  privacyPolicy: typeof import("./messages/ar/privacyPolicy.json");
  profile: typeof import("./messages/ar/profile.json");
  pwa: typeof import("./messages/ar/pwa.json");
  quizAttempts: typeof import("./messages/ar/quizAttempts.json");
  quizzes: typeof import("./messages/ar/quizzes.json");
  reviews: typeof import("./messages/ar/reviews.json");
  subjectMetadata: typeof import("./messages/ar/subjectMetadata.json");
  subjectPage: typeof import("./messages/ar/subjectPage.json");
  subjects: typeof import("./messages/ar/subjects.json");
  subjectsTab: typeof import("./messages/ar/subjectsTab.json");
  summaries: typeof import("./messages/ar/summaries.json");
  theme: typeof import("./messages/ar/theme.json");
  trw: typeof import("./messages/ar/trw.json");
  trwRedeem: typeof import("./messages/ar/trwRedeem.json");
};
