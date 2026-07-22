import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export function bucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "pdfs";
}

export async function ensureBucket(): Promise<void> {
  const sb = supabaseAdmin();
  const bucket = bucketName();
  const { data } = await sb.storage.getBucket(bucket);
  if (!data) {
    const { error } = await sb.storage.createBucket(bucket, { public: false });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
}

export async function uploadPdf(path: string, bytes: Buffer): Promise<void> {
  const sb = supabaseAdmin();
  const { error } = await sb.storage.from(bucketName()).upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) throw new Error(`PDF upload failed: ${error.message}`);
}

export async function downloadPdf(path: string): Promise<Buffer> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(bucketName()).download(path);
  if (error || !data) throw new Error(`PDF download failed: ${error?.message ?? "not found"}`);
  return Buffer.from(await data.arrayBuffer());
}
