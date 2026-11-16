import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Comments } from "@/components/posts/Comments";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { PostCard } from "@/components/posts/PostCard";
import { getMyProfile } from "@/lib/auth";
import { getComments, getPost } from "@/lib/posts";

export const metadata = { title: "Пост" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMyProfile();
  if (!me) redirect("/onboarding");
  const post = await getPost(id, me.id);
  if (!post) notFound();
  const comments = await getComments(post.id);
  const isAuthor = post.author_id === me.id;

  return (
    <>
      <PageHeader
        title="Пост"
        back={post.author ? `/u/${post.author.username}` : "/"}
        right={isAuthor ? <DeletePostButton postId={post.id} /> : undefined}
      />
      <PostCard post={post} full />
      <Comments
        postId={post.id}
        comments={comments}
        myId={me.id}
        myUsername={me.username}
        myAvatar={me.avatar_url}
        isPostAuthor={isAuthor}
      />
    </>
  );
}
