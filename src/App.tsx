import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { ProtectedRoute } from "@/components/module/protected-route"
import LoginPage from "./app/donor/login/page"
import SignupPage from "./app/donor/signup/page"
import ForgotPasswordPage from "./app/donor/forgot-password/page"
import ResetPasswordPage from "./app/donor/reset-password/page"
import DashboardPage from "./app/dashboard/page"
import DonorPage from "./app/donor/donor-campaign/page"
import ProfilePage from "./app/donor/profile/page"
import TransactionsPage from "./app/donor/transactions/page"
import AdminCampaignsPage from "./app/admin/campaigns/page"
import InventoryPage from "./app/admin/inventory/page"
import AdminLogisticsPage from "./app/admin/logistics/page"
import AdminAnalyticsPage from "./app/admin/analytics/page"
import FindAccountPage from "./app/donor/find-account/page"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/find-account" element={<FindAccountPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor"
          element={
            <ProtectedRoute>
              <DonorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <ProtectedRoute>
              <AdminCampaignsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/logistics"
          element={
            <ProtectedRoute>
              <AdminLogisticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <AdminAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <TransactionsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<LoginPage />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}

export default App
