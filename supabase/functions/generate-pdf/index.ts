import { createClient } from 'jsr:@supabase/supabase-js@2';
import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import { corsHeaders } from '../_shared/cors.ts';

const EUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { quote_id } = await req.json();
    if (!quote_id) {
      return new Response(JSON.stringify({ error: 'quote_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Fetch quote + items + company
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('*, clients(name, email, address), companies:company_id(name, address, email, phone, siret, tva_number)')
      .eq('id', quote_id)
      .single();

    if (qErr || !quote) throw qErr ?? new Error('Quote not found');

    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote_id)
      .order('position');

    const company = quote.companies as Record<string, string | null>;
    const client = quote.clients as Record<string, string | null> | null;

    // --- Build PDF ---
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();

    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await doc.embedFont(StandardFonts.Helvetica);

    const navy = rgb(0.051, 0.165, 0.271); // #0D2A45
    const accent = rgb(0.243, 0.647, 0.906); // ~#3EA5E7
    const gray = rgb(0.45, 0.45, 0.45);
    const light = rgb(0.95, 0.95, 0.98);
    const black = rgb(0, 0, 0);

    const margin = 50;
    let y = height - margin;

    const text = (t: string, x: number, yPos: number, opts: {
      font?: typeof fontBold;
      size?: number;
      color?: ReturnType<typeof rgb>;
    } = {}) => {
      page.drawText(t, {
        x,
        y: yPos,
        font: opts.font ?? fontReg,
        size: opts.size ?? 10,
        color: opts.color ?? black,
      });
    };

    // Header background
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: navy });

    // App logo (fetched from Supabase Storage bucket "assets")
    try {
      const { data: logoUrlData } = supabase.storage.from('assets').getPublicUrl('logo.png');
      const logoRes = await fetch(logoUrlData.publicUrl);
      if (logoRes.ok) {
        const logoBytes = await logoRes.arrayBuffer();
        const logoImg = await doc.embedPng(new Uint8Array(logoBytes));
        const logoW = 140;
        const logoH = logoW * (logoImg.height / logoImg.width);
        page.drawImage(logoImg, { x: margin, y: height - margin / 2 - logoH / 2 - 10, width: logoW, height: logoH });
      }
    } catch { /* logo optionnel */ }

    // Company name fallback if no logo
    if (company.address) text(company.address, margin, y - 28, { size: 9, color: rgb(0.7, 0.8, 0.9) });
    if (company.email) text(company.email, margin, y - 42, { size: 9, color: rgb(0.7, 0.8, 0.9) });

    // DEVIS title right-aligned
    text('DEVIS', width - margin - 60, height - 40, { font: fontBold, size: 24, color: accent });
    text(quote.number, width - margin - 60, height - 60, { size: 11, color: rgb(0.8, 0.9, 1) });

    y = height - 110;

    // Quote meta row
    page.drawRectangle({ x: margin, y: y - 40, width: width - margin * 2, height: 40, color: light });
    const dateStr = new Date(quote.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const validStr = quote.valid_until
      ? new Date(quote.valid_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '30 jours';
    text('Date :', margin + 8, y - 14, { size: 9, color: gray });
    text(dateStr, margin + 45, y - 14, { size: 9 });
    text('Valide jusqu\'au :', margin + 160, y - 14, { size: 9, color: gray });
    text(validStr, margin + 250, y - 14, { size: 9 });
    text('Statut :', margin + 360, y - 14, { size: 9, color: gray });
    text(quote.status.toUpperCase(), margin + 398, y - 14, { font: fontBold, size: 9, color: navy });

    if (quote.title) {
      text(quote.title, margin + 8, y - 30, { font: fontBold, size: 9, color: navy });
    }
    y -= 56;

    // Client block
    if (client) {
      text('FACTURER À', margin, y, { font: fontBold, size: 9, color: gray });
      y -= 14;
      text(client.name ?? '', margin, y, { font: fontBold, size: 11 });
      y -= 13;
      if (client.address) { text(client.address, margin, y, { size: 9 }); y -= 12; }
      if (client.email) { text(client.email, margin, y, { size: 9 }); y -= 12; }
    }
    y -= 20;

    // Items table header
    page.drawRectangle({ x: margin, y: y - 20, width: width - margin * 2, height: 20, color: navy });
    text('Description', margin + 8, y - 14, { font: fontBold, size: 9, color: rgb(1, 1, 1) });
    text('Qté', width - margin - 220, y - 14, { font: fontBold, size: 9, color: rgb(1, 1, 1) });
    text('P.U. HT', width - margin - 160, y - 14, { font: fontBold, size: 9, color: rgb(1, 1, 1) });
    text('Total HT', width - margin - 80, y - 14, { font: fontBold, size: 9, color: rgb(1, 1, 1) });
    y -= 22;

    // Items rows
    const rowItems = items ?? [];
    for (let i = 0; i < rowItems.length; i++) {
      const item = rowItems[i] as {
        description: string;
        quantity: number;
        unit_price: number;
        total: number;
      };
      if (i % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - 16, width: width - margin * 2, height: 18, color: light });
      }
      text(item.description, margin + 8, y - 12, { size: 9 });
      text(String(item.quantity), width - margin - 215, y - 12, { size: 9 });
      text(EUR(item.unit_price), width - margin - 160, y - 12, { size: 9 });
      text(EUR(item.total), width - margin - 80, y - 12, { size: 9 });
      y -= 18;
    }

    if (rowItems.length === 0) {
      text('Aucune ligne de prestation', margin + 8, y - 12, { size: 9, color: gray });
      y -= 18;
    }

    y -= 10;
    // Totals block
    const totX = width - margin - 180;
    page.drawLine({ start: { x: totX, y }, end: { x: width - margin, y }, thickness: 0.5, color: light });
    y -= 14;
    text('Sous-total HT', totX, y, { size: 9, color: gray });
    text(EUR(quote.subtotal), width - margin - 5 - fontReg.widthOfTextAtSize(EUR(quote.subtotal), 9), y, { size: 9 });
    y -= 12;
    text(`TVA ${quote.tax_rate}%`, totX, y, { size: 9, color: gray });
    text(EUR(quote.tax_amount), width - margin - 5 - fontReg.widthOfTextAtSize(EUR(quote.tax_amount), 9), y, { size: 9 });
    y -= 4;
    page.drawLine({ start: { x: totX, y }, end: { x: width - margin, y }, thickness: 0.5, color: navy });
    y -= 16;
    page.drawRectangle({ x: totX - 4, y: y - 4, width: width - margin - totX + 8, height: 20, color: navy });
    text('TOTAL TTC', totX, y + 2, { font: fontBold, size: 10, color: rgb(1, 1, 1) });
    text(EUR(quote.total), width - margin - 5 - fontBold.widthOfTextAtSize(EUR(quote.total), 10), y + 2, {
      font: fontBold,
      size: 10,
      color: rgb(1, 1, 1),
    });

    // Notes
    if (quote.notes) {
      y -= 40;
      text('Notes :', margin, y, { font: fontBold, size: 9, color: gray });
      y -= 13;
      text(quote.notes, margin, y, { size: 9 });
    }

    // Footer
    const footerY = 30;
    page.drawLine({ start: { x: margin, y: footerY + 14 }, end: { x: width - margin, y: footerY + 14 }, thickness: 0.5, color: light });
    const footerParts = [company.siret ? `SIRET : ${company.siret}` : '', company.tva_number ? `TVA : ${company.tva_number}` : ''].filter(Boolean).join('   ·   ');
    text(footerParts, margin, footerY, { size: 8, color: gray });

    // Serialize
    const pdfBytes = await doc.save();

    // Upload to Supabase Storage
    const storagePath = `${quote.company_id}/${quote_id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('quotes-pdf')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from('quotes-pdf').getPublicUrl(storagePath);
    const pdfUrl = urlData.publicUrl;

    // Update quote record
    await supabase.from('quotes').update({ pdf_url: pdfUrl }).eq('id', quote_id);

    return new Response(JSON.stringify({ pdf_url: pdfUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('generate-pdf error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
