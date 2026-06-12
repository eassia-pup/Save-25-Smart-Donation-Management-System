# 🎗️ Save 25: Smart Donation Management System

Ang **Save 25** ay isang modernong web application na binuo upang mapadali at maging "smart" ang pamamahala ng mga donasyon, mga kampanya (campaigns), imbentaryo ng tulong, at pamamahagi ng relief goods sa mga nangangailangan.

## 🚀 Pangunahing Features
*   **User Control & Auth:** Ligtas na registration at login para sa mga Donors at Administrators gamit ang Supabase.
*   **Event Campaigns:** Paglikha at pagsubaybay sa mga aktibong kampanya ng donasyon.
*   **Payment Processing:** Integrasyon sa **PayMongo API** para sa mabilis at ligtas na online donations (GCash, Maya, Cards, etc.).
*   **Inventory & Resource Management:** Real-time na pagsubaybay sa mga donasyong natatanggap (food, medicine, hygiene kits) sa warehouse.
*   **Logistics & Distribution:** Pag-iskedyul at pag-manage ng distribusyon ng relief goods sa mga nasalantang lugar.
*   **Interactive Analytics Dashboard:** Visual charts para sa donation trends at logistik gamit ang **Recharts**.

## 🛠️ Tech Stack
*   **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui
*   **Backend & Database:** Supabase (PostgreSQL, Auth, Row-Level Security)
*   **Payment Gateway:** PayMongo API
*   **Libraries:** Recharts (Analytics), jsPDF (Reports), @dnd-kit (Drag-and-Drop)

## 💻 Paano Patakbuhin sa Local
1. I-install ang dependencies:
   ```bash
   npm install
   ```
2. Patakbuhin ang development server:
   ```bash
   npm run dev
   ```
