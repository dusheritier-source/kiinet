import { redirect } from "next/navigation";

export default function PostRedirect({ params }: { params: { postId: string } }) {
  redirect(`/feed?post=${encodeURIComponent(params.postId)}`);
}
