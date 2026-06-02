import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EDL } from "@/lib/edl/types";
import type {
  ProjectMedia,
  ProjectVideoMeta,
  ProjectRow,
} from "@/lib/supabase/types.gen";

type Supabase = ReturnType<typeof createSupabaseBrowserClient>;

export interface SaveMusic {
  url: string; // object URL
  fileName: string;
  volume: number;
}
export interface SaveImage {
  url: string; // object URL
  fileName: string;
  x: number;
  y: number;
}

export interface SaveProjectInput {
  projectId?: string;
  title: string;
  videoFile: File;
  videoMeta: ProjectVideoMeta;
  edl: EDL;
  music?: SaveMusic;
  images: SaveImage[];
}

/** Upload the bytes behind an object URL to Storage at `path`. */
async function uploadFromUrl(supabase: Supabase, url: string, path: string): Promise<void> {
  const blob = await (await fetch(url)).blob();
  const up = await supabase.storage
    .from("videos")
    .upload(path, blob, { upsert: true, contentType: blob.type || undefined });
  if (up.error) throw up.error;
}

/**
 * Save the current edit: upload the source video (and any music/image overlays)
 * to the private `videos` bucket under the user's folder, then upsert the
 * project row. The EDL JSON holds the cut/look/captions; `media` holds the
 * uploaded overlay paths. Returns the project id.
 */
export async function saveProject(input: SaveProjectInput): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const id = input.projectId ?? crypto.randomUUID();
  const base = `${user.id}/${id}`;
  const ext = input.videoFile.name.split(".").pop() || "mp4";
  const videoPath = `${base}/source.${ext}`;

  await uploadFromUrl(supabase, URL.createObjectURL(input.videoFile), videoPath);

  const media: ProjectMedia = {};
  if (input.music) {
    const path = `${base}/music`;
    await uploadFromUrl(supabase, input.music.url, path);
    media.music = { path, fileName: input.music.fileName, volume: input.music.volume };
  }
  if (input.images.length > 0) {
    media.images = [];
    for (let k = 0; k < input.images.length; k++) {
      const im = input.images[k];
      const path = `${base}/img-${k}`;
      await uploadFromUrl(supabase, im.url, path);
      media.images.push({ path, fileName: im.fileName, x: im.x, y: im.y });
    }
  }

  const { error } = await supabase.from("projects").upsert({
    id,
    user_id: user.id,
    title: input.title,
    video_path: videoPath,
    video_meta: input.videoMeta,
    edl: input.edl as unknown as ProjectRow["edl"],
    media,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return id;
}

export interface LoadedProject {
  file: File;
  meta: ProjectVideoMeta;
  edl: EDL;
  music?: { file: File; fileName: string; volume: number };
  images: { file: File; fileName: string; x: number; y: number }[];
}

/** Fetch a project row + its source video and overlays (downloaded from Storage). */
export async function loadProject(id: string): Promise<LoadedProject | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!data || !data.video_path || !data.edl) return null;

  const dl = await supabase.storage.from("videos").download(data.video_path);
  if (dl.error || !dl.data) return null;
  const file = new File([dl.data], data.video_meta?.fileName ?? "video.mp4", {
    type: dl.data.type || "video/mp4",
  });

  const media = (data.media ?? {}) as ProjectMedia;
  let music: LoadedProject["music"];
  if (media.music) {
    const m = await supabase.storage.from("videos").download(media.music.path);
    if (!m.error && m.data) {
      music = {
        file: new File([m.data], media.music.fileName, { type: m.data.type }),
        fileName: media.music.fileName,
        volume: media.music.volume,
      };
    }
  }
  const images: LoadedProject["images"] = [];
  for (const im of media.images ?? []) {
    const d = await supabase.storage.from("videos").download(im.path);
    if (!d.error && d.data) {
      images.push({
        file: new File([d.data], im.fileName, { type: d.data.type }),
        fileName: im.fileName,
        x: im.x,
        y: im.y,
      });
    }
  }

  return { file, meta: data.video_meta ?? {}, edl: data.edl as unknown as EDL, music, images };
}
