import {
    BookOpen,
    GraduationCap,
    Calculator,
    Globe,
    Heart,
    Zap,
    Cpu,
} from "lucide-react";

export const SUBJECT_ICONS: {
    [key: string]: React.ComponentType<{ className?: string }>;
} = {
    "أساسيات تكنولوجيا المعلومات": Cpu,
    "الرسم باليد": BookOpen,
    "سلوكيات الهيئات": Heart,
    "فيزياء 1": Zap,
    "رياضيات 1": Calculator,
    "حقوق الإنسان": Heart,
    الكترونيات: Cpu,
    "لغة انجليزية": Globe,
    "ثقافه اسلامية": BookOpen,
    "تفكير علمي": GraduationCap,
    "اساسيات الرياضيات": Calculator,
};

export const PREDEFINED_SUBJECTS = [
    { id: "1", name: "أساسيات تكنولوجيا المعلومات" },
    { id: "2", name: "الرسم باليد" },
    { id: "3", name: "سلوكيات الهيئات" },
    { id: "4", name: "فيزياء 1" },
    { id: "5", name: "رياضيات 1" },
    { id: "6", name: "حقوق الإنسان" },
    { id: "7", name: "الكترونيات" },
    { id: "8", name: "لغة انجليزية" },
    { id: "9", name: "ثقافه اسلامية" },
    { id: "10", name: "تفكير علمي" },
    { id: "11", name: "اساسيات الرياضيات" },
];
