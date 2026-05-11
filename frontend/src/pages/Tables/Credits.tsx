import PageMeta from "../../components/common/PageMeta";
import Credits from "../../components/tables/Credits";

export default function CreditsPage() {
  return (
    <>
      <PageMeta
        title="Credit Information - AI Recruiter Dashboard"
        description="Credit Information - AI Recruiter Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12">
          <Credits />
        </div>
      </div>
    </>
  );    
}



