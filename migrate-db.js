const { pool } = require('./db');

async function runMigration() {
  console.log('Running database migrations...');
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Add columns to company_profile table if they don't exist
    await client.query(`
      ALTER TABLE company_profile 
      ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
      ADD COLUMN IF NOT EXISTS email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100),
      ADD COLUMN IF NOT EXISTS bank_acc_no VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bank_upi_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS terms TEXT,
      ADD COLUMN IF NOT EXISTS logo_size INTEGER DEFAULT 70,
      ADD COLUMN IF NOT EXISTS gemini_api_key VARCHAR(255),
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255)
    `);
    console.log('Altered company_profile table.');

    // 2. Add columns to invoices table if they don't exist
    await client.query(`
      ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS journey_date VARCHAR(50),
      ADD COLUMN IF NOT EXISTS booking_branch VARCHAR(100),
      ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(100)
    `);
    console.log('Altered invoices table.');

    // 3. Alter invoice_items table name column to TEXT
    await client.query(`
      ALTER TABLE invoice_items ALTER COLUMN name TYPE TEXT
    `);
    await client.query(`
      ALTER TABLE company_profile ALTER COLUMN logo_url TYPE TEXT
    `);
    console.log('Altered database tables and column types.');

    // 4. Update the default seeded company profile with banking information if it matches Surabhi Hardwares
    // Or if there is any company profile, seed standard default values for banking
    const checkCompany = await client.query('SELECT * FROM company_profile LIMIT 1');
    if (checkCompany.rows.length > 0) {
      const co = checkCompany.rows[0];
      // Seed default banking details if not set
      if (!co.bank_name) {
        await client.query(`
          UPDATE company_profile SET
            phone = $1,
            email = $2,
            bank_name = $3,
            bank_branch = $4,
            bank_acc_no = $5,
            bank_ifsc = $6,
            bank_upi_id = $7,
            terms = $8
          WHERE id = $9
        `, [
          '+91 878 8789 8789',
          'contact@happyholidays.com',
          'ICICI',
          'Surate',
          '2715500356',
          'ICIC045F',
          'ifox@icici',
          'Subject to Maharashtra Junction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not be taken back.\nDelivery Ex-Premises.',
          co.id
        ]);
        console.log('Seeded default banking details on company profile.');
      }
    }

    // 5. Update the seeded invoices to have some default travel booking metadata so they render beautifully
    await client.query(`
      UPDATE invoices SET 
        journey_date = '10-Apr-2024',
        booking_branch = 'Ahmedabad',
        place_of_supply = 'Gujarat ( 24 )'
      WHERE id = 'SHB/459/20' AND journey_date IS NULL
    `);
    console.log('Updated sample invoice with travel metadata.');

    await client.query('COMMIT');
    console.log('Database migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during migration:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
