import { serve } from "inngest/next";

import {
  dispatchOutbox,
  inngest,
  processAiAnalysis,
  processContentGap,
  processResearch,
  processSerpAnalysis,
} from "@/server/jobs";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processResearch, processAiAnalysis, processSerpAnalysis, processContentGap, dispatchOutbox],
});
