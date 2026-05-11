import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  const navigate = useNavigate();

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // User is already authenticated, redirect to dashboard
      navigate("/", { replace: true });
    }
  }, [navigate]);

  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}
