import React from 'react';
import {
  Award,
  BarChart3,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardCopy,
  ClipboardList,
  Clapperboard,
  CloudUpload,
  Download,
  FileImage,
  FileText,
  Filter,
  Home,
  Hourglass,
  Image as ImageIcon,
  Images,
  Info,
  Lightbulb,
  ListChecks,
  MapPin,
  NotepadText,
  Paperclip,
  PenLine,
  PenSquare,
  RefreshCcw,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Tag,
  Target,
  Timer,
  TrafficCone,
  Trash2,
  Trophy,
  Wand2,
  Zap,
  X,
} from 'lucide-react';
import type { AppIconName } from '../types';

const ICON_MAP: Record<AppIconName, React.ComponentType<any>> = {
  analytics: BarChart3,
  article: PenSquare,
  award: Award,
  bolt: Zap,
  bot: Bot,
  camera: Camera,
  check: CheckCircle2,
  clipboard: ClipboardList,
  clipboardCopy: ClipboardCopy,
  close: X,
  cloudUpload: CloudUpload,
  document: FileText,
  download: Download,
  gallery: Images,
  home: Home,
  hourglass: Hourglass,
  idea: Lightbulb,
  image: ImageIcon,
  info: Info,
  list: ListChecks,
  mapPin: MapPin,
  notepad: NotepadText,
  paperclip: Paperclip,
  pen: PenLine,
  refresh: RefreshCcw,
  rocket: Rocket,
  search: Search,
  shield: Shield,
  sparkles: Sparkles,
  tag: Tag,
  target: Target,
  timer: Timer,
  traffic: TrafficCone,
  trash: Trash2,
  trophy: Trophy,
  video: Clapperboard,
  wand: Wand2,
  fileImage: FileImage,
  filter: Filter,
};

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function AppIcon({ name, size = 16, className, strokeWidth = 1.6 }: AppIconProps) {
  const IconComponent = ICON_MAP[name];
  if (!IconComponent) {
    return null;
  }

  return (
    <IconComponent
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden="true"
    />
  );
}

const EMOJI_ICON_MAP: Record<string, AppIconName> = {
  '📝': 'document',
  '🏆': 'trophy',
  '⚡': 'bolt',
  '🏡': 'home',
  '🛡️': 'shield',
  '🎯': 'target',
  '📍': 'mapPin',
  '📎': 'paperclip',
  '🖼️': 'image',
  '📄': 'document',
  '📋': 'clipboard',
  '📸': 'camera',
  '📝 ': 'document',
  '✍️': 'pen',
  '🎬': 'video',
  '📊': 'analytics',
  '🚦': 'traffic',
  '🔍': 'search',
  '🤖': 'bot',
  '📥': 'download',
  '⬇️': 'download',
  '☁️': 'cloudUpload',
  '⏳': 'hourglass',
  '⏱️': 'timer',
  '✨': 'sparkles',
  '🗑️': 'trash',
  '💡': 'idea',
  '🚀': 'rocket',
  '📈': 'analytics',
  '🔄': 'refresh',
  '🎯 ': 'target',
  '🖼': 'image',
  '📝️': 'document',
  '🛠️': 'wand',
};

export function isAppIconName(value: unknown): value is AppIconName {
  return typeof value === 'string' && value in ICON_MAP;
}

export function resolveIconName(value?: string | null): AppIconName {
  if (!value) {
    return 'document';
  }

  if (isAppIconName(value)) {
    return value;
  }

  return EMOJI_ICON_MAP[value] || 'document';
}
