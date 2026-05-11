import PageMeta from "../../components/common/PageMeta";
import UploadResumeForm from "../../components/form/form-elements/UploadResumeForm";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

export default function UploadResumePage() {
  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <PageBreadcrumb pageTitle="Upload Resume" />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <UploadResumeForm />
        </div>
      </div>
    </>
  );
}