import JobDescriptions from "../../components/tables/JobDescriptions";
import PageMeta from "../../components/common/PageMeta";
import SchedulerForm from "../../components/form/form-elements/SchedularForm";
import { useUserRole } from "../../hooks/useUserRole";


export default function Home() {
  const { isAdmin } = useUserRole();
  
  return (
    <>
      <PageMeta
        title="AI Recruiter Dashboard"
        description="AI Recruiter Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">

        {isAdmin && (
          <div className="col-span-12">
            <SchedulerForm />
          </div>
        )}

        {!isAdmin && (
          <div className="col-span-12">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                <strong>Note:</strong> Viewers do not have access to create schedulers or match resumes. Please contact an administrator for these actions.
              </p>
            </div>
          </div>
        )}

        <div className="col-span-12">
          <JobDescriptions />
        </div>

      </div>
    </>
  );
}
