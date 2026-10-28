# ⚡ GST Billing & Invoice Management System

A modern, full-stack, cloud-connected GST Billing and Invoicing web and mobile application tailored for Indian businesses and service providers. Compliant with standard GST rules (CGST, SGST, IGST), featuring real-time Neon PostgreSQL database persistence, intelligent OCR bill scanning, UPI payment QR generation, company branding, and native Android packaging with Capacitor.

---

## 📸 Screenshots Showcase

### 1. Dashboard Overview
Interactive sales performance analytics, period-based revenue curves, real-time metrics, and instant access to recent invoices.

![Dashboard Overview](screenshots/dashboard.png)

---

### 2. Tax Invoice Preview & Print (A4 Format)
Official GST Tax Invoice ready for print/PDF export, complete with company branding logo, client billing details, HSN/SAC itemization, tax breakdown (CGST/SGST/IGST), bank details, and dynamic UPI QR code.

![Invoice Preview](screenshots/invoice_preview.png)

---

### 3. New Tax Invoice Creation & OCR Scanner
Intuitive form with client autofill, HSN code lookups, dynamic tax rate selection (5%, 12%, 18%, 28%), amount-in-words conversion, and AI-powered Camera/Bill OCR scan.

![New Invoice](screenshots/new_invoice.png)

---

### 4. Company Profile & Settings
Comprehensive settings panel allowing full customization of company details, state codes, bank credentials, UPI ID, terms & conditions, and custom logo upload with live preview and sizing controls.

![Settings Page](screenshots/settings.png)

---

### 5. Mobile Responsive Experience
Optimized mobile interface with quick navigation, bottom action bar, fast floating action button (FAB) for invoice creation, and touch-first card views.

<p align="center">
  <img src="screenshots/mobile_view.png" alt="Mobile View" width="380" />
</p>

---

## 🚀 Live Demo & Mobile App Downloads

| Platform | Access Link | Description |
| :--- | :--- | :--- |
| **🌐 Live Web App** | [gst-billing.firwithrj.workers.dev](https://gst-billing.firwithrj.workers.dev) | Cloudflare Workers edge deployment |
| **📱 Android APK (Debug)** | [Download `gst-billing-app.apk`](gst-billing-app.apk) | Direct APK install for testing |
| **📱 Android APK (Release)** | [Download `gst-billing-app-release.apk`](gst-billing-app-release.apk) | Optimized production APK |

---

## ✨ Key Features

- **GST Compliance Engine**:
  - Automatic identification of intrastate (CGST + SGST) vs interstate (IGST) transactions based on company state code and customer place of supply.
  - Standard GST rate slabs support: `5%`, `12%`, `18%`, and `28%`.
  - Automated number-to-words conversion in Indian Rupee format.
- **Dynamic Company Branding**:
  - Seamless company logo integration across sidebar, mobile header, invoices, and settings.
  - Real-time client-side logo caching via `localStorage` for instant loading without flash.
  - Adjustable logo display size in pixels.
- **UPI QR Code Payment Integration**:
  - Dynamically embeds a UPI payment QR code on generated invoices linked to the company UPI ID and exact bill total.
- **Bill-to-Invoice OCR Scanner**:
  - Multi-image bill capture and extraction using Gemini 1.5 Flash multimodal AI.
  - Local client-side fallback via Tesseract.js supporting multiple Indian and international languages.
- **Complete Master Management**:
  - **Customer Master**: Track client names, GSTIN/UIN, addresses, states, phones, and emails with auto-fill.
  - **Product Master**: Manage inventory items with default HSN/SAC codes, units, standard rates, and GST slabs.
  - **GST Rate Master**: Overview and classification of tax rates.
- **Export & Analytics**:
  - Single and bulk invoice PDF export and print formatting.
  - CSV export for filtered invoice periods and customer accounts.
  - HSN code sales summary and customer-wise analytical reports.
- **Theme Support**:
  - Instant Light Mode and Dark Mode toggle with persistent theme preference.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3, Tabler Icons, Plus Jakarta Sans font |
| **Backend API** | Node.js, Express.js, `pg` (PostgreSQL client) |
| **Database** | Neon Serverless PostgreSQL with connection pooling |
| **Edge Deployment**| Cloudflare Workers, Wrangler CLI |
| **Mobile App** | Capacitor 5, Android SDK, Gradle |

---

## 📁 Repository Structure

```text
BILLING/
├── android/                   # Native Android Capacitor project
│   ├── app/                   # Android app module & build manifests
│   ├── gradlew.bat            # Gradle wrapper executable
│   └── ...
├── public/                    # Static frontend web assets
│   ├── index.html             # Single-page application core & styles
│   ├── logo.png               # Default company branding logo
│   ├── gst-billing-app.apk    # Web-downloadable debug APK
│   └── gst-billing-app-release.apk # Web-downloadable release APK
├── screenshots/               # High-resolution screenshots for documentation
│   ├── dashboard.png
│   ├── new_invoice.png
│   ├── invoice_preview.png
│   ├── settings.png
│   └── mobile_view.png
├── .env                       # Environment variables (PORT, DATABASE_URL)
├── .env.template              # Environment variables template
├── capacitor.config.json      # Capacitor runtime configuration
├── db.js                      # PostgreSQL connection pool configuration
├── gst-billing-app.apk        # Compiled Android debug APK
├── gst-billing-app-release.apk# Compiled Android release APK
├── init-db.js                 # Database schema initialization and seed script
├── migrate-db.js              # Database migration script for schema updates
├── package.json               # Node.js dependencies and run scripts
├── server.js                  # Express backend REST API server
├── worker.js                  # Cloudflare Workers adapter entry point
├── wrangler.toml              # Cloudflare Workers deployment configuration
└── README.md                  # Project documentation
```

---

## 💻 Getting Started Locally

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [PostgreSQL](https://www.postgresql.org/) or a free [Neon](https://neon.tech/) cloud database instance
- (Optional for APK compilation) [Java JDK 17+](https://adoptium.net/) & [Android Studio / SDK](https://developer.android.com/studio)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd BILLING
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (refer to `.env.template`):
```env
PORT=3000
DATABASE_URL=postgresql://username:password@your-neon-host/neondb?sslmode=require
```

### 4. Database Setup & Migrations
Initialize the schema and seed sample customers and products:
```bash
node init-db.js
node migrate-db.js
```

### 5. Run the Local Development Server
```bash
npm start
# or with auto-restart on changes:
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🚢 Deployment

### Cloudflare Workers
Deploy the backend API and static web app to Cloudflare Workers with:
```bash
npm run deploy
# which executes: wrangler deploy
```

---

## 📱 Building the Android APK

1. **Sync Web Assets with Capacitor**:
   ```bash
   npx cap copy
   ```

2. **Assemble Debug APK**:
   ```bash
   cd android
   ./gradlew.bat assembleDebug
   ```
   The built APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Assemble Release APK**:
   ```bash
   cd android
   ./gradlew.bat assembleRelease
   ```
   The built APK will be located at:
   `android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## 📄 License

This project is licensed under the [ISC License](package.json).
