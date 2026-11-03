import { z } from "zod";

export const DEFAULT_ENTROLYTICS_HOST = "https://api.entrolytics.click";

export const entrolyticsConfigSchema = z.object({
  autoTrack: z.boolean().default(true),
  clientKey: z.string().trim().min(1),
  host: z.url().default(DEFAULT_ENTROLYTICS_HOST),
  respectDnt: z.boolean().default(false),
  trackRevenue: z.boolean().default(true),
  websiteId: z.uuid(),
});

export type ParsedEntrolyticsConfig = z.infer<typeof entrolyticsConfigSchema>;
