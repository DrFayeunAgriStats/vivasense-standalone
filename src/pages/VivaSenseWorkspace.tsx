import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { getVivaSenseMode, getProExpiresAt, subscribeVivaSenseMode } from "@/services/featureMode";
import { Sprout, LogOut } from "lucide-react";

export default function VivaSenseWorkspace() {
  const { user, signOut } = useAuth();
  const [mode, setMode] = useState(getVivaSenseMode());

  useEffect(() => {
    const unsubscribe = subscribeVivaSenseMode((newMode: string) => {
      setMode(newMode as typeof mode);
    });
    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-green-50">
      {/* Header */}
      <div className="bg-green-800 text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Sprout className="w-5 h-5 text-green-800" />
            </div>
            <div>
              <div className="font-bold">VivaSense</div>
              <div className="text-xs text-green-200">Agricultural Statistics</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-green-900 mb-6">Welcome to VivaSense</h1>

            {/* User Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
              <h2 className="font-semibold text-green-900 mb-4">Authenticated User</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Email:</span>
                  <span className="ml-2 font-mono text-gray-900">{user?.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">User ID:</span>
                  <span className="ml-2 font-mono text-gray-900 break-all">{user?.id}</span>
                </div>
                <div>
                  <span className="text-gray-600">Authenticated:</span>
                  <span className="ml-2 font-semibold text-green-700">✓ Yes</span>
                </div>
              </div>
            </div>

            {/* Mode Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h2 className="font-semibold text-blue-900 mb-4">VivaSense Subscription Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Current Plan:</span>
                  <span
                    className={`px-4 py-2 rounded-full font-semibold ${
                      mode === "pro"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {mode === "pro" ? "🎯 Pro" : "🆓 Free"}
                  </span>
                </div>
                {mode === "pro" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Expires:</span>
                    <span className="font-mono text-gray-900">
                      {getProExpiresAt() ? new Date(getProExpiresAt()!).toLocaleDateString() : "N/A"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder Content */}
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-600 mb-4">
                <p className="mb-2">📊 Analysis modules coming in the next phase</p>
                <p className="text-sm">
                  This milestone tests authentication and Pro-status checking only.
                </p>
              </div>
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                <strong>Milestone 1 Complete:</strong> ✓ Supabase auth working ✓ Pro/Free status readable
              </div>
            </div>

            {/* Debug Info */}
            <details className="mt-8 text-xs text-gray-600">
              <summary className="cursor-pointer font-semibold text-gray-700 hover:text-gray-900">
                Debug Info
              </summary>
              <pre className="mt-2 bg-gray-100 p-3 rounded overflow-x-auto">
                {JSON.stringify(
                  {
                    userId: user?.id,
                    email: user?.email,
                    mode,
                    expiresAt: getProExpiresAt(),
                    currentTime: new Date().toISOString(),
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
