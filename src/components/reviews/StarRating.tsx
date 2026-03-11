import { Star } from "lucide-react";

interface StarDisplayProps {
  rating: number;
  size?: string;
}

export function StarDisplay({ rating, size = "w-4 h-4" }: StarDisplayProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${
            star <= rating
              ? "fill-brand-orange text-brand-orange"
              : "text-slate-200 dark:text-slate-800"
          }`}
        />
      ))}
    </div>
  );
}

interface StarRatingInputProps {
  rating: number;
  setRating: (r: number) => void;
}

export function StarRatingInput({ rating, setRating }: StarRatingInputProps) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setRating(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 ${
              star <= rating
                ? "fill-brand-orange text-brand-orange"
                : "text-slate-300 dark:text-slate-700"
            }`}
          />
        </button>
      ))}
      <span className="mr-3 text-sm font-bold text-slate-600 dark:text-slate-400">
        {rating} من 5
      </span>
    </div>
  );
}
