import { Inngest } from "inngest";
import { runPoll } from "@/lib/poll";

export const inngest = new Inngest({ id: "job-hub" });

// Every 4 hours at :17 (avoids top-of-hour herd).
export const pollJobsFn = inngest.createFunction(
  { id: "poll-jobs", triggers: [{ cron: "17 */4 * * *" }] },
  async () => {
    return await runPoll("inngest");
  }
);
