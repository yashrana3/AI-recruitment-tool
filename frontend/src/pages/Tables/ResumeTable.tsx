import PageMeta from "../../components/common/PageMeta";
import Resumes from "../../components/tables/Resumes";

export default function ResumeTable() {
  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12">
          <Resumes />
        </div>

      </div>
    </>
  );    
}
