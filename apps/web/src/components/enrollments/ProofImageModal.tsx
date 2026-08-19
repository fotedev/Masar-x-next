
import Image from "next/image";
import { XCircle } from "lucide-react";
import { useEffect, type MouseEvent } from "react";

interface ProofImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ProofImageModal({ imageUrl, onClose }: ProofImageModalProps) {
  useEffect(() => {
    if (!imageUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-w-4xl w-full h-[90vh] relative"
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <Image
          src={imageUrl}
          alt="إثبات الدفع"
          fill
          sizes="(max-width: 768px) 100vw, 1024px"
          className="object-contain rounded-lg shadow-2xl"
          unoptimized
        />
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label="إغلاق"
          type="button"
        >
          <XCircle className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
