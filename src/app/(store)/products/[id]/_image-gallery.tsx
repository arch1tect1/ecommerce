"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface GalleryImage {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export function ImageGallery({
  images,
  productName,
}: {
  images: GalleryImage[];
  productName: string;
}) {
  const [active, setActive] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="relative aspect-square rounded-lg border bg-gray-50 overflow-hidden">
        <Image
          src={images[active]!.url}
          alt={`${productName} — image ${active + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-contain p-4"
          priority
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={cn(
                "relative w-16 h-16 rounded border shrink-0 overflow-hidden bg-gray-50",
                "focus:outline-none focus:ring-2 focus:ring-primary transition-all",
                i === active
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-gray-400"
              )}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img.url}
                alt=""
                fill
                sizes="64px"
                className="object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
