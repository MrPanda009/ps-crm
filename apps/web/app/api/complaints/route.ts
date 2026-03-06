// app/api/complaints/route.ts — Insert a complaint into Supabase

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use a server-side Supabase client
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

interface ComplaintPayload {
  citizen_id: string;
  category_id: number;
  title: string;
  description: string;
  severity: "L1" | "L2" | "L3" | "L4";
  latitude: number;
  longitude: number;
  ward_name?: string;
  pincode?: string;
  address_text?: string;
  assigned_department?: string;
  city?: string;
}

/**
 * POST /api/complaints
 * Creates a new complaint in Supabase.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ComplaintPayload | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { citizen_id, category_id, title, description, severity, latitude, longitude, ward_name, pincode, address_text, assigned_department, city } = body;

  // Validate required fields
  if (!citizen_id || !category_id || !title || !description || latitude == null || longitude == null) {
    return NextResponse.json(
      { error: "Missing required fields: citizen_id, category_id, title, description, latitude, longitude" },
      { status: 400 },
    );
  }

  // Build PostGIS WKT POINT string
  const locationWKT = `SRID=4326;POINT(${longitude} ${latitude})`;

  const { data, error } = await supabase
    .from("complaints")
    .insert({
      citizen_id,
      category_id,
      title,
      description,
      severity: severity ?? "L2",
      status: "submitted",
      location: locationWKT,
      ward_name: ward_name ?? null,
      pincode: pincode ?? null,
      address_text: address_text ?? null,
      assigned_department: assigned_department ?? null,
      city: city ?? "Delhi",
    })
    .select("id, ticket_id, title, status, created_at")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, complaint: data }, { status: 201 });
}
