import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

function getAuthClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getServiceClient() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function extractBearerToken(req: NextRequest): string | null {
  const authorization = req.headers.get("authorization") ?? "";
  const bearerPrefix = "Bearer ";
  if (!authorization.startsWith(bearerPrefix)) return null;
  const token = authorization.slice(bearerPrefix.length).trim();
  return token || null;
}

export async function GET(req: NextRequest) {
  const authClient = getAuthClient();
  const serviceClient = getServiceClient();

  if (!authClient || !serviceClient) {
    return NextResponse.json(
      { error: "Server misconfiguration: missing Supabase environment variables" },
      { status: 500 },
    );
  }

  const token = extractBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
  }

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await serviceClient
    .from("leaderboard_all_time")
    .select("user_id, full_name, avatar_url, points, rank")
    .order("rank", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message || "Failed to fetch leaderboard" }, { status: 500 });
  }

  const items = (data ?? []).map((row) => ({
    user_id: row.user_id,
    full_name: row.full_name,
    avatar_url: row.avatar_url,
    points: row.points ?? 0,
    rank: row.rank ?? null,
  }));

  return NextResponse.json({ items }, { status: 200 });
}
