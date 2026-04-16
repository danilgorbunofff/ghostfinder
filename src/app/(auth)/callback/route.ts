import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureOrganization } from "@/lib/supabase/ensure-org";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure org exists (safety net if handle_new_user trigger didn't fire)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await ensureOrganization(
            user.id,
            user.email ?? undefined,
            user.user_metadata?.full_name ?? undefined
          );
        } catch (e) {
          console.error('Failed to ensure organization on callback:', e);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
