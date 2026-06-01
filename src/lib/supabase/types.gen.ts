/**
 * Hand-written to match supabase/migrations/0001_init.sql. Regenerate from the
 * real project when convenient:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.gen.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// NOTE: these must be `type` aliases, not `interface` — interfaces lack the
// implicit index signature supabase-js needs to accept the schema (otherwise
// query results infer as `never`).
export type ProjectVideoMeta = {
  fileName?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  video_path: string | null;
  video_meta: ProjectVideoMeta;
  edl: Json | null;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Database = {
  // Lets supabase-js infer result types correctly (matches generated output).
  __InternalSupabase: { PostgrestVersion: "12.2.3" };
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      projects: {
        Row: ProjectRow;
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          video_path?: string | null;
          video_meta?: ProjectVideoMeta;
          edl?: Json | null;
          thumbnail?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ProjectRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
