import { IconBulb } from "@tabler/icons-react";
import type { RoadmapStatus } from "../../types/roadmap";

export interface ColumnConfig {
  id: RoadmapStatus;
  label: string;
  sub: string;
  icon: typeof IconBulb;
  accent: string;
  glow: string;
  text: string;
  bg: string;
  glass: string;
  barColor: string; // Cor sólida para barras laterais (ex: "bg-yellow-500")
}
