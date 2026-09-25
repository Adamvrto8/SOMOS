import {
  Briefcase,
  Building2,
  Clock,
  CloudSun,
  GraduationCap,
  Hand,
  HeartPulse,
  House,
  Music,
  PersonStanding,
  Plane,
  Shirt,
  ShoppingBag,
  Smile,
  Tag,
  Trees,
  Users,
  Utensils,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

// Static map keeps the bundle small (no dynamic icon imports).
// Add an entry when a topic in topics.json uses a new icon (validate:data checks this).
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'building-2': Building2,
  clock: Clock,
  'cloud-sun': CloudSun,
  'graduation-cap': GraduationCap,
  hand: Hand,
  'heart-pulse': HeartPulse,
  house: House,
  music: Music,
  'person-standing': PersonStanding,
  plane: Plane,
  shirt: Shirt,
  'shopping-bag': ShoppingBag,
  smile: Smile,
  trees: Trees,
  users: Users,
  utensils: Utensils,
}

interface TopicIconProps extends LucideProps {
  name: string
}

export function TopicIcon({ name, ...props }: TopicIconProps) {
  const Icon = ICONS[name] ?? Tag
  return <Icon strokeWidth={1.75} aria-hidden {...props} />
}
