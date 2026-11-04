const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
if (typeof __dirname !== 'undefined') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// ========== COMPANY API ==========
app.get('/api/company', async (req, res) => {
  try {
    // ponytail: DDL belongs in migrate-db.js, not on every read request
    const result = await db.query('SELECT * FROM company_profile LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).send('Company profile not found. Please run database seeding.');
    }
    const company = { ...result.rows[0] };
    company.has_gemini_api_key = Boolean(company.gemini_api_key && company.gemini_api_key.trim());
    if (company.gemini_api_key) {
      company.gemini_api_key = '••••••••';
    }
    res.json(company);
  } catch (err) {
    console.error('Error fetching company profile:', err);
    res.status(500).send('Database error retrieving company profile.');
  }
});

app.put('/api/company', async (req, res) => {
  const { name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, logoSize, geminiApiKey } = req.body;
  if (!name || !gstin) {
    return res.status(400).send('Name and GSTIN are required.');
  }
  try {
    const check = await db.query('SELECT * FROM company_profile LIMIT 1');
    let finalGeminiKey = geminiApiKey || '';
    if (check.rows.length > 0 && finalGeminiKey.includes('•')) {
      // Retain existing key if user didn't enter a new key
      finalGeminiKey = check.rows[0].gemini_api_key || '';
    }

    let result;
    if (check.rows.length === 0) {
      result = await db.query(
        'INSERT INTO company_profile (name, address, gstin, state, state_code, phone, email, bank_name, bank_branch, bank_acc_no, bank_ifsc, bank_upi_id, terms, contact_person, logo_url, logo_size, gemini_api_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *',
        [name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, parseInt(logoSize, 10) || 70, finalGeminiKey]
      );
    } else {
      result = await db.query(
        'UPDATE company_profile SET name = $1, address = $2, gstin = $3, state = $4, state_code = $5, phone = $6, email = $7, bank_name = $8, bank_branch = $9, bank_acc_no = $10, bank_ifsc = $11, bank_upi_id = $12, terms = $13, contact_person = $14, logo_url = $15, logo_size = $16, gemini_api_key = $17 WHERE id = $18 RETURNING *',
        [name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, parseInt(logoSize, 10) || 70, finalGeminiKey, check.rows[0].id]
      );
    }

    const saved = { ...result.rows[0] };
    saved.has_gemini_api_key = Boolean(saved.gemini_api_key && saved.gemini_api_key.trim());
    if (saved.gemini_api_key) {
      saved.gemini_api_key = '••••••••';
    }
    res.json(saved);
  } catch (err) {
    console.error('Error updating company profile:', err);
    res.status(500).send('Database error saving company profile.');
  }
});

