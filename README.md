# 🚀 MDrive — Telegram-Powered Cloud Storage

MDrive is a premium, secure, and fully responsive self-hosted cloud drive application that turns your Telegram account/channels into **unlimited, free, and secure cloud storage**. Featuring a gorgeous, glassmorphic UI, lightning-fast media streaming, and recursive security validation, MDrive provides an ultra-premium cloud storage experience.

---

## ✨ Key Features

### 📁 Unlimited Storage & File Splitting

- **No File Size Limits**: Large files are automatically split into optimized chunks, uploaded concurrently to Telegram, and dynamically reconstructed upon download.
- **Physical Cleanup**: Deleting files completely purges all chunk messages from Telegram, keeping your account clean and organized.

### 🎨 State-of-the-Art User Interface

- **Glassmorphic Theme**: A modern interface featuring a vibrant dark-mode-first aesthetic with a custom interactive `PixelBackground` canvas.
- **Fully Responsive Design**: Sleek header, toolbar, file grid, and tables that dynamically adjust to fit mobile, tablet, and desktop screens with horizontal scroll safeguards.
- **Fluid Grid & Table Layouts**: Smooth switcher between compact, responsive grid cards and a horizontally-scrollable list view.
- **Multi-Select & Touch Friendly**: Seamless file selection on touch screens via persistent checkbox markers, with instant keyboard modifiers (`Ctrl`/`Shift`) for desktop power-users.

### 🔒 Core Security & High Performance

- **Hierarchical CTE Validations**: Bulletproof protection of public media streams and ZIP generators using Recursive Common Table Expressions (CTE). Files inside subfolders can only be streamed if they strictly descend from the shared parent.
- **Hashed Credentials**: Complete privacy protection—user phone numbers are kept confidential by storing SHA-256 hashes instead of raw digits in the database.
- **On-the-Fly ZIP Streams**: Download entire multi-level nested folders instantly using server-side zip streams supporting both administrator sessions and public share link tokens.
- **Unified Stream & Thumbnail Endpoints**: High-performance image and video thumbnail generation and media chunk-streaming centralized under `/stream` and `/thumbnail`.

---

## 🛠️ Architecture & Tech Stack

MDrive is built on a split Monorepo structure, ensuring a highly decoupled and efficient setup:

```
├── db/                     # Database schemas
│   └── schema.sql          # PostgreSQL database definitions
├── src/                    # Backend API Services (Express + Bun)
│   ├── http/               # Route controllers, middlewares, & SSE handlers
│   ├── repositories/       # High-performance DB query layers
│   ├── services/           # GramJS MTProto client & Telegram drive logic
│   └── config.ts           # Unified configuration layer
├── src-frontend/           # Modern UI SPA (Vite + React + TS)
│   ├── src/components/     # Modular UI elements, FileBrowser, & Pixel Blast canvas
│   ├── src/pages/          # Responsive pages (Dashboard, Auth, Share)
│   └── src/stores/         # State management (Zustand)
└── README.md
```

### **Backend Core**

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Express](https://expressjs.com/) with TypeScript
- **Telegram Client**: [GramJS](https://github.com/gram-js/gramjs) (MTProto Client)
- **Database**: [PostgreSQL](https://www.postgresql.org/)

### **Frontend Core**

- **Bundler & Tooling**: [Vite](https://vite.dev/) + React + TypeScript + Tailwind CSS
- **UI Components**: [HeroUI](https://heroui.com/)
- **Icons**: [Tabler Icons](https://tabler.io/icons)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)

---

## 🚀 Getting Started

### Prerequisites

- **Bun** (Recommended) or **Node.js**
- **PostgreSQL** instance running locally or remotely
- **Telegram API credentials**: Obtain your `API_ID` and `API_HASH` from [my.telegram.org](https://my.telegram.org/)

---

### 1. Backend Setup & Run

1. **Install dependencies**:

   ```bash
   bun install
   ```

2. **Configure your Environment variables**:
   Create a `.env` file in the root directory:

   ```env
   DATABASE_URL=postgres://your_user:your_password@localhost:5432/telegram_drive
   CORS_ORIGIN=http://localhost:5173
   PORT=3000
   ```

3. **Initialize the Database Schema**:

   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

4. **Start the Development Server**:
   ```bash
   bun run index.ts
   ```

   - The API will now be listening at `http://localhost:3002`
   - Open API Spec: `http://localhost:3002/openapi.json`
   - Scalar Interactive Docs: `http://localhost:3002/docs`

---

### 2. Frontend Setup & Run

1. **Navigate to the frontend folder**:

   ```bash
   cd src-frontend
   ```

2. **Install dependencies**:

   ```bash
   bun install
   ```

3. **Start the Development Server**:
   ```bash
   bun run dev
   ```

   - Open your browser and navigate to `http://localhost:5173` to experience MDrive!

---

## 📖 API Documentation & OpenAPI Spec

MDrive comes out of the box with fully documented OpenAPI specs. Interactive documentation is available under `/docs` when the API is running.

- **POST** `/api/auth/login` - Initiate session lifecycle
- **GET** `/api/files` - Search and navigate cached index folders
- **GET** `/api/stream` - High-speed media streaming (supports range requests)
- **GET** `/api/stream/zip` - Compresses requested folders into a zip stream on-the-fly
- **GET** `/api/thumbnail` - Fetches/generates responsive cached preview thumbnails
- **POST** `/api/index/refresh` - Force-refresh database directory cache with Telegram channel history
