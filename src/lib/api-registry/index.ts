/**
 * API Registry
 *
 * Centralized registry for all API endpoint documentation.
 * Add a new section file under ./sections/ and import it here.
 *
 * Consumed by:
 * - ApiReferenceModal — renders the interactive API reference UI
 */

export type { HttpMethod, AuthType, EndpointParam, EndpointDef, SectionDef } from './types'

import { kitsSection } from './sections/kits'
import { serversSection } from './sections/servers'
import { identifiersSection } from './sections/identifiers'
import { analyticsSection } from './sections/analytics'
import { lootmanagerSection } from './sections/lootmanager'
import { basesSection } from './sections/bases'
import { tokensSection } from './sections/tokens'
import { clansSection } from './sections/clans'
import { moderationSection } from './sections/moderation'
import { announcementsSection } from './sections/announcements'
import { shopSection } from './sections/shop'
import { statsSection } from './sections/stats'
import { giveawaysSection } from './sections/giveaways'
import { feedbackSection } from './sections/feedback'
import { telemetrySection } from './sections/telemetry'
import { redirectsSection } from './sections/redirects'
import { publicSection } from './sections/public'

import type { SectionDef } from './types'

/**
 * The full API registry — ordered list of all documented sections.
 * To add a new section: create a file in ./sections/, export a SectionDef, and add it here.
 */
export const REGISTRY: SectionDef[] = [
  kitsSection,
  serversSection,
  identifiersSection,
  analyticsSection,
  lootmanagerSection,
  basesSection,
  tokensSection,
  clansSection,
  moderationSection,
  announcementsSection,
  shopSection,
  statsSection,
  giveawaysSection,
  feedbackSection,
  telemetrySection,
  redirectsSection,
  publicSection,
]
