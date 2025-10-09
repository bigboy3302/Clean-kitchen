export type Exercise = {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  imageUrl: string | null;
  imageThumbnailUrl: string | null;
  descriptionHtml: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipmentList: string[];
};
