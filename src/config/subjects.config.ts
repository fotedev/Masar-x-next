// subjects.config.ts - Configurable subjects for template customization
// Edit this file to customize subjects for your college

import {
    BookOpen,
    GraduationCap,
    Calculator,
    Globe,
    Heart,
    Zap,
    Cpu,
} from "lucide-react";

export interface Subject {
    id: string;
    name: string;
    semester?: 1 | 2;
}

export interface SubjectIconMap {
    [key: string]: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// COLLEGE CUSTOMIZATION SECTION
// ============================================================================
// Change these values to match your college's subjects

export const COLLEGE_CONFIG = {
    name: "جامعة مسار", // Change to your college name
    // Add your college logo path here if needed
    logo: "/logo.png"
};

// Semester 1 subjects
export const SEMESTER_1_SUBJECTS: Subject[] = [
    { id: "1", name: "أساسيات تكنولوجيا المعلومات", semester: 1 },
    { id: "2", name: "الرسم باليد", semester: 1 },
    { id: "3", name: "سلوكيات الهيئات", semester: 1 },
    { id: "4", name: "فيزياء 1", semester: 1 },
    { id: "5", name: "رياضيات 1", semester: 1 },
    { id: "6", name: "حقوق الإنسان", semester: 1 },
    { id: "7", name: "الكترونيات", semester: 1 },
    { id: "8", name: "لغة انجليزية", semester: 1 },
    { id: "9", name: "ثقافه اسلامية", semester: 1 },
    { id: "10", name: "تفكير علمي", semester: 1 },
    { id: "11", name: "اساسيات الرياضيات", semester: 1 },
];

// Semester 2 subjects (customize for your college)
export const SEMESTER_2_SUBJECTS: Subject[] = [
    { id: "12", name: "رياضيات 2", semester: 2 },
    { id: "13", name: "التواصل الشخصي", semester: 2 },
    { id: "14", name: "أساسيات نظم المعلومات", semester: 2 },
    { id: "15", name: "الحاسبات والمجتمع", semester: 2 },
    { id: "16", name: "أساسيات البرمجة", semester: 2 },
    { id: "17", name: "الكتابة التقنية للحوسبة", semester: 2 },
    { id: "18", name: "دوائر رقمية", semester: 2 },
];

// Combine all subjects
export const ALL_SUBJECTS = [...SEMESTER_1_SUBJECTS, ...SEMESTER_2_SUBJECTS];

// Subject icons mapping (add icons for new subjects as needed)
export const SUBJECT_ICONS: SubjectIconMap = {
    "أساسيات تكنولوجيا المعلومات": Cpu,
    "الرسم باليد": BookOpen,
    "سلوكيات الهيئات": Heart,
    "فيزياء 1": Zap,
    "رياضيات 1": Calculator,
    "حقوق الإنسان": Heart,
    "الكترونيات": Cpu,
    "لغة انجليزية": Globe,
    "ثقافه اسلامية": BookOpen,
    "تفكير علمي": GraduationCap,
    "اساسيات الرياضيات": Calculator,
    // Semester 2 subjects - add appropriate icons
    "رياضيات 2": Calculator,
    "التواصل الشخصي": Heart,
    "أساسيات نظم المعلومات": Cpu,
    "الحاسبات والمجتمع": Globe,
    "أساسيات البرمجة": Cpu,
    "الكتابة التقنية للحوسبة": BookOpen,
    "دوائر رقمية": Cpu,
};

// ============================================================================
// INSTRUCTIONS FOR TEMPLATE USERS:
// ============================================================================
/*
To customize this template for your college:

1. Edit COLLEGE_CONFIG.name to your college name
2. Replace SEMESTER_1_SUBJECTS with your semester 1 subjects
3. Replace SEMESTER_2_SUBJECTS with your semester 2 subjects
4. Add appropriate icons in SUBJECT_ICONS for new subjects
5. Run the setup script: npm run setup-subjects

The setup script will automatically update the database with your subjects.
*/
