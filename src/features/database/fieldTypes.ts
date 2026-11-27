import {
  ArrowUpRight,
  Calendar,
  CheckSquare,
  CircleChevronDown,
  Clock,
  Hash,
  Image,
  Link,
  List,
  ListChecks,
  Sigma,
  Text,
  Timer,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { FieldType } from '@/core/model/database'
import type { DbKey } from './i18n'

/** Icon and name of each field type (header, type menu). `available`: offered when adding a field. */
export const FIELD_TYPE_INFO: Record<FieldType, { icon: LucideIcon; label: DbKey; available: boolean }> = {
  text: { icon: Text, label: 'db.type.text', available: true },
  number: { icon: Hash, label: 'db.type.number', available: true },
  select: { icon: CircleChevronDown, label: 'db.type.select', available: true },
  multiSelect: { icon: List, label: 'db.type.multiSelect', available: true },
  date: { icon: Calendar, label: 'db.type.date', available: true },
  checkbox: { icon: CheckSquare, label: 'db.type.checkbox', available: true },
  checklist: { icon: ListChecks, label: 'db.type.checklist', available: true },
  url: { icon: Link, label: 'db.type.url', available: true },
  createdTime: { icon: Clock, label: 'db.type.createdTime', available: true },
  updatedTime: { icon: Clock, label: 'db.type.updatedTime', available: true },
  media: { icon: Image, label: 'db.type.media', available: true },
  time: { icon: Timer, label: 'db.type.time', available: true },
  relation: { icon: ArrowUpRight, label: 'db.type.relation', available: false }, // M6
  rollup: { icon: Sigma, label: 'db.type.rollup', available: false }, // M6
  person: { icon: User, label: 'db.type.person', available: false }, // M9
}
