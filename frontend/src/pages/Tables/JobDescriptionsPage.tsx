import PageMeta from "../../components/common/PageMeta";
import JobDescriptions from "../../components/tables/JobDescriptions";

export default function JobDescriptionTable() {
  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12">
          <JobDescriptions />
        </div>

      </div>
    </>
  );
}
