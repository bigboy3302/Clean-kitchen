import { z } from "zod";

const visibilityEnum = ["public", "private"] as const;

export const WorkoutSchema = z.object({
  name: z.string().min(2, "Name is required."),
  bodyPart: z.string().min(2, "Body part is required."),
  target: z.string().min(2, "Target muscle is required."),
  equipment: z.string().min(2, "Equipment is required."),
  gifUrl: z
    .string()
    .url("GIF URL must be a valid URL.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  instructions: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Instructions must contain text.")
        .max(2000, "Instruction is too long.")
    )
    .optional(),
  visibility: z.enum(visibilityEnum).default("public"),
});

export type WorkoutInput = z.infer<typeof WorkoutSchema>;
