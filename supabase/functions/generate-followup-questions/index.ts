import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const groqApiKey = Deno.env.get("GROQ_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lastAiMessage, userQuestion } = await req.json();

    if (!lastAiMessage) {
      return new Response(
        JSON.stringify({ error: "lastAiMessage is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncatedAnswer = lastAiMessage.substring(0, 1500);
    const truncatedQuestion = (userQuestion || "").substring(0, 300);

    const prompt = truncatedQuestion
      ? `The user asked: "${truncatedQuestion}"\n\nThe AI answered: "${truncatedAnswer}"\n\nGenerate exactly 3 short follow-up questions the user might want to ask next, based on this conversation. Each question should be concise (under 10 words), naturally flowing from the topic discussed. Return ONLY a JSON array of 3 strings, nothing else. Example: ["Question one?", "Question two?", "Question three?"]`
      : `The AI just answered: "${truncatedAnswer}"\n\nGenerate exactly 3 short follow-up questions a curious user might ask next about this topic. Each question should be concise (under 10 words). Return ONLY a JSON array of 3 strings, nothing else. Example: ["Question one?", "Question two?", "Question three?"]`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates follow-up questions. Always respond with ONLY a valid JSON array of exactly 3 question strings. No explanation, no markdown, just the JSON array.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content.trim();

    let questions: string[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      if (Array.isArray(parsed)) {
        questions = parsed.slice(0, 3).map((q: unknown) => String(q));
      }
    } catch {
      const matches = rawContent.match(/"([^"]+\?)"/g);
      if (matches) {
        questions = matches.slice(0, 3).map((m: string) => m.replace(/"/g, ""));
      }
    }

    if (questions.length === 0) {
      questions = ["Tell me more about this.", "What are the key takeaways?", "Can you give an example?"];
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-followup-questions:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
