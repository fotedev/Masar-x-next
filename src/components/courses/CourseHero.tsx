import React from "react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { CheckCircle, Clock, XCircle } from "lucide-react";

interface CourseHeroProps {
  course: {
    title: string;
    instructor_name?: string;
    price: number;
    description: string;
  };
  enrollmentStatus: string;
  renderActionButton: () => React.ReactNode;
}

export function CourseHero({ course, enrollmentStatus, renderActionButton }: CourseHeroProps) {
  const renderStatusBadge = () => {
    switch (enrollmentStatus) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 ml-1" />
            نشط
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 ml-1" />
            في الانتظار
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-2xl">{course.title}</CardTitle>
            <CardDescription className="text-lg">
              مدرب: {course.instructor_name}
            </CardDescription>
          </div>
          {renderStatusBadge()}
        </div>
        {course.price > 0 && (
          <div className="text-2xl font-bold text-green-600">
            {course.price} جنيه مصري
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          {course.description}
        </p>
        {renderActionButton()}
      </CardContent>
    </Card>
  );
}