// ========== UPLOAD LOGO API ==========
app.post('/api/upload-logo', async (req, res) => {
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).send('No image data provided.');
  }

  try {
    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Invalid image format. Expected base64 data URI.');
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';

    // Strict whitelist: raster formats only to prevent SVG stored XSS
    const allowed = ['png', 'jpg', 'webp', 'gif'];
    if (!allowed.includes(ext)) {
      return res.status(400).send('Invalid image format. Only PNG, JPG, WEBP, and GIF are allowed.');
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Max 2MB limit
    if (buffer.length > 2 * 1024 * 1024) {
      return res.status(400).send('Logo file size exceeds the 2MB limit.');
    }

    if (typeof __dirname === 'undefined') {
      return res.json({ url: image });
    }

    const fs = require('fs');
    const filename = `logo_${Date.now()}.${ext}`;
    const filePath = path.join(__dirname, 'public', filename);

    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/${filename}` });
  } catch (err) {
    console.warn('Filesystem write failed, returning base64 URL directly:', err.message);
    res.json({ url: image });
  }
});

// ========== AI OCR PROXY API ==========
app.post('/api/ai/ocr', async (req, res) => {
  const { image, mimeType } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).send('Image data is required.');
  }

  try {
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const compRes = await db.query('SELECT gemini_api_key FROM company_profile LIMIT 1');
      if (compRes.rows.length > 0 && compRes.rows[0].gemini_api_key) {
        apiKey = compRes.rows[0].gemini_api_key.trim();
      }
    }

    if (!apiKey) {
      return res.status(400).send('No Gemini API key configured. Please configure it in Settings or set GEMINI_API_KEY.');
    }

    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    const base64Data = matches ? matches[2] : image;
    const finalMime = mimeType || (matches ? `image/${matches[1]}` : 'image/jpeg');

    const promptText = "Analyze the attached invoice/bill image. The bill may be written in any language (e.g. English, Hindi, Kannada, Tamil, Spanish, etc.). Please extract key details and translate item names and descriptions to English while retaining correct numeric values for quantity, rate, and amount. Return a JSON object containing: customerName, gstin (exactly 15 chars if found), invoiceNumber, date (format: DD-Mon-YY, e.g. 11-Jun-26), address, items (array of objects containing: name, qty, rate, gstRate (choose from 5, 12, 18, 28), amount). Do not include any markdown tags or comments, output raw JSON only.";

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              { inlineData: { mimeType: finalMime, data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return res.status(geminiRes.status).send(`Gemini API error: ${errText}`);
    }

    const result = await geminiRes.json();
    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return res.status(502).send('Empty response from Gemini API.');
    }

    let parsed;
    try {
      parsed = JSON.parse(textResponse);
    } catch {
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(502).send('Failed to parse Gemini output as JSON.');
      }
    }

    res.json(parsed);
  } catch (err) {
    console.error('OCR Proxy Error:', err);
    res.status(500).send('Internal OCR processing error.');
  }
});

// ========== CUSTOMERS API ==========
app.get('/api/customers', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).send('Database error retrieving customers.');
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, gstin, address, state, phone, email } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).send('Customer name is required.');
  }
  try {
    const result = await db.query(
      'INSERT INTO customers (name, gstin, address, state, phone, email) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET gstin = $2, address = $3, state = $4, phone = $5, email = $6 RETURNING *',
      [name.trim(), gstin || '', address || '', state || 'Karnataka', phone || '', email || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving customer:', err);
    res.status(500).send('Database error saving customer.');
  }
});

// ========== PRODUCTS API ==========
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).send('Database error retrieving products.');
  }
});

app.post('/api/products', async (req, res) => {
  const { name, hsn, unit, rate, gstRate } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).send('Product name is required.');
  }
  try {
    const result = await db.query(
      'INSERT INTO products (name, hsn, unit, rate, gst_rate) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET hsn = $2, unit = $3, rate = $4, gst_rate = $5 RETURNING *',
      [name.trim(), hsn || '', unit || 'No', Number(rate) || 0, parseInt(gstRate, 10) || 18]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving product:', err);
    res.status(500).send('Database error saving product.');
  }
});

// ========== INVOICES API ==========
app.get('/api/invoices', async (req, res) => {
  try {
    // Select invoices joined with nested aggregated items
    const query = `
      SELECT i.*, 
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'name', it.name,
              'hsn', it.hsn,
              'qty', it.qty,
              'unit', it.unit,
              'rate', it.rate,
              'gstRate', it.gst_rate,
              'amount', it.amount
            ))
            FROM invoice_items it 
            WHERE it.invoice_id = i.id
          ), 
          '[]'::json
        ) as items
      FROM invoices i
      ORDER BY i.id DESC;
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).send('Database error retrieving invoices.');
  }
});

