import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Verify calling user is admin
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || adminProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Unauthorized. Admin role required." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { suggestionId, action, note = "" } = await req.json();

    if (!suggestionId || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid payload parameters" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch suggestion
    const { data: suggestion, error: suggestionFetchErr } = await supabaseAdmin
      .from("dictionary_suggestions")
      .select("*")
      .eq("id", suggestionId)
      .single();

    if (suggestionFetchErr || !suggestion) {
      return new Response(JSON.stringify({ error: "Suggestion not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 444,
      });
    }

    const statusValue = action === "approve" ? "approved" : "rejected";

    // 1. Update suggestion status
    const { error: sugUpdateErr } = await supabaseAdmin
      .from("dictionary_suggestions")
      .update({ status: statusValue, note })
      .eq("id", suggestionId);

    if (sugUpdateErr) throw sugUpdateErr;

    // 2. If approved, apply edits transactionally to dictionary
    if (action === "approve") {
      const field = suggestion.field_name;
      const value = suggestion.suggested_value;
      
      const { error: wordUpdateErr } = await supabaseAdmin
        .from("dictionary")
        .update({
          [field]: value
        })
        .eq("id", suggestion.word_id);

      if (wordUpdateErr) throw wordUpdateErr;

      // 3. Mark dataset stale (BR-SYNC-05): approval only signals that a
      // manual `scripts/export_dictionary_full.py` run is due. The real
      // checksum/version bump happens there, against the actual exported
      // content — not fabricated here.
      const { data: metaList } = await supabaseAdmin
        .from("dictionary_meta")
        .select("*")
        .limit(1);

      const currentMeta = metaList?.[0];

      if (currentMeta) {
        await supabaseAdmin
          .from("dictionary_meta")
          .update({ needs_reexport: true })
          .eq("id", currentMeta.id);
      } else {
        await supabaseAdmin
          .from("dictionary_meta")
          .insert({
            version: 1,
            checksum: "pending-first-export",
            row_count: 0,
            needs_reexport: true
          });
      }
    }

    // 4. Log the action
    const { error: logErr } = await supabaseAdmin
      .from("admin_decision_log")
      .insert({
        admin_id: user.id,
        action_type: action === "approve" ? "approve_suggestion" : "reject_suggestion",
        target_id: suggestionId,
        note,
      });

    if (logErr) console.error("Failed to write to admin decision log:", logErr);

    return new Response(JSON.stringify({ success: true, status: statusValue }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
