# Save 25: Smart Donation Management System

Save 25 is a modern web application designed to facilitate and streamline the management of donations, campaigns, relief aid inventory, and logistics and distribution to communities in need.

## Core Features
*   **User Control and Authentication:** Secure registration and login for both Donors and Administrators using Supabase.
*   **Event Campaigns:** Creation, management, and tracking of active donation campaigns.
*   **Payment Processing:** Integration with the PayMongo API for quick and secure online donations (including GCash, Maya, and credit cards).
*   **Inventory and Resource Management:** Real-time tracking of received donations (food, medicine, and hygiene kits) in the warehouse.
*   **Logistics and Distribution:** Scheduling and coordination of relief goods distribution to affected areas.
*   **Interactive Analytics Dashboard:** Visual charts displaying donation trends and logistics status using Recharts.

## Tech Stack
*   **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui
*   **Backend and Database:** Supabase (PostgreSQL, Auth, Row-Level Security)
*   **Payment Gateway:** PayMongo API
*   **Libraries:** Recharts (Analytics), jsPDF (Reports), @dnd-kit (Drag-and-Drop)

## How to Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
