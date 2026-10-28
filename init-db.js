const { pool } = require('./db');

async function initDb() {
  console.log('Connecting to database and running migrations...');
  const client = await pool.connect();
  
  try {
    // Start transaction for DB schema setup
    await client.query('BEGIN');

    // 1. Create Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        gstin VARCHAR(15),
        address TEXT,
        state VARCHAR(100) DEFAULT 'Karnataka',
        phone VARCHAR(20),
        email VARCHAR(255)
      )
    `);

    // 2. Create Products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        hsn VARCHAR(10),
        unit VARCHAR(20) DEFAULT 'No',
        rate DECIMAL(12, 2) DEFAULT 0.00,
        gst_rate INTEGER DEFAULT 18
      )
    `);

    // 3. Create Company Profile table
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_profile (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        gstin VARCHAR(15) NOT NULL,
        state VARCHAR(100) NOT NULL,
        state_code VARCHAR(2) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        bank_name VARCHAR(100),
        bank_branch VARCHAR(100),
        bank_acc_no VARCHAR(50),
        bank_ifsc VARCHAR(20),
        bank_upi_id VARCHAR(100),
        terms TEXT,
        logo_url TEXT,
        logo_size INTEGER DEFAULT 70,
        contact_person VARCHAR(255),
        gemini_api_key VARCHAR(255)
      )
    `);

    // 4. Create Invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id VARCHAR(50) PRIMARY KEY,
        date VARCHAR(50) NOT NULL,
        customer_name VARCHAR(255) NOT NULL REFERENCES customers(name) ON UPDATE CASCADE,
        gstin VARCHAR(15),
        taxable DECIMAL(12, 2) NOT NULL,
        cgst DECIMAL(12, 2) NOT NULL,
        sgst DECIMAL(12, 2) NOT NULL,
        igst DECIMAL(12, 2) DEFAULT 0.00,
        total DECIMAL(12, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        po_no VARCHAR(100),
        delivery_note VARCHAR(100),
        terms_of_payment VARCHAR(100) DEFAULT 'Immediate',
        dispatch_through VARCHAR(100),
        destination VARCHAR(100)
      )
    `);

    // 5. Create Invoice Items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id VARCHAR(50) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        hsn VARCHAR(10),
        qty DECIMAL(12, 3) NOT NULL,
        unit VARCHAR(20),
        rate DECIMAL(12, 2) NOT NULL,
        gst_rate INTEGER NOT NULL,
        amount DECIMAL(12, 2) NOT NULL
      )
    `);

    await client.query('COMMIT');
    console.log('Tables created successfully.');

    // Start seeding data if tables are empty
    await client.query('BEGIN');

    // Seed Customers
    const customerCount = await client.query('SELECT COUNT(*) FROM customers');
    if (parseInt(customerCount.rows[0].count) === 0) {
      console.log('Seeding customers...');
      await client.query(`
        INSERT INTO customers (name, gstin, address, state, phone, email) VALUES
        ('Kiran Enterprises', '29AAFFC8126N1ZZ', '12th Cross, Bangalore', 'Karnataka', '9876543210', 'kiran@example.com'),
        ('Raj Constructions', '29AABCR1234D1Z1', 'MG Road, Bangalore', 'Karnataka', '9876543211', 'raj@example.com'),
        ('Metro Builders', '29AABCM5678G1Z2', 'Whitefield, Bangalore', 'Karnataka', '9876543212', 'metro@example.com'),
        ('City Corp', '29AABCC9012H1Z3', 'Bangalore', 'Karnataka', '', '')
      `);
    }

    // Seed Products
    const productCount = await client.query('SELECT COUNT(*) FROM products');
    if (parseInt(productCount.rows[0].count) === 0) {
      console.log('Seeding products...');
      await client.query(`
        INSERT INTO products (name, hsn, unit, rate, gst_rate) VALUES
        ('12MM**', '1005', 'No', 500.00, 18),
        ('6MM TMT Bar', '7214', 'Kg', 65.00, 18),
        ('OPC Cement 53 Grade', '2523', 'Bag', 380.00, 28),
        ('River Sand', '2505', 'Ton', 1800.00, 5)
      `);
    }

    // Seed Company Profile
    const companyCount = await client.query('SELECT COUNT(*) FROM company_profile');
    if (parseInt(companyCount.rows[0].count) === 0) {
      console.log('Seeding company profile...');
      await client.query(`
        INSERT INTO company_profile (
          name, address, gstin, state, state_code, phone, email, 
          bank_name, bank_branch, bank_acc_no, bank_ifsc, bank_upi_id, 
          terms, logo_url, logo_size, contact_person, gemini_api_key
        ) VALUES (
          'Surabhi Hardwares, Bangalore', 'HSR Layout, Bangalore', '29AACCT3705E000', 'Karnataka', '29',
          '+91 878 8789 8789', 'contact@surabhihardwares.com',
          'ICICI', 'Surate', '2715500356', 'ICIC045F', 'ifox@icici',
          'Subject to Karnataka Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not be taken back.\nDelivery Ex-Premises.',
          '/logo.png', 70, 'Mr. Abhirati Jani', ''
        )
      `);
    }

    // Seed Invoices & Invoice Items
    const invoiceCount = await client.query('SELECT COUNT(*) FROM invoices');
    if (parseInt(invoiceCount.rows[0].count) === 0) {
      console.log('Seeding invoices and invoice items...');
      
      // Invoices
      await client.query(`
        INSERT INTO invoices (id, date, customer_name, gstin, taxable, cgst, sgst, igst, total, status) VALUES
        ('SHB/456/20', '20-Dec-20', 'Kiran Enterprises', '29AAFFC8126N1ZZ', 3500.00, 315.00, 315.00, 0.00, 4130.00, 'paid'),
        ('SHB/457/20', '22-Dec-20', 'Raj Constructions', '29AABCR1234D1Z1', 12000.00, 1080.00, 1080.00, 0.00, 14160.00, 'paid'),
        ('SHB/458/20', '24-Dec-20', 'Metro Builders', '29AABCM5678G1Z2', 8500.00, 765.00, 765.00, 0.00, 10030.00, 'pending'),
        ('SHB/459/20', '26-Dec-20', 'City Corp', '29AABCC9012H1Z3', 22000.00, 1980.00, 1980.00, 0.00, 25960.00, 'pending')
      `);

      // Invoice Items
      await client.query(`
        INSERT INTO invoice_items (invoice_id, name, hsn, qty, unit, rate, gst_rate, amount) VALUES
        ('SHB/456/20', '12MM**', '1005', 7.000, 'No', 500.00, 18, 3500.00),
        ('SHB/457/20', '6MM TMT Bar', '7214', 200.000, 'Kg', 60.00, 18, 12000.00),
        ('SHB/458/20', '12MM**', '1005', 17.000, 'No', 500.00, 18, 8500.00),
        ('SHB/459/20', '6MM TMT Bar', '7214', 200.000, 'Kg', 65.00, 18, 13000.00),
        ('SHB/459/20', 'OPC Cement 53 Grade', '2523', 23.684, 'Bag', 380.00, 18, 9000.00)
      `);
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database initialization:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
