import React from "react";
import Image from "next/image";
import { XCircle } from "lucide-react";

interface ProofImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ProofImageModal({ imageUrl, onClose }: ProofImageModalProps) {
  if (!imageUrl) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={imageUrl}
          alt="إثبات الدفع"
          fill
          className="object-contain rounded-lg shadow-2xl"
          unoptimized
        />
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
        >
          <XCircle className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}
