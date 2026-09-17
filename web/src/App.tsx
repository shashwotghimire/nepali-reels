import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Library from "./pages/Library";
import Analytics from "./pages/Analytics";
import Connections from "./pages/Connections";
import PipelineDetail from "./pages/PipelineDetail";
import Landing from "./pages/Landing";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import PublicRoute from "./components/auth/PublicRoute";
import AppLayout from "./components/common/AppLayout";
import Phase3VisualReview from "./pages/Phase3VisualReview";
import Settings from "./pages/Settings";
import Phase4VisualReview from "./pages/Phase4VisualReview";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/__phase3-review"
          element={import.meta.env.DEV ? <Phase3VisualReview /> : <NotFound />}
        />
        <Route path="/__phase4-review" element={import.meta.env.DEV ? <Phase4VisualReview /> : <NotFound />} />
        <Route element={<PublicRoute />}>
          <Route path="/" element={<Landing />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/connections" element={<Connections />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="/dashboard/pipeline/:id"
              element={<PipelineDetail />}
            />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
