import { Copy, Film, Heart, MessageCircle } from "lucide-react";
import Link from "next/link";
import { mediaUrl } from "@/lib/media";
import type { Post } from "@/lib/types";

export function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <ul className="grid grid-cols-3 gap-0.5">
      {posts.map((p) => {
        const first = p.media[0];
        return (
          <li key={p.id}>
            <Link href={`/p/${p.id}`} className="group relative block aspect-square overflow-hidden bg-surface-2">
              {first.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element -- сжатые превью из Storage
                <img src={mediaUrl(first.path)} alt="" loading="lazy" className="size-full object-cover" />
              ) : (
                <video src={`${mediaUrl(first.path)}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
              )}
              <span className="absolute top-1.5 right-1.5 text-white drop-shadow">
                {first.type === "video" ? <Film className="size-4" /> : p.media.length > 1 ? <Copy className="size-4" /> : null}
              </span>
              <span className="absolute inset-0 hidden items-center justify-center gap-3 bg-black/40 text-sm font-semibold text-white group-hover:flex">
                <span className="flex items-center gap-1">
                  <Heart className="size-4 fill-white" /> {p.like_count}
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="size-4 fill-white" /> {p.comment_count}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
