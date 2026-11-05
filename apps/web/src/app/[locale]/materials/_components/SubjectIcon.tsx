"use client";

import {
  Atom,
  BarChart3,
  BookOpen,
  Briefcase,
  Calculator,
  ClipboardList,
  Code2,
  Cpu,
  Languages,
  LayoutGrid,
  Lightbulb,
  Moon,
  Network,
  Pencil,
  Scale,
  Shapes,
  Terminal,
  Users,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** manifest `icon` keys → lucide icons (unknown keys fall back to BookOpen). */
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  network: Network,
  grid: LayoutGrid,
  code: Code2,
  chart: BarChart3,
  clipboard: ClipboardList,
  wave: Waves,
  "book-open": BookOpen,
  calculator: Calculator,
  pencil: Pencil,
  zap: Zap,
  terminal: Terminal,
  lightbulb: Lightbulb,
  moon: Moon,
  scale: Scale,
  geometry: Shapes,
  users: Users,
  atom: Atom,
  languages: Languages,
  cpu: Cpu,
};

export function SubjectIcon({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? BookOpen;
  return <Icon className={className} aria-hidden />;
}
