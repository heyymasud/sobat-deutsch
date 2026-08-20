import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const queryParam = url.searchParams.get("q");
      
      let query = queryParam || "";
      if (!query && req.body) {
        try {
          const body = await req.json();
          query = body.query || "";
        } catch {
          // ignore JSON parse error
        }
      }

      query = query.trim();
      if (!query) {
        return new Response(JSON.stringify({ data: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Initialize Supabase Client
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Input normalization for regex search (umlauts and ss/ß)
      // e.g. uben matches üben, strasse matches straße
      const regexPattern = "^" + query
        .replace(/a/gi, "[aä]")
        .replace(/o/gi, "[oö]")
        .replace(/u/gi, "[uü]")
        .replace(/ss/gi, "(ss|ß)")
        .replace(/ß/gi, "(ss|ß)");

      // Query database: Search by prefix case-insensitive regex or FTS
      // We search words table directly
      // Also match `translations` (e.g. searching the English/Indonesian word
      // "pencil" should surface "Bleistift") -- otherwise this online path
      // silently supports fewer queries than the local MiniSearch index, which
      // already indexes both `lemma` and `translations` fields.
      const { data, error } = await supabase
        .from("dictionary")
        .select("id, lemma, pos, gender, plural, translations, level, frequency_rank")
        // PostgREST or() syntax treats (),|, and , as delimiters, so values
        // containing them (our regex alternation) must be double-quoted.
        .or(`lemma.ilike."${query}%",lemma.imatch."${regexPattern}",translations.ilike."%${query}%"`)
        .order("frequency_rank", { nullsFirst: false })
        .limit(20);

      if (error) {
        throw error;
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  },
};
