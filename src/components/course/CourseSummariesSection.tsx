import React from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../ui";
import { FileText, Plus, Edit, Trash2 } from "lucide-react";
import type { CourseSummary } from "./types";

interface CourseSummariesSectionProps {
  summaries: CourseSummary[];
  isInstructor: boolean;
  onAddSummary: () => void;
  onEditSummary: (summary: CourseSummary) => void;
  onDeleteSummary: (summaryId: string) => void;
}

export default function CourseSummariesSection({
  summaries,
  isInstructor,
  onAddSummary,
  onEditSummary,
  onDeleteSummary,
}: CourseSummariesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="w-5 h-5 ml-2 text-blue-600" />
            ملخصات الكورس
          </div>
          {isInstructor && (
            <Button
              size="sm"
              onClick={onAddSummary}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              إضافة ملخص
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            لا توجد ملخصات متاحة لهذا الكورس بعد
          </p>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => (
              <div
                key={summary.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {summary.title}
                  </h4>
                  {isInstructor && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEditSummary(summary)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDeleteSummary(summary.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div
                  className="text-gray-700 dark:text-gray-300 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: summary.content }}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
