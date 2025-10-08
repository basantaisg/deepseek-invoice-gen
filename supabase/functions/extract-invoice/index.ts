import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Please provide invoice text" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `You are an expert invoice data extractor. Extract structured invoice information from the provided text.

Return a JSON object with this exact structure:
{
  "invoiceNumber": "string or null",
  "vendor": {
    "name": "string (required)",
    "email": "string or null",
    "address": "string or null"
  },
  "client": {
    "name": "string (required)",
    "email": "string or null",
    "address": "string or null"
  },
  "issueDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "currency": "string (default: NPR)",
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "taxRate": number (percentage, e.g., 13 for 13%)
    }
  ],
  "shipping": number or null,
  "notes": "string or null",
  "terms": "string or null"
}

Important:
- Extract all line items with quantities, prices, and tax rates
- Infer missing data intelligently
- Currency defaults to NPR if not specified
- Dates must be in YYYY-MM-DD format
- Return valid JSON only`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extract invoice data from this text:\n\n${text}` }
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit exceeded. Please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI extraction failed");
    }

    const aiResponse = await response.json();
    const extractedContent = aiResponse.choices[0]?.message?.content;

    if (!extractedContent) {
      throw new Error("No content returned from AI");
    }

    console.log("AI extracted content:", extractedContent);

    // Parse the JSON response
    let extractedData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = extractedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : extractedContent;
      extractedData = JSON.parse(jsonString.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to parse extracted data. Please try with clearer invoice text." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate required fields
    if (!extractedData.vendor?.name || !extractedData.client?.name) {
      return new Response(
        JSON.stringify({ 
          error: "Could not extract vendor and client information. Please provide clearer invoice data." 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in extract-invoice function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to extract invoice data" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
