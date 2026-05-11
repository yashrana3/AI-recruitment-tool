
import PageMeta from "../../components/common/PageMeta";
import UserManagement from "../../components/tables/UserManagement";
import { useUserRole } from "../../hooks/useUserRole";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

export default function Users() {
    const { isAdmin, isViewer } = useUserRole();
    
    // Redirect viewers away from user management page
    if (isViewer) {
        return (
            <>
                <PageMeta
                    title="Access Denied"
                    description="Access Denied"
                />
                <PageBreadcrumb pageTitle="Access Denied" />
                <div className="grid grid-cols-12 gap-4 md:gap-6">
                    <div className="col-span-12">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden p-8">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                                    Access Denied
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 mb-6">
                                    You do not have permission to access User Management. This page is restricted to administrators only.
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-500">
                                    Please contact an administrator if you need access.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    
    return (
        <>
            <PageMeta
                title="AI Recruiter Dashboard"
                description="AI Recruiter Dashboard"
            />
            {/* <PageBreadcrumb pageTitle="Schedulers" /> */}
            <div className="grid grid-cols-12 gap-4 md:gap-6">

        <div className="col-span-12">
          <UserManagement />
        </div>

      </div>
        </>)
}
