import { serve } from "inngest/next";
import { inngest, pollJobsFn } from "@/lib/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [pollJobsFn],
});
