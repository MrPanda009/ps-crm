import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/src/types/database.types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

type CreateAuthorityPayload = {
  full_name?: string
  email?: string
  password?: string
  phone?: string | null
  city?: string | null
  department?: string
}

function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")
  if (!header || !header.startsWith("Bearer ")) return null
  return header.slice(7)
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdminClient()
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server misconfiguration: missing Supabase service role key" }, { status: 500 })
  }

  const token = getBearerToken(req)
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Invalid admin session" }, { status: 401 })
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle()

  if (callerProfileError || callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as CreateAuthorityPayload | null
  const fullName = body?.full_name?.trim() ?? ""
  const email = body?.email?.trim().toLowerCase() ?? ""
  const password = body?.password ?? ""
  const phone = body?.phone?.trim() || null
  const city = body?.city?.trim() || null
  const department = body?.department?.trim() ?? ""

  if (!fullName || !email || !department || !password) {
    return NextResponse.json({ error: "Name, email, password and department are required" }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 })
  }

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: "authority",
      department,
    },
  })

  if (createUserError || !createdUser.user) {
    return NextResponse.json({ error: createUserError?.message || "Failed to create auth user" }, { status: 400 })
  }

  const userId = createdUser.user.id

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      phone,
      city,
      department,
      role: "authority",
      is_blocked: false,
    },
    { onConflict: "id" },
  )

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: profileError.message || "Failed to create authority profile" }, { status: 500 })
  }

  return NextResponse.json(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "authority",
      department,
    },
    { status: 201 },
  )
}
