
import { Star } from "lucide-react";
import { StarDisplay } from "./StarRating";

interface ReviewStatsProps {
  stats: {
    average: number;
    total: number;
    distribution: Array<{
      rating: number;
      percentage: number;
    }>;
  };
}

export function ReviewStats({ stats }: ReviewStatsProps) {
  return (
    <div className="modern-card p-6 mb-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-800 rounded-3xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        {/* Average Rating */}
        <div className="text-center md:border-l border-slate-100 dark:border-slate-800">
          <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
            {stats.average}
          </div>
          <div className="flex justify-center mb-2">
            <StarDisplay
              rating={Math.round(stats.average)}
              size="w-5 h-5"
            />
          </div>
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
            بناءً على {stats.total} تقييم
          </div>
        </div>

        {/* Distribution Bars */}
        <div className="md:col-span-2 space-y-2">
          {stats.distribution.map((data) => (
            <div key={data.rating} className="flex items-center gap-4">
              <div className="flex items-center gap-1 w-12">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {data.rating}
                </span>
                <Star className="w-3 h-3 fill-slate-400 text-slate-400" />
              </div>
              <div className="flex-grow h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-orange rounded-full transition-[width] duration-1000"
                  style={{ width: `${data.percentage}%` }}
                />
              </div>
              <div className="w-12 text-left">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {data.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
