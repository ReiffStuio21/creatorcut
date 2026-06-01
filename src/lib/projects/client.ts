import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EDL } from "@/lib/edl/types";
import type { ProjectVideoMeta, ProjectRow } from "@/lib/supabase/types.gen";

export interface SaveProjectInput {
  projectId?: string;
  title: string;
  videoFile: File;
  videoMeta: ProjectVideoMeta;
  edl: EDL;
}

/**
 * Save the current edit: upload the source video to the private `videos` bucket
 * under the user's folder, then upsert the project row (EDL + look + captions
 * are all inside the EDL JSON). Returns the project id. (v1 persists the video +
 * EDL; music/image overlays are a follow-on.)
 */
export async function saveProject(input: SaveProjectInput): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const id = input.projectId ?? crypto.randomUUID();
  const ext = input.videoFile.name.split(".").pop() || "mp4";
  const path = `${user.id}/${id}/source.${ext}`;

  const upload = await supabase.storage
    .from("videos")
    .upload(path, input.videoFile, { upsert: true, contentType: input.videoFile.type });
  if (upload.error) throw upload.error;

  const { error } = await supabase.from("projects").upsert({
    id,
    user_id: user.id,
    title: input.title,
    video_path: path,
    video_meta: input.videoMeta,
    edl: input.edl as unknown as ProjectRow["edl"],
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return id;
}

export interface LoadedProject {
  file: File;
  meta: ProjectVideoMeta;
  edl: EDL;
}

/** Fetch a project row + its source video (downloaded from Storage). */
export async function loadProject(id: string): Promise<LoadedProject | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!data || !data.video_path || !data.edl) return null;

  const dl = await supabase.storage.from("videos").download(data.video_path);
  if (dl.error || !dl.data) return null;

  const file = new File([dl.data], data.video_meta?.fileName ?? "video.mp4", {
    type: dl.data.type || "video/mp4",
  });
  return { file, meta: data.video_meta ?? {}, edl: data.edl as unknown as EDL };
}
