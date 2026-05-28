import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `Tu es un assistant IA pour une application de gestion de petite entreprise. Tu parles uniquement en français.

Tu peux réaliser ces actions :
- Créer un devis (intent: "quote") — extrais le client, les prestations et les montants si mentionnés
- Préparer une publication Instagram (intent: "instagram") — génère une légende optimisée
- Enregistrer une note (intent: "note") — résume ou reformule le contenu
- Répondre à une question générale (intent: "chat")

Réponds toujours avec un JSON structuré :
{
  "intent": "quote" | "instagram" | "note" | "chat",
  "content": "ta réponse textuelle ici",
  "data": { /* données structurées extraites, optionnel */ }
}

Pour un devis, data peut contenir : { title, client_name, items: [{ description, quantity, unit_price }] }
Pour Instagram, data peut contenir : { caption, hashtags }
Sinon data est null.`;

type Intent = 'quote' | 'instagram' | 'note' | 'chat';

interface GeminiResponse {
  intent: Intent;
  content: string;
  data: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { content, company_id, audio_url } = await req.json();

    if (!content || !company_id) {
      return new Response(JSON.stringify({ error: 'content and company_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch last 10 messages for context
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const contextMessages = (history ?? []).reverse().map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const userMessage = audio_url
      ? `[Message vocal] ${content}`
      : content;

    const geminiBody = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...contextMessages,
        { role: 'user', parts: [{ text: userMessage }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    };

    const geminiRes = await fetch(
      `${GEMINI_API_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      },
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini error: ${err}`);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let parsed: GeminiResponse;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { intent: 'chat', content: rawText, data: null };
    }

    // Act on intent
    if (parsed.intent === 'quote' && parsed.data) {
      const d = parsed.data as Record<string, unknown>;
      await supabase.from('quotes').insert({
        company_id,
        number: `DEV-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        title: (d.title as string) ?? null,
        description: null,
        notes: null,
        subtotal: 0,
        tax_rate: 20,
        tax_amount: 0,
        total: 0,
        pdf_url: null,
        valid_until: null,
        client_id: null,
      });
    }

    if (parsed.intent === 'instagram' && parsed.data) {
      const d = parsed.data as Record<string, unknown>;
      await supabase.from('instagram_posts').insert({
        company_id,
        media_url: null,
        media_type: 'image',
        caption: (d.caption as string) ?? null,
        context: content,
        status: 'pending',
      });
    }

    // Save assistant message
    const { data: savedMsg, error: insertErr } = await supabase
      .from('chat_messages')
      .insert({
        company_id,
        role: 'assistant',
        content: parsed.content,
        intent: parsed.intent === 'chat' ? null : parsed.intent,
        metadata: parsed.data ?? {},
        audio_url: null,
        user_id: null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify(savedMsg), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('ai-chat error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
