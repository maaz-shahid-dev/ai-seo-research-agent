import "server-only";

import { Inngest } from "inngest";

const eventKey = process.env.INNGEST_EVENT_KEY?.trim();

export const inngest = new Inngest({
  id: "seo-research-agent",
  ...(eventKey ? { eventKey } : {}),
});
