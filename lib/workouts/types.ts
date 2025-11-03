export type WorkoutMediaType = "gif" | "mp4" | "image";

export type WorkoutContent = {
  id: string;
  title: string;
  mediaUrl: string | null;
  mediaType: WorkoutMediaType;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  description: string;
  instructionsHtml?: string | null;
  bodyPart?: string | null;
  target?: string | null;
  equipment?: string | null;
  source: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipmentList?: string[];
  externalUrl?: string | null;
};

export type WorkoutSearchFilters = {
  q?: string;
  bodyPart?: string;
  target?: string;
  equipment?: string;
};

export type WorkoutSearchResponse = {
  items: WorkoutContent[];
  meta: {
    limit: number;
    offset: number;
    nextOffset: number | null;
    filters: WorkoutSearchFilters;
    sources: string[];
    tookMs: number;
  };
};

export type SavedWorkoutVisibility = "public" | "private";

export type SavedWorkoutOwner = {
  uid: string;
  displayName?: string | null;
  username?: string | null;
  photoURL?: string | null;
};

export type SavedWorkoutRecord = {
  id: string;
  uid: string;
  visibility: SavedWorkoutVisibility;
  workout: WorkoutContent;
  owner: SavedWorkoutOwner;
  createdAt: string;
  updatedAt: string;
};

export type SaveWorkoutPayload = {
  id?: string;
  visibility: SavedWorkoutVisibility;
  workout: WorkoutContent;
};
