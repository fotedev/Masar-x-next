import React from "react";
import { Card, CardContent, CardHeader, CardTitle, Button } from "../ui";
import { Video, Plus, Edit, Trash2, Play } from "lucide-react";
import type { CourseVideo } from "./types";
import { useTranslations } from "next-intl";

interface CourseVideosSectionProps {
  videos: CourseVideo[];
  isInstructor: boolean;
  onAddVideo: () => void;
  onEditVideo: (video: CourseVideo) => void;
  onDeleteVideo: (videoId: string) => void;
}

function VideoCard({
  video,
  isInstructor,
  onEdit,
  onDelete,
  t,
}: {
  video: CourseVideo;
  isInstructor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  t: any;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3 rtl:space-x-reverse">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <Play className="w-6 h-6 text-red-600" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {video.title}
            </h5>
            {isInstructor && (
              <div className="flex gap-1 ml-2">
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
          {video.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {video.description}
            </p>
          )}
          {video.duration && (
            <p className="text-xs text-gray-400 mt-1">
              {t("duration")}: {Math.floor(video.duration / 60)}:
              {(video.duration % 60).toString().padStart(2, "0")}
            </p>
          )}
          <Button
            size="sm"
            className="mt-2"
            onClick={() => window.open(video.video_url, "_blank")}
          >
            <Play className="w-4 h-4 ml-1" />
            {t("watch")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CourseVideosSection({
  videos,
  isInstructor,
  onAddVideo,
  onEditVideo,
  onDeleteVideo,
}: CourseVideosSectionProps) {
  const t = useTranslations("courseDetail.videos");
  const arabicVideos = videos.filter((v) => v.language === "ar");
  const englishVideos = videos.filter((v) => v.language === "en");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Video className="w-5 h-5 ml-2 text-red-600" />
            {t("title")}
          </div>
          {isInstructor && (
            <Button
              size="sm"
              onClick={onAddVideo}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t("addVideo")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {videos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t("empty")}</p>
        ) : (
          <div className="space-y-6">
            {/* Arabic Videos */}
            {arabicVideos.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm ml-2">
                    {t("arabic")}
                  </span>
                  {t("arabicTitle")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {arabicVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      isInstructor={isInstructor}
                      onEdit={() => onEditVideo(video)}
                      onDelete={() => onDeleteVideo(video.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* English Videos */}
            {englishVideos.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm ml-2">
                    {t("english")}
                  </span>
                  {t("englishTitle")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {englishVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      isInstructor={isInstructor}
                      onEdit={() => onEditVideo(video)}
                      onDelete={() => onDeleteVideo(video.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
