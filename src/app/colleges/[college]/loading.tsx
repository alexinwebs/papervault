import { BrowseSkeleton } from "@/components/Skeletons";

/**
 * Loading boundary for the college page itself. Without it, a link from a
 * deeper page (program, branch, semester) up to the college page had no
 * boundary to commit to, and in production builds the click often did
 * nothing at all. With it, the skeleton shows at once and the page streams in.
 */
export default function Loading() {
  return <BrowseSkeleton />;
}