app.post('/api/invoices', async (req, res) => {
  const {
    id, date, customerName, gstin, taxable, cgst, sgst, igst, total, status,
    notes, poNo, deliveryNote, termsOfPayment, dispatchThrough, destination, items,
    journeyDate, bookingBranch, placeOfSupply
  } = req.body;

  if (!id || !date || !customerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).send('Invoice ID, date, customer name, and a non-empty items array are required.');
  }

  const numTaxable = Number(taxable) || 0;
  const numCgst = Number(cgst) || 0;
  const numSgst = Number(sgst) || 0;
  const numIgst = Number(igst) || 0;
  const numTotal = Number(total) || 0;

  let client;
  try {
    client = await db.pool.connect();
  } catch (connErr) {
    console.error('Database connection error in /api/invoices:', connErr);
    return res.status(500).send('Unable to connect to database.');
  }

  try {
    await client.query('BEGIN');

    // 1. Ensure customer exists
    await client.query(
      'INSERT INTO customers (name, gstin, state) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
      [String(customerName).trim(), gstin ? String(gstin).trim() : '', 'Karnataka']
    );

    // 2. Insert Invoice
    const invoiceQuery = `
      INSERT INTO invoices (
        id, date, customer_name, gstin, taxable, cgst, sgst, igst, total, status,
        notes, po_no, delivery_note, terms_of_payment, dispatch_through, destination,
        journey_date, booking_branch, place_of_supply
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;
    const invoiceVals = [
      String(id).trim(),
      String(date).trim(),
      String(customerName).trim(),
      gstin ? String(gstin).trim() : '',
      numTaxable,
      numCgst,
      numSgst,
      numIgst,
      numTotal,
      status || 'pending',
      notes || '',
      poNo || '',
      deliveryNote || '',
      termsOfPayment || 'Immediate',
      dispatchThrough || '',
      destination || '',
      journeyDate || '',
      bookingBranch || '',
      placeOfSupply || ''
    ];
    await client.query(invoiceQuery, invoiceVals);

    // 3. Batch insert items in a single query
    const itemPlaceholders = [];
    const itemValues = [];
    let pIdx = 1;

    for (const item of items) {
      itemPlaceholders.push(`($${pIdx}, $${pIdx+1}, $${pIdx+2}, $${pIdx+3}, $${pIdx+4}, $${pIdx+5}, $${pIdx+6}, $${pIdx+7})`);
      itemValues.push(
        String(id).trim(),
        String(item.name || 'Item').trim(),
        item.hsn ? String(item.hsn).trim() : null,
        Number(item.qty) || 1,
        item.unit ? String(item.unit).trim() : 'No',
        Number(item.rate) || 0,
        parseInt(item.gstRate, 10) || 18,
        Number(item.amount) || 0
      );
      pIdx += 8;
    }

    const batchItemQuery = `
      INSERT INTO invoice_items (
        invoice_id, name, hsn, qty, unit, rate, gst_rate, amount
      ) VALUES ${itemPlaceholders.join(', ')}
    `;
    await client.query(batchItemQuery, itemValues);

    await client.query('COMMIT');

    // Fetch the newly created invoice with nested items to return
    const completeInvoiceQuery = `
      SELECT i.*, 
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'name', it.name,
              'hsn', it.hsn,
              'qty', it.qty,
              'unit', it.unit,
              'rate', it.rate,
              'gstRate', it.gst_rate,
              'amount', it.amount
            ))
            FROM invoice_items it 
            WHERE it.invoice_id = i.id
          ), 
          '[]'::json
        ) as items
      FROM invoices i
      WHERE i.id = $1;
    `;
    const finalResult = await client.query(completeInvoiceQuery, [id]);
    res.status(201).json(finalResult.rows[0]);
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(rbErr => console.error('Rollback error:', rbErr));
    }
    console.error('Error saving invoice:', err);
    res.status(500).send('Database error saving invoice. Please verify invoice ID uniqueness and field formats.');
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.put('/api/invoices/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).send('Status is required.');
  }
  try {
    const result = await db.query(
      'UPDATE invoices SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Invoice not found.');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating invoice status:', err);
    res.status(500).send('Database error updating invoice status.');
  }
});

// Start listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;