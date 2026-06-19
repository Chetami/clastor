import { useAuth } from "../../contexts/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Examify TMS</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.email} ({user?.role})
              </span>
              <button
                onClick={() => logout()}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-800"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Welcome to the Dashboard</h2>
            <p className="text-gray-600 mb-4">
              You are logged in as <span className="font-semibold">{user?.role}</span>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-semibold text-blue-900 mb-2">User Information</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>UID:</strong> {user?.uid}</li>
                <li><strong>Email:</strong> {user?.email}</li>
                <li><strong>Role:</strong> {user?.role}</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
