import { Chip, type Accent } from "./ui";

export const EXAM_ACCENT: Record<string, Accent> = {
  ST: "pink",
  PUT: "yellow",
  END_SEM: "blue",
  CT: "lavender",
  MID_SEM: "mint",
};

/** Exam colors are independent of the green verification badge. */
export function ExamTypeChip({ code }: { code: string }) {
  return <Chip accent={EXAM_ACCENT[code] ?? "cream"}>{code.replace(/_/g, "-")}</Chip>;
}
