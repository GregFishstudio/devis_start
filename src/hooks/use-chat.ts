import { useAuth } from '@/context/auth-context';
import { generateId } from '@/lib/generate-id';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types/database';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

const API_BASE_URL = 'http://192.168.8.128:3000';
const API_KEY = 'myVerySecretKey123ABC';

type ActionType = 'create_quote' | 'add_items' | 'generate_pdf' | 'save_catalog' | 'create_client';

interface QuoteItemInput {
  description: string;
  quantity: number;
  unit_price: number;
  unit?: string;
}

interface Action {
  type: ActionType;
  data: Record<string, unknown>;
}

function parseActions(text: string): { cleanText: string; actions: Action[] } {
  const actions: Action[] = [];
  const cleanText = text
    .replace(/\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/g, (_, type, json) => {
      try {
        actions.push({ type: type as ActionType, data: JSON.parse(json.trim()) });
      } catch {}
      return '';
    })
    .trim();
  return { cleanText, actions };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

async function executeAction(action: Action, companyId: string): Promise<void> {
  switch (action.type) {
    case 'create_quote': {
      const d = action.data as {
        client_id?: string;
        client_name?: string;
        title?: string;
        items?: QuoteItemInput[];
        tax_rate?: number;
      };

      let clientId = d.client_id ?? null;
      if (!clientId && d.client_name) {
        const { data: allClients } = await db
          .from('clients')
          .select('id, name')
          .eq('company_id', companyId);

        const match = (allClients ?? []).find(
          (c: { name: string }) => c.name.toLowerCase() === d.client_name!.toLowerCase(),
        );

        if (match) {
          clientId = match.id;
        } else {
          const { data: newClient } = await db
            .from('clients')
            .insert({ company_id: companyId, name: d.client_name, email: null, phone: null, address: null, siret: null, notes: null })
            .select('id')
            .single();
          clientId = newClient?.id ?? null;
        }
      }

      const items = d.items ?? [];
      const taxRate = d.tax_rate ?? 20;
      const subtotal = items.reduce((sum: number, i: QuoteItemInput) => sum + i.quantity * i.unit_price, 0);
      const taxAmount = subtotal * (taxRate / 100);

      const { data: quote } = await db
        .from('quotes')
        .insert({
          company_id: companyId,
          client_id: clientId,
          number: `DEV-${Date.now().toString().slice(-6)}`,
          status: 'draft',
          title: d.title ?? null,
          description: null,
          notes: null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total: subtotal + taxAmount,
          pdf_url: null,
          valid_until: null,
        })
        .select('id')
        .single();

      if (quote && items.length > 0) {
        await db.from('quote_items').insert(
          items.map((item: QuoteItemInput, i: number) => ({
            quote_id: quote.id,
            description: item.description,
            unit: item.unit ?? 'unité',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
            position: i,
          })),
        );
      }
      break;
    }

    case 'add_items': {
      const d = action.data as { quote_id: string; items: QuoteItemInput[] };

      const { count } = await db
        .from('quote_items')
        .select('id', { count: 'exact', head: true })
        .eq('quote_id', d.quote_id);

      await db.from('quote_items').insert(
        d.items.map((item: QuoteItemInput, i: number) => ({
          quote_id: d.quote_id,
          description: item.description,
          unit: item.unit ?? 'unité',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
          position: (count ?? 0) + i,
        })),
      );

      const { data: allItems } = await db
        .from('quote_items')
        .select('total')
        .eq('quote_id', d.quote_id);
      const subtotal = (allItems ?? []).reduce(
        (sum: number, item: { total: number }) => sum + item.total,
        0,
      );
      const { data: q } = await db.from('quotes').select('tax_rate').eq('id', d.quote_id).single();
      const taxRate = (q?.tax_rate as number) ?? 20;
      const taxAmount = subtotal * (taxRate / 100);
      await db
        .from('quotes')
        .update({ subtotal, tax_amount: taxAmount, total: subtotal + taxAmount })
        .eq('id', d.quote_id);
      break;
    }

    case 'generate_pdf': {
      const d = action.data as { quote_id: string };
      await supabase.functions.invoke('generate-pdf', { body: { quote_id: d.quote_id } });
      break;
    }

    case 'save_catalog': {
      const d = action.data as { name: string; description?: string; unit_price: number; unit?: string };
      await db.from('catalog_items').insert({
        company_id: companyId,
        name: d.name,
        description: d.description ?? null,
        unit_price: d.unit_price,
        unit: d.unit ?? 'unité',
      });
      break;
    }

    case 'create_client': {
      const d = action.data as { name: string; email?: string; phone?: string; address?: string };
      await db.from('clients').insert({
        company_id: companyId,
        name: d.name,
        email: d.email ?? null,
        phone: d.phone ?? null,
        address: d.address ?? null,
        siret: null,
        notes: null,
      });
      break;
    }
  }
}

export function useChat() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const sessionIdRef = useRef<string>(generateId());

  const { data: messages = [] } = useQuery({
    queryKey: ['chat', profile?.company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!profile?.company_id,
  });

  const sendMessage = async (content: string, audioUrl?: string | null) => {
    if (!profile?.company_id) return;
    setIsSending(true);

    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: tempId,
      company_id: profile.company_id,
      user_id: null,
      role: 'user',
      content,
      intent: null,
      metadata: {},
      audio_url: audioUrl ?? null,
      created_at: new Date().toISOString(),
    };
    qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) => [
      ...old,
      userMsg,
    ]);

    try {
      // Fetch context to inject into the prompt
      const [clientsRes, catalogRes, draftQuotesRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .order('name')
          .limit(30),
        supabase
          .from('catalog_items')
          .select('id, name, unit_price, unit')
          .eq('company_id', profile.company_id)
          .limit(50),
        supabase
          .from('quotes')
          .select('id, number, status, total')
          .eq('company_id', profile.company_id)
          .in('status', ['draft', 'sent'])
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const ctxParts: string[] = [];
      if ((clientsRes.data ?? []).length > 0) {
        ctxParts.push(
          `CLIENTS: ${clientsRes.data!.map((c: { id: string; name: string }) => `"${c.name}" (id=${c.id})`).join(', ')}`,
        );
      }
      if ((catalogRes.data ?? []).length > 0) {
        ctxParts.push(
          `CATALOGUE: ${catalogRes.data!.map((c: { id: string; name: string; unit_price: number; unit: string }) => `"${c.name}" ${c.unit_price}€/${c.unit}`).join(', ')}`,
        );
      }
      if ((draftQuotesRes.data ?? []).length > 0) {
        ctxParts.push(
          `DEVIS EN COURS: ${draftQuotesRes.data!.map((q: { id: string; number: string; status: string; total: number }) => `${q.number} (id=${q.id}, ${q.status}, ${q.total}€)`).join(', ')}`,
        );
      }

      const enrichedPrompt =
        ctxParts.length > 0
          ? `[CONTEXTE]\n${ctxParts.join('\n')}\n\n[MESSAGE]\n${content}`
          : content;

      // Persist user message
      await supabase.from('chat_messages').insert({
        company_id: profile.company_id,
        role: 'user',
        content,
        metadata: {},
        audio_url: audioUrl ?? null,
        user_id: null,
        intent: null,
      });

      // Call OpenClaw backend
      const backendResponse = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          sessionId: sessionIdRef.current,
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || 'Erreur backend.');
      }

      const data = await backendResponse.json();
      const rawText = data?.response?.payloads?.[0]?.text || 'Pas de réponse.';

      // Parse and execute actions embedded in the response
      const { cleanText, actions } = parseActions(rawText);
      if (actions.length > 0) {
        await Promise.all(actions.map((a) => executeAction(a, profile.company_id!)));
      }

      // Persist assistant message (without the action blocks)
      const { data: aiMsg } = await supabase
        .from('chat_messages')
        .insert({
          company_id: profile.company_id,
          role: 'assistant',
          content: cleanText,
          metadata: { actions_count: actions.length },
          audio_url: null,
          user_id: null,
          intent: null,
        })
        .select()
        .single();

      qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) => {
        const withoutTemp = old.filter((m) => m.id !== tempId);
        return [...withoutTemp, userMsg, aiMsg as unknown as ChatMessage];
      });

      if (actions.length > 0) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['quotes'] }),
          qc.invalidateQueries({ queryKey: ['clients'] }),
          qc.invalidateQueries({ queryKey: ['catalog'] }),
        ]);
      }
      await qc.invalidateQueries({ queryKey: ['chat', profile.company_id] });
    } catch (err) {
      qc.setQueryData(['chat', profile.company_id], (old: ChatMessage[] = []) =>
        old.filter((m) => m.id !== tempId),
      );
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  return { messages, sendMessage, isSending };
}
