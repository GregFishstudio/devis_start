import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const OPENCLAW_TIMEOUT_MS = 50_000; // 50s — Edge Function max = 60s

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
      .select('role, content, intent, metadata')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const contextMessages = (history ?? []).reverse();

    // Save user message first
    await supabase.from('chat_messages').insert({
      company_id,
      role: 'user',
      content,
      audio_url: audio_url ?? null,
      intent: null,
      metadata: {},
      user_id: null,
    });

    // --- Forward to local OpenClaw ---
    const openclawUrl = Deno.env.get('OPENCLAW_URL');
    const openclawSecret = Deno.env.get('OPENCLAW_SECRET');

    if (!openclawUrl || !openclawSecret) {
      throw new Error('OPENCLAW_URL ou OPENCLAW_SECRET non configuré');
    }

    const payload = {
      content: audio_url ? `[Message vocal] ${content}` : content,
      company_id,
      audio_url: audio_url ?? null,
      history: contextMessages,
    };

    let openclawRes: Response;
    try {
      openclawRes = await fetch(`${openclawUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openclawSecret}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(OPENCLAW_TIMEOUT_MS),
      });
    } catch (fetchErr) {
      const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError';
      throw new Error(isTimeout
        ? 'OpenClaw ne répond pas (timeout 50s). Vérifiez que le serveur est démarré et le tunnel actif.'
        : `Connexion OpenClaw impossible: ${String(fetchErr)}`
      );
    }

    if (!openclawRes.ok) {
      const errBody = await openclawRes.text().catch(() => '');
      throw new Error(`OpenClaw a répondu ${openclawRes.status}: ${errBody}`);
    }

    const result = await openclawRes.json() as {
      intent: 'quote' | 'instagram' | 'note' | 'chat';
      content: string;
      data: Record<string, unknown> | null;
    };

    // Act on intent (side-effects delegated from OpenClaw's decision)
    if (result.intent === 'quote' && result.data) {
      const d = result.data;
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

    if (result.intent === 'instagram' && result.data) {
      const d = result.data;
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
        content: result.content,
        intent: result.intent === 'chat' ? null : result.intent,
        metadata: result.data ?? {},
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
    console.error('ai-chat bridge error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
