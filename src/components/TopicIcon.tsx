import {
  Briefcase,
  Building2,
  Clock,
  Hand,
  House,
  Plane,
  Tag,
  Users,
  Utensils,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

// Static map keeps the bundle small (no dynamic icon imports).
// Add an entry when a topic in topics.json uses a new icon.
const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  'building-2': Building2,
  clock: Clock,
  hand: Hand,
  house: House,
  plane: Plane,
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
