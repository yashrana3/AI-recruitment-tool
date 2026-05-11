
import { BrowserRouter as Router, Routes, Route } from "react-router";
import "./app.css";
import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";

import JobDescriptionTable from "./pages/Tables/JobDescriptionsPage";
import SchedulersTable from "./pages/Tables/Schedulers";
import CreditsPage from "./pages/Tables/Credits";
import ExtractDataPage from "./pages/Forms/ExtractDataPage";
import UploadResumePage from "./pages/Forms/UploadresumePage";

import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import ResumeTable from "./pages/Tables/ResumeTable";
import MatchedCandidate from "./pages/Tables/MatchedCandidate";
import Users from "./pages/Tables/Users";
import ProtectedRoute from "./components/auth/ProtectedRoute";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index path="/" element={<Home />} />

              {/* Others Page */}
              <Route path="/profile" element={<UserProfiles />} />

              {/* Forms */}
              <Route path="/data" element={<ExtractDataPage />} />
              <Route path="/upload-resume" element={<UploadResumePage />} />

              {/* Tables */}
              <Route
                path="/job-descriptions"
                element={<JobDescriptionTable />}
              />
              <Route path="/schedulers" element={<SchedulersTable />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="/resumes" element={<ResumeTable />} />
              
              <Route path="/matched-candidate" element={<MatchedCandidate />} />
              <Route path="/users" element={<Users />} />
            </Route>
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </>
  );
}
