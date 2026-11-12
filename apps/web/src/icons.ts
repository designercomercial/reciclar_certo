/**
 * Ícones Lucide (traço de 2 px, definido no CSS por --icon-stroke).
 * Importados um a um: só entram no bundle os que a página usa.
 */
import {
  Apple,
  Ban,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Cylinder,
  Droplets,
  Gamepad2,
  Hand,
  ImageUp,
  Info,
  Lightbulb,
  MapPin,
  Milk,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Trophy,
  WifiOff,
  Wine,
  type IconNode,
} from "lucide";
import type { NomeIcone as NomeIconeFormat } from "@ecoponto/format";

export type NomeIcone =
  | NomeIconeFormat
  | "book-open"
  | "camera"
  | "chevron-down"
  | "chevron-right"
  | "circle-check"
  | "circle-question-mark"
  | "circle-x"
  | "gamepad-2"
  | "hand"
  | "image-up"
  | "info"
  | "lightbulb"
  | "map-pin"
  | "refresh-cw"
  | "search"
  | "shield-check"
  | "sparkles"
  | "triangle-alert"
  | "trophy"
  | "wifi-off";

const ICONES: Record<NomeIcone, IconNode> = {
  apple: Apple,
  ban: Ban,
  "book-open": BookOpen,
  camera: Camera,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "circle-check": CircleCheck,
  "circle-question-mark": CircleQuestionMark,
  "circle-x": CircleX,
  cylinder: Cylinder,
  droplets: Droplets,
  "gamepad-2": Gamepad2,
  hand: Hand,
  "image-up": ImageUp,
  info: Info,
  lightbulb: Lightbulb,
  "map-pin": MapPin,
  milk: Milk,
  newspaper: Newspaper,
  "refresh-cw": RefreshCw,
  search: Search,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  "trash-2": Trash2,
  "triangle-alert": TriangleAlert,
  trophy: Trophy,
  "wifi-off": WifiOff,
  wine: Wine,
};

const SVG = "http://www.w3.org/2000/svg";

/** Ícone decorativo (aria-hidden). O significado vai sempre em texto ao lado. */
export function icone(nome: NomeIcone, classe = ""): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("class", `icon ${classe}`.trim());
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.icone = nome;
  for (const [tag, attrs] of ICONES[nome]) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && k !== "key") el.setAttribute(k, String(v));
    }
    svg.append(el);
  }
  return svg;
}
