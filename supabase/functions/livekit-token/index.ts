import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://deno.land/x/jose@v5.4.1/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TOKEN_TTL_SECONDS = 60 * 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("SUPABASE_URL or SUPABASE_ANON_KEY not set");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const notebookId = body?.notebook_id ?? body?.notebookId ?? "";
    const room = body?.room ?? notebookId;

    if (!room) {
      return new Response(
        JSON.stringify({ error: "Missing room or notebook_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
    if (!livekitApiKey || !livekitApiSecret) {
      throw new Error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set");
    }

    const now = Math.floor(Date.now() / 1000);
    const metadata = JSON.stringify({
      notebookId: notebookId || room,
      userId: user.id,
    });

    const token = await new SignJWT({
      video: {
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      metadata,
      name: user.email ?? user.id,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(livekitApiKey)
      .setSubject(user.id)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + TOKEN_TTL_SECONDS)
      .sign(new TextEncoder().encode(livekitApiSecret));

    const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";

    return new Response(
      JSON.stringify({
        token,
        url: livekitUrl,
        room,
        identity: user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in livekit-token:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to create LiveKit token" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
