import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyState, PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { listInbox, unreadCount } from "@/server/services/inbox";
import { formatDate } from "@/lib/utils";
import { MarkAllReadForm, MarkReadForm } from "./forms";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function InboxPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/inbox");

  const [messages, unread] = await Promise.all([listInbox(user.id), unreadCount(user.id)]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeading
        eyebrow="Your account"
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread. Moderation decisions and replies land here even if you have email switched off.`
            : "Moderation decisions and replies land here even if you have email switched off."
        }
        aside={unread > 0 ? <MarkAllReadForm /> : undefined}
      />

      {messages.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          body="When a moderator reviews one of your papers or someone replies to your comment, you will see it here."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {messages.map((message) => {
            const isUnread = !message.readAt;
            return (
              <li key={message.id}>
                <Panel
                  className={`flex flex-col gap-2 px-4 py-3 ${isUnread ? "bg-yellow" : "bg-paper"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="pv-section-title">
                      {isUnread ? (
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ink align-middle" aria-label="Unread" />
                      ) : null}
                      {message.title}
                    </h2>
                    <time
                      dateTime={message.createdAt.toISOString()}
                      className="font-mono text-[11px] text-ink/60"
                    >
                      {formatDate(message.createdAt)}
                    </time>
                  </div>
                  <p className="font-sans text-sm text-ink/85">{message.body}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {message.href ? (
                      <Link
                        href={message.href}
                        prefetch={false}
                        className="pv-btn-secondary px-3 py-1 text-xs"
                      >
                        Open
                      </Link>
                    ) : null}
                    {isUnread ? <MarkReadForm id={message.id} /> : null}
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
