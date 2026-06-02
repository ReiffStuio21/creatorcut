import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser, listProjects } from "@/lib/projects/server";
import { signOut } from "@/lib/auth/actions";
import { formatDuration } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const projects = await listProjects();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-lg font-semibold tracking-tight">
            CreatorCut
          </Link>
          <p className="text-sm text-foreground/50">Your projects</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-full accent-gradient px-4 py-2 text-sm font-medium text-white glow-accent"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New video
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-foreground/15 p-12 text-center text-sm text-foreground/50">
          No projects yet. Start a{" "}
          <Link href="/editor" className="font-medium text-foreground underline">
            new video
          </Link>{" "}
          and hit Save.
        </div>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/editor?project=${p.id}`}
                className="flex flex-col gap-1 rounded-xl border border-foreground/10 p-4 hover:border-foreground/30"
              >
                <span className="truncate font-medium">{p.title}</span>
                <span className="text-xs text-foreground/50">
                  {p.video_meta?.duration
                    ? `${formatDuration(p.video_meta.duration)} · `
                    : ""}
                  updated {new Date(p.updated_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
