// Course-related type definitions
export interface Course {
    id: string;
    title: string;
    description: string;
    instructor_id: string;
    price: number;
    is_published: boolean;
    created_at: string;
    instructor_name?: string;
}

export interface Enrollment {
    id: string;
    status: "pending" | "active" | "rejected";
    payment_screenshot_url?: string;
    created_at: string;
}

export interface Review {
    id: string;
    rating: number;
    content?: string;
    created_at: string;
    student_name?: string;
}

export interface CourseSummary {
    id: string;
    title: string;
    content: string;
    order_index: number;
    created_at: string;
}

export interface CourseVideo {
    id: string;
    title: string;
    description?: string;
    video_url: string;
    language: "ar" | "en";
    duration?: number;
    order_index: number;
    created_at: string;
}

export interface CourseFile {
    id: string;
    title: string;
    description?: string;
    file_url: string;
    file_type: string;
    file_size?: number;
    order_index: number;
    created_at: string;
}

export type EnrollmentStatus = "not_enrolled" | "pending" | "active" | "rejected";
