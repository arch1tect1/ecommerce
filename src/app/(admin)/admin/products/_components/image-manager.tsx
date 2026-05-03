"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2, Star, Trash2, Upload, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  uploadProductImageAction,
  deleteProductImageAction,
  setPrimaryImageAction,
  reorderProductImagesAction,
} from "@/lib/actions/admin-products";

export interface ProductImage {
  id: string;
  url: string;
  isPrimary: boolean;
  order: number;
}

export function ImageManager({
  productId,
  images: initialImages,
}: {
  productId: string;
  images: ProductImage[];
}) {
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const next: ProductImage[] = [...images];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadProductImageAction(productId, fd);
        if (!res.ok) {
          setError(res.error);
          break;
        }
        next.push({
          id: res.imageId,
          url: res.url,
          isPrimary: next.length === 0,
          order: next.length,
        });
      }
      setImages(next);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDelete(imageId: string) {
    if (!confirm("Delete this image?")) return;
    startTransition(async () => {
      const res = await deleteProductImageAction(imageId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const remaining = images.filter((i) => i.id !== imageId);
      const wasPrimary = images.find((i) => i.id === imageId)?.isPrimary;
      if (wasPrimary && remaining[0]) remaining[0].isPrimary = true;
      setImages(remaining);
    });
  }

  function handleSetPrimary(imageId: string) {
    startTransition(async () => {
      const res = await setPrimaryImageAction(imageId);
      if (!res.ok) { setError(res.error); return; }
      setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === imageId })));
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = images.findIndex((i) => i.id === active.id);
    const newIdx = images.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(images, oldIdx, newIdx).map((img, idx) => ({ ...img, order: idx }));
    setImages(reordered);
    startTransition(async () => {
      const res = await reorderProductImagesAction(productId, reordered.map((i) => i.id));
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Dropzone */}
      <label
        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 hover:bg-muted/50 transition-colors p-6 cursor-pointer"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-sm text-muted-foreground">
          {uploading ? "Uploading…" : "Click or drag images here (JPEG/PNG/WebP/GIF, max 5 MB)"}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={uploading}
        />
      </label>

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Drag tiles to reorder. The image marked with a star is the primary image.
        </p>
      )}

      {/* Image grid */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img) => (
              <SortableTile
                key={img.id}
                image={img}
                onDelete={() => handleDelete(img.id)}
                onSetPrimary={() => handleSetPrimary(img.id)}
                disabled={pending || uploading}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableTile({
  image,
  onDelete,
  onSetPrimary,
  disabled,
}: {
  image: ProductImage;
  onDelete: () => void;
  onSetPrimary: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-lg border bg-white overflow-hidden aspect-square ${
        image.isPrimary ? "ring-2 ring-yellow-400" : ""
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="absolute top-1 left-1 z-10 bg-black/50 hover:bg-black/70 text-white rounded p-1 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Primary badge */}
      {image.isPrimary && (
        <div className="absolute top-1 right-1 z-10 bg-yellow-400 text-yellow-900 rounded p-1 shadow">
          <Star className="h-3 w-3 fill-current" />
        </div>
      )}

      {/* Image */}
      <Image
        src={image.url}
        alt=""
        fill
        sizes="200px"
        className="object-contain p-2"
      />

      {/* Hover actions */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
        {!image.isPrimary && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onSetPrimary}
            disabled={disabled}
            className="h-7 px-2 text-xs"
            title="Make primary"
          >
            <Star className="h-3 w-3 mr-1" />
            Primary
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onDelete}
          disabled={disabled}
          className="h-7 px-2 text-xs"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
