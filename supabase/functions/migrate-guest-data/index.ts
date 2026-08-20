import "@supabase/functions-js/edge-runtime.d.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  async fetch(req: Request) {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // withSupabase is not used directly so we can have custom authorization header validation
    try {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing authorization header" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      // Initialize Supabase Admin Client
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      
      // We import createClient dynamically
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.48.0");
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      // Verify user JWT token
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid user token" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      const body = await req.json();
      const { decks = [], srsCards = [], reviewLogs = [] } = body;

      console.log(`Migrating data for user ${user.id}: ${decks.length} decks, ${srsCards.length} cards.`);

      // 1. Migrate Decks
      // Generate mapping for local deck IDs (which are numbers in IndexedDB) to new UUIDs in Supabase
      const deckIdMap: Record<number, string> = {};
      
      for (const d of decks) {
        const { data: insertedDeck, error: deckError } = await supabaseAdmin
          .from("decks")
          .insert({
            user_id: user.id,
            name: d.name,
            created_at: new Date(d.createdAt).toISOString()
          })
          .select("id")
          .single();

        if (deckError) {
          console.error("Failed to migrate deck:", deckError);
          throw deckError;
        }

        deckIdMap[d.id] = insertedDeck.id;
      }

      // 2. Migrate Cards
      const cardIdMap: Record<number, string> = {};
      for (const c of srsCards) {
        const targetDeckUuid = deckIdMap[c.deckId];
        if (!targetDeckUuid) continue; // Skip cards that don't belong to a migrated deck

        // In Supabase schema: we reference words using word_ref (lemma) or we can save wordId or similar.
        // Wait, what does public.srs_cards have?
        // Columns: id, deck_id, user_id, word_ref, card_type, interval, ease_factor, repetitions, due_date, state, lapses, created_at, updated_at
        // Let's resolve the word_ref from the database using c.wordId
        const { data: wordEntry } = await supabaseAdmin
          .from("dictionary")
          .select("lemma")
          .eq("id", c.wordId)
          .single();

        const wordRef = wordEntry?.lemma || "unknown";

        const { data: insertedCard, error: cardError } = await supabaseAdmin
          .from("srs_cards")
          .insert({
            deck_id: targetDeckUuid,
            user_id: user.id,
            word_ref: wordRef,
            card_type: c.cardType,
            interval: c.interval,
            ease_factor: c.easeFactor,
            repetitions: c.repetitions,
            due_date: new Date(c.dueDate).toISOString().split('T')[0],
            created_at: new Date(c.createdAt).toISOString()
          })
          .select("id")
          .single();

        if (cardError) {
          console.error("Failed to migrate card:", cardError);
          throw cardError;
        }

        cardIdMap[c.id] = insertedCard.id;
      }

      // 3. Migrate Review Logs
      for (const l of reviewLogs) {
        const targetCardUuid = cardIdMap[l.cardId];
        if (!targetCardUuid) continue;

        // In Supabase review_logs schema: rating is text: 'lupa', 'sulit', 'sedang', 'mudah'
        // Map 1-4 to text
        const ratingMap: Record<number, string> = { 1: 'lupa', 2: 'sulit', 3: 'sedang', 4: 'mudah' };
        const ratingText = ratingMap[l.rating] || 'sedang';

        const { error: logError } = await supabaseAdmin
          .from("review_logs")
          .insert({
            card_id: targetCardUuid,
            user_id: user.id,
            rating: ratingText,
            reviewed_at: new Date(l.reviewedAt).toISOString(),
            interval_before: 0, // Fallback placeholder
            interval_after: l.interval
          });

        if (logError) {
          console.error("Failed to migrate log:", logError);
          // Don't throw to prevent total abort, logs are non-critical
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
  },
};
