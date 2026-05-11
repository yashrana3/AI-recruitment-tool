import PageMeta from "../../components/common/PageMeta";
import ExtractDataForm from "../../components/form/form-elements/ExtractDataForm";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";



export default function ExtractDataPage() {
  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <PageBreadcrumb pageTitle="Download Data" />
      <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12">
          <ExtractDataForm />
        </div>
      </div>
    </>
  );
}
