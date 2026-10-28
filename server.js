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
    // Ensure gemini_api_key column exists
    await db.query('ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS gemini_api_key VARCHAR(255)');
    const result = await db.query('SELECT * FROM company_profile LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).send('Company profile not found. Please run database seeding.');
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

app.put('/api/company', async (req, res) => {
  const { name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, logoSize, geminiApiKey } = req.body;
  if (!name || !gstin) {
    return res.status(400).send('Name and GSTIN are required.');
  }
  try {
    // Check if company profile exists
    const check = await db.query('SELECT id FROM company_profile LIMIT 1');
    let result;
    if (check.rows.length === 0) {
      // Insert new
      result = await db.query(
        'INSERT INTO company_profile (name, address, gstin, state, state_code, phone, email, bank_name, bank_branch, bank_acc_no, bank_ifsc, bank_upi_id, terms, contact_person, logo_url, logo_size, gemini_api_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *',
        [name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, parseInt(logoSize) || 70, geminiApiKey || '']
      );
    } else {
      // Update existing
      result = await db.query(
        'UPDATE company_profile SET name = $1, address = $2, gstin = $3, state = $4, state_code = $5, phone = $6, email = $7, bank_name = $8, bank_branch = $9, bank_acc_no = $10, bank_ifsc = $11, bank_upi_id = $12, terms = $13, contact_person = $14, logo_url = $15, logo_size = $16, gemini_api_key = $17 WHERE id = $18 RETURNING *',
        [name, address, gstin, state, stateCode, phone, email, bankName, bankBranch, bankAccNo, bankIfsc, bankUpiId, terms, contactPerson, logoUrl, parseInt(logoSize) || 70, geminiApiKey || '', check.rows[0].id]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

// ========== UPLOAD LOGO API ==========
app.post('/api/upload-logo', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).send('No image data provided.');
  }

  try {
    if (typeof __dirname === 'undefined') {
      return res.json({ url: image });
    }

    const fs = require('fs');
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send('Invalid image format.');
    }

    const ext = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const filename = `logo_${Date.now()}.${ext}`;
    const filePath = path.join(__dirname, 'public', filename);

    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/${filename}` });
  } catch (err) {
    console.warn('Filesystem write failed, returning base64 URL directly:', err.message);
    res.json({ url: image });
  }
});

// ========== CUSTOMERS API ==========
app.get('/api/customers', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

app.post('/api/customers', async (req, res) => {
  const { name, gstin, address, state, phone, email } = req.body;
  if (!name) {
    return res.status(400).send('Customer name is required.');
  }
  try {
    const result = await db.query(
      'INSERT INTO customers (name, gstin, address, state, phone, email) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET gstin = $2, address = $3, state = $4, phone = $5, email = $6 RETURNING *',
      [name, gstin, address, state || 'Karnataka', phone, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

// ========== PRODUCTS API ==========
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

app.post('/api/products', async (req, res) => {
  const { name, hsn, unit, rate, gstRate } = req.body;
  if (!name) {
    return res.status(400).send('Product name is required.');
  }
  try {
    const result = await db.query(
      'INSERT INTO products (name, hsn, unit, rate, gst_rate) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET hsn = $2, unit = $3, rate = $4, gst_rate = $5 RETURNING *',
      [name, hsn, unit || 'No', parseFloat(rate) || 0, parseInt(gstRate) || 18]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
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
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

app.post('/api/invoices', async (req, res) => {
  const {
    id, date, customerName, gstin, taxable, cgst, sgst, igst, total, status,
    notes, poNo, deliveryNote, termsOfPayment, dispatchThrough, destination, items,
    journeyDate, bookingBranch, placeOfSupply
  } = req.body;

  if (!id || !date || !customerName || !items || items.length === 0) {
    return res.status(400).send('Invoice ID, date, customer name, and items are required.');
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Double check customer exists
    const custCheck = await client.query('SELECT name FROM customers WHERE name = $1', [customerName]);
    if (custCheck.rows.length === 0) {
      // Create customer automatically if missing
      await client.query(
        'INSERT INTO customers (name, gstin, state) VALUES ($1, $2, $3)',
        [customerName, gstin, 'Karnataka']
      );
    }

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
      id, date, customerName, gstin, taxable, cgst, sgst, igst || 0, total, status || 'pending',
      notes, poNo, deliveryNote, termsOfPayment || 'Immediate', dispatchThrough, destination,
      journeyDate, bookingBranch, placeOfSupply
    ];
    const invoiceResult = await client.query(invoiceQuery, invoiceVals);

    // 3. Insert Invoice Items
    const itemQuery = `
      INSERT INTO invoice_items (
        invoice_id, name, hsn, qty, unit, rate, gst_rate, amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    for (const item of items) {
      await client.query(itemQuery, [
        id, item.name, item.hsn, item.qty, item.unit || 'No', item.rate, item.gstRate, item.amount
      ]);
    }

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
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Database error saving invoice: ' + err.message);
  } finally {
    client.release();
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
    console.error(err);
    res.status(500).send('Database error: ' + err.message);
  }
});

// Start listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
