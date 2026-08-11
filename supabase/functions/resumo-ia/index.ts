// Supabase Edge Function: resumo-ia
// Recebe uma lista de inspeções e devolve um resumo em português gerado por IA
// (Google Gemini — usa o nível gratuito do Google AI Studio).
// A chave da API fica guardada como "secret" no Supabase — nunca no navegador.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { inspecoes, periodoLabel } = await req.json();

    if (!inspecoes || !Array.isArray(inspecoes) || inspecoes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma inspeção enviada para resumir." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const linhas = inspecoes
      .slice(0, 300) // limite de segurança pra não estourar o tamanho do prompt
      .map(i => `- ${i.data} ${i.hora} | ${i.ambienteNome} | ${i.status} | ${i.observacao || "sem observação"} | inspetor: ${i.inspetorNome}`)
      .join("\n");

    const prompt = `Você é um assistente que ajuda um administrador de limpeza escolar a entender rapidamente o que aconteceu no período "${periodoLabel}".

Abaixo está a lista de inspeções de limpeza registradas (data/hora, ambiente, status, observação, inspetor):

${linhas}

Escreva um resumo executivo em português, direto e objetivo (no máximo 8 linhas), destacando:
1. Visão geral (quantas inspeções, proporção de limpo/parcial/não limpo)
2. Os 2-3 ambientes ou tipos de problema mais recorrentes
3. Uma recomendação prática para o administrador

Não use markdown, apenas texto corrido em parágrafos curtos.`;

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: "Erro ao chamar a IA: " + errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const resumo =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim() ||
      "Não foi possível gerar o resumo.";

    return new Response(JSON.stringify({ resumo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
