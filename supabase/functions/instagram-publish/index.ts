import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GRAPH_API = 'https://graph.instagram.com/v21.0';

async function getInstagramToken(supabase: ReturnType<typeof createClient>, companyId: string): Promise<string | null> {
  // Token stored in company_settings table (key: 'instagram_access_token')
  const { data } = await supabase
    .from('company_settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'instagram_access_token')
    .single();
  return (data?.value as string) ?? null;
}

async function getInstagramAccountId(supabase: ReturnType<typeof createClient>, companyId: string): Promise<string | null> {
  const { data } = await supabase
    .from('company_settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', 'instagram_account_id')
    .single();
  return (data?.value as string) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: 'post_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch post
    const { data: post, error: pErr } = await supabase
      .from('instagram_posts')
      .select('*')
      .eq('id', post_id)
      .single();

    if (pErr || !post) throw pErr ?? new Error('Post not found');
    if (post.status === 'posted') {
      return new Response(JSON.stringify({ error: 'Already posted' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mark as processing
    await supabase.from('instagram_posts').update({ status: 'processing' }).eq('id', post_id);

    const accessToken = await getInstagramToken(supabase, post.company_id);
    const accountId = await getInstagramAccountId(supabase, post.company_id);

    if (!accessToken || !accountId) {
      await supabase.from('instagram_posts').update({
        status: 'failed',
        error_message: 'Instagram non configuré. Ajoutez votre access_token et account_id dans les paramètres.',
      }).eq('id', post_id);
      return new Response(JSON.stringify({ error: 'Instagram not configured' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const caption = post.caption ?? post.context ?? '';

    // Step 1: Create container
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      caption,
    });

    if (post.media_url) {
      if (post.media_type === 'video') {
        containerParams.set('media_type', 'REELS');
        containerParams.set('video_url', post.media_url);
      } else {
        containerParams.set('image_url', post.media_url);
      }
    } else {
      // Image required — fail gracefully
      await supabase.from('instagram_posts').update({
        status: 'failed',
        error_message: 'Aucun média fourni pour la publication.',
      }).eq('id', post_id);
      return new Response(JSON.stringify({ error: 'No media' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const containerRes = await fetch(
      `${GRAPH_API}/${accountId}/media?${containerParams}`,
      { method: 'POST' },
    );
    const containerData = await containerRes.json();

    if (!containerData.id) {
      throw new Error(`Container creation failed: ${JSON.stringify(containerData)}`);
    }

    // Step 2: Publish container
    const publishRes = await fetch(
      `${GRAPH_API}/${accountId}/media_publish?creation_id=${containerData.id}&access_token=${accessToken}`,
      { method: 'POST' },
    );
    const publishData = await publishRes.json();

    if (!publishData.id) {
      throw new Error(`Publish failed: ${JSON.stringify(publishData)}`);
    }

    // Mark as posted
    await supabase.from('instagram_posts').update({
      status: 'posted',
      instagram_id: publishData.id,
      posted_at: new Date().toISOString(),
      error_message: null,
    }).eq('id', post_id);

    return new Response(JSON.stringify({ instagram_id: publishData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('instagram-publish error:', err);
    // Best-effort status update
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { post_id } = await (req.clone().json().catch(() => ({ post_id: null })));
      if (post_id) {
        await supabase.from('instagram_posts').update({
          status: 'failed',
          error_message: String(err),
        }).eq('id', post_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
