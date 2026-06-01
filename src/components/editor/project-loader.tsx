"use client";

import { useEffect, useRef, useState } from "react";
import { loadProject } from "@/lib/projects/client";
import { useEditorStore } from "@/lib/store/editor";

/** Loads a saved project into the editor on mount (from /editor?project=<id>). */
export function ProjectLoader({ projectId }: { projectId: string }) {
  const hydrate = useEditorStore((s) => s.hydrateProject);
  const started = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadProject(projectId)
      .then((p) => {
        if (p) hydrate({ id: projectId, file: p.file, meta: p.meta, edl: p.edl });
        else setError(true);
      })
      .catch(() => setError(true));
  }, [projectId, hydrate]);

  if (error) {
    return (
      <div className="border-b border-foreground/10 bg-amber-500/10 px-4 py-2 text-xs text-amber-700">
        Could not load that project — it may not exist or you may need to log in.
      </div>
    );
  }
  return null;
}
