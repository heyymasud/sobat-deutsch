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

    // Verify calling user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Verify user is an Admin in profiles
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

    const { applicationId, action, note = "" } = await req.json();

    if (!applicationId || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid request payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Fetch target application
    const { data: appData, error: appFetchErr } = await supabaseAdmin
      .from("teacher_applications")
      .select("user_id")
      .eq("id", applicationId)
      .single();

    if (appFetchErr || !appData) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 444,
      });
    }

    const statusValue = action === "approve" ? "approved" : "rejected";

    // Perform database updates
    const { error: appUpdateErr } = await supabaseAdmin
      .from("teacher_applications")
      .update({ status: statusValue, note })
      .eq("id", applicationId);

    if (appUpdateErr) throw appUpdateErr;

    if (action === "approve") {
      const { error: roleUpdateErr } = await supabaseAdmin
        .from("profiles")
        .update({ role: "teacher" })
        .eq("id", appData.user_id);

      if (roleUpdateErr) throw roleUpdateErr;
    }

    // Log the decision
    const { error: logErr } = await supabaseAdmin
      .from("admin_decision_log")
      .insert({
        admin_id: user.id,
        action_type: action === "approve" ? "approve_teacher" : "reject_teacher",
        target_id: applicationId,
        note,
      });

    if (logErr) console.error("Failed to log admin decision:", logErr);

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
