import type { Application, Job } from "@prisma/client";

export type AppWithJob = Application & {
  job: Job;
  resumeVersion: { id: string; version: number; kind: string } | null;
  coverVersion: { id: string; version: number; kind: string } | null;
};
