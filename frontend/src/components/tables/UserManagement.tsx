import { useEffect, useState } from "react";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ChangePasswordModal from "../common/ChangePasswordModal";
import CreateUserModal from "../common/CreateUserModal";
import { getUsers, deleteUser } from "../../api/Auth.api";
import { Search, X, Trash2, Key } from "lucide-react";
import { useUserRole } from "../../hooks/useUserRole";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  joinDate?: string;
  status: "active" | "inactive";
  lastLogin?: string;
}

const dummyUsers: User[] = [
  {
    id: 1,
    name: "John Smith",
    email: "john.smith@company.com",
    role: "Senior Full Stack Developer",
    department: "Engineering",
    phone: "+1-555-0101",
    joinDate: "2023-01-15",
    status: "active",
    lastLogin: "2024-12-04"
  },
  {
    id: 2,
    name: "Sarah Johnson",
    email: "sarah.johnson@company.com",
    role: "Product Manager",
    department: "Product",
    phone: "+1-555-0102",
    joinDate: "2022-06-20",
    status: "active",
    lastLogin: "2024-12-03"
  },
  {
    id: 3,
    name: "Michael Chen",
    email: "michael.chen@company.com",
    role: "UX/UI Designer",
    department: "Design",
    phone: "+1-555-0103",
    joinDate: "2023-03-10",
    status: "active",
    lastLogin: "2024-12-02"
  },
  {
    id: 4,
    name: "Emily Davis",
    email: "emily.davis@company.com",
    role: "Data Scientist",
    department: "Analytics",
    phone: "+1-555-0104",
    joinDate: "2022-09-05",
    status: "inactive",
    lastLogin: "2024-11-20"
  },
  {
    id: 5,
    name: "David Wilson",
    email: "david.wilson@company.com",
    role: "DevOps Engineer",
    department: "Infrastructure",
    phone: "+1-555-0105",
    joinDate: "2023-05-12",
    status: "active",
    lastLogin: "2024-12-04"
  },
  {
    id: 6,
    name: "Jessica Martinez",
    email: "jessica.martinez@company.com",
    role: "Backend Developer",
    department: "Engineering",
    phone: "+1-555-0106",
    joinDate: "2023-02-28",
    status: "active",
    lastLogin: "2024-12-01"
  },
  {
    id: 7,
    name: "Robert Taylor",
    email: "robert.taylor@company.com",
    role: "Frontend Developer",
    department: "Engineering",
    phone: "+1-555-0107",
    joinDate: "2022-11-08",
    status: "active",
    lastLogin: "2024-12-04"
  },
  {
    id: 8,
    name: "Amanda Brown",
    email: "amanda.brown@company.com",
    role: "HR Manager",
    department: "Human Resources",
    phone: "+1-555-0108",
    joinDate: "2021-07-22",
    status: "active",
    lastLogin: "2024-12-03"
  }
];

export default function UserManagement() {
  const { isAdmin, isViewer } = useUserRole();
  const [users, setUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const usersPerPage = 10;

  // Hide entire component for viewers
  if (isViewer) {
    return (
      <div className="w-full overflow-x-hidden">
        <div className="mb-6">
          <PageBreadcrumb pageTitle="Access Denied" />
        </div>
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
    );
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getUsers();
      // Map API response to User interface
      const mappedUsers: User[] = data.map((user: any) => ({
        id: user.id,
        name: user.email.split("@")[0], // Use email prefix as name
        email: user.email,
        role: user.role === "admin" ? "Administrator" : "Viewer",
        status: user.is_active ? "active" : "inactive",
      }));
      setUsers(mappedUsers);
    } catch (err) {
      console.error("Error fetching users:", err);
      // Fallback to dummy data if API fails
      setUsers(dummyUsers);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 35000);
    return () => clearInterval(interval);
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    );
  });

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const totalCount = filteredUsers.length;

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const maxVisiblePages = 4;
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  const visiblePages = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  const handleChangePasswordClick = (user: User) => {
    if (isViewer) {
      alert("Viewers do not have access to change user passwords. Please contact an administrator.");
      return;
    }
    setSelectedUser(user);
    setShowChangePasswordModal(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (isViewer) {
      alert("Viewers do not have access to delete users. Please contact an administrator.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user ${user.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(user.id);
      alert("User deleted successfully");
      // Refresh users list
      fetchUsers();
      // Reset to first page if current page becomes empty
      if (currentUsers.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Failed to delete user";
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleCloseModal = () => {
    setShowChangePasswordModal(false);
    setSelectedUser(null);
  };

  const getStatusBadgeColor = (status: "active" | "inactive") => {
    return status === "active"
      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
      : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const clearSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-6">
        <PageBreadcrumb pageTitle="User Management" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                User Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {totalCount} {totalCount === 1 ? "user" : "users"} found
              </p>
            </div>
            {isAdmin ? (
              <button
                onClick={() => {
                  if (!isAdmin) {
                    alert("Viewers do not have access to create users. Please contact an administrator.");
                    return;
                  }
                  setShowCreateUserModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95"
              >
                + Create New User
              </button>
            ) : (
              <button
                disabled
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  alert("Viewers do not have access to create users. Please contact an administrator.");
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 pointer-events-none"
                title="Viewers do not have access to create users"
              >
                + Create New User
              </button>
            )}
          </div>
          
          {/* Search Input */}
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
              </button>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {isAdmin && (
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                )}
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading && currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery ? "No users found matching your search" : "No users found"}
                    </p>
                  </td>
                </tr>
              ) : (
                currentUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  >
                    {isAdmin && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleChangePasswordClick(user)}
                            className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          >
                            <Key className="w-4 h-4" />
                            Password
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(user.status)}`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > usersPerPage && (
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                Page {currentPage} of {totalPages || 1}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, currentPage - 2);
                  const page = startPage + i;
                  if (page > totalPages) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm ${
                        currentPage === page
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                          : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Password Modal */}
      {showChangePasswordModal && selectedUser && isAdmin && (
        <ChangePasswordModal
          user={selectedUser}
          onClose={handleCloseModal}
          isAdmin={true} // Admin can change any user's password
        />
      )}

      {/* Create User Modal */}
      {showCreateUserModal && isAdmin && (
        <CreateUserModal
          onClose={() => setShowCreateUserModal(false)}
          onSuccess={() => {
            fetchUsers(); // Refresh users list
          }}
        />
      )}
    </div>
  );
}