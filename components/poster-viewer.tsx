"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import Image from "next/image";

export function PosterViewer({ src, title }: { src: string; title: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label={`ดูโปสเตอร์ ${title}`}
        className="w-40 shrink-0 cursor-zoom-in self-start rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src={src}
          alt=""
          width={200}
          height={280}
          className="h-auto w-full rounded-lg object-cover"
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/80" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 outline-none">
          <Dialog.Title className="sr-only">โปสเตอร์ {title}</Dialog.Title>
          <Image
            src={src}
            alt={`โปสเตอร์ ${title}`}
            width={800}
            height={1120}
            className="h-auto max-h-[calc(100dvh-2rem)] w-auto max-w-[calc(100vw-2rem)] rounded-lg"
          />
          <Dialog.Close
            aria-label="ปิด"
            className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg bg-black/60 text-white outline-none hover:bg-black/80 focus-visible:ring-3 focus-visible:ring-white/50"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
