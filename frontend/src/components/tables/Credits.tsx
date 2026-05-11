import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CreditCard } from "lucide-react";
import PageBreadcrumb from "../common/PageBreadCrumb";
import { getTheirstackCredits, TheirStackCreditsResponse, getMantiksCredits, MantiksCreditsResponse, getCoresignalCredits, CoreSignalCreditsResponse, getSovrenCredits, SovrenCreditsResponse  } from "../../api/DashBoard.API";

export default function Credits() {
  const [theirstackCredits, setTheirstackCredits] = useState<TheirStackCreditsResponse | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [mantiksCredits, setMantiksCredits] = useState<MantiksCreditsResponse | null>(null);
  const [loadingMantiksCredits, setLoadingMantiksCredits] = useState(false);
  const [coresignalCredits, setCoresignalCredits] = useState<CoreSignalCreditsResponse | null>(null);
  const [loadingCoresignalCredits, setLoadingCoresignalCredits] = useState(false);
  const [sovrenCredits, setSovrenCredits] = useState<SovrenCreditsResponse | null>(null);
  const [loadingSovrenCredits, setLoadingSovrenCredits] = useState(false);

  // Fetch Mantiks credits
  const fetchMantiksCredits = useCallback(async () => {
    setLoadingMantiksCredits(true);
    try {
      const credits = await getMantiksCredits();
      setMantiksCredits(credits);
    } catch (error) {
      console.error("Error fetching Mantiks credits:", error);
      setMantiksCredits(null);
    } finally {
      setLoadingMantiksCredits(false);
    }
  }, []);

  // Fetch CoreSignal credits
  const fetchCoresignalCredits = useCallback(async () => {
    setLoadingCoresignalCredits(true);
    try {
      const credits = await getCoresignalCredits();
      setCoresignalCredits(credits);
    } catch (error) {
      console.error("Error fetching CoreSignal credits:", error);
      setCoresignalCredits(null);
    } finally {
      setLoadingCoresignalCredits(false);
    }
  }, []);

  // Fetch TheirStack credits
  const fetchTheirstackCredits = async () => {
    setLoadingCredits(true);
    try {
      const credits = await getTheirstackCredits();
      setTheirstackCredits(credits);
    } catch (error) {
      console.error("Error fetching TheirStack credits:", error);
      setTheirstackCredits(null);
    } finally {
      setLoadingCredits(false);
    }
  };

  const fetchSovrenCredits = useCallback(async () => {
    setLoadingSovrenCredits(true);
    try {
      const credits = await getSovrenCredits();
      setSovrenCredits(credits);
    } catch (error) {
      console.error("Error fetching Sovren credits:", error);
      setSovrenCredits(null);
    } finally {
      setLoadingSovrenCredits(false);
    }
  }, []);

  // Auto-load credits on mount
  useEffect(() => {
    fetchMantiksCredits();
    fetchCoresignalCredits();
    fetchTheirstackCredits();
    fetchSovrenCredits();
  }, [fetchMantiksCredits, fetchCoresignalCredits, fetchSovrenCredits]);

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-6">
        <PageBreadcrumb pageTitle="Credit Information" />
      </div>

      {/* TheirStack Credits Card */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  TheirStack API Credits
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Monitor your API credit balance
                </p>
              </div>
            </div>
            <button
              onClick={fetchTheirstackCredits}
              disabled={loadingCredits}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCredits ? 'animate-spin' : ''}`} />
              {loadingCredits ? 'Loading...' : 'Refresh Credits'}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          {theirstackCredits ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                  Credits Remaining
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                  {theirstackCredits.credits_remaining.toLocaleString()}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                  Credits Used
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                  {theirstackCredits.credits_used.toLocaleString()}
                </div>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                  Total Credits
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                  {theirstackCredits.credits_total.toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Click "Refresh Credits" to load credit information
            </div>
          )}
        </div>
      </div>

      {/* Mantiks Credits Card */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Mantiks API Credits
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Credits updated automatically after each job fetch
                  {mantiksCredits?.last_updated && (
                    <span className="ml-2 text-xs">
                      (Last updated: {new Date(mantiksCredits.last_updated).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={fetchMantiksCredits}
              disabled={loadingMantiksCredits}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loadingMantiksCredits ? 'animate-spin' : ''}`} />
              {loadingMantiksCredits ? 'Loading...' : 'Refresh Credits'}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          {mantiksCredits && mantiksCredits.credits_remaining !== null && mantiksCredits.credits_remaining !== undefined ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                  Credits Remaining
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                  {mantiksCredits.credits_remaining?.toLocaleString() || 'N/A'}
                </div>
              </div>
              {/* <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
                  Credits Used
                </div>
                <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">
                  {mantiksCredits.credits_used !== null && mantiksCredits.credits_used !== undefined 
                    ? mantiksCredits.credits_used.toLocaleString() 
                    : 'N/A'}
                </div>
              </div> */}
              {/* <div className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                  Total Credits
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                  {mantiksCredits.credits_total !== null && mantiksCredits.credits_total !== undefined 
                    ? mantiksCredits.credits_total.toLocaleString() 
                    : 'N/A'}
                </div>
              </div> */}
            </div>
          ) : mantiksCredits && mantiksCredits.message ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {mantiksCredits.message}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {loadingMantiksCredits ? 'Loading credits...' : 'No credits data available. Credits will be updated after the next Mantiks job fetch.'}
            </div>
          )}
        </div>
      </div>

      {/* CoreSignal Credits Card */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  CoreSignal API Credits
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Credits updated automatically after each job fetch
                  {coresignalCredits?.search_last_updated && (
                    <span className="ml-2 text-xs">
                      (Search: {new Date(coresignalCredits.search_last_updated).toLocaleString()})
                    </span>
                  )}
                  {coresignalCredits?.collect_last_updated && (
                    <span className="ml-2 text-xs">
                      (Collect: {new Date(coresignalCredits.collect_last_updated).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={fetchCoresignalCredits}
              disabled={loadingCoresignalCredits}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCoresignalCredits ? 'animate-spin' : ''}`} />
              {loadingCoresignalCredits ? 'Loading...' : 'Refresh Credits'}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          {coresignalCredits && (coresignalCredits.search_credits_remaining !== null || coresignalCredits.collect_credits_remaining !== null) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Search Credits */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-green-700 dark:text-green-400">
                    Search Credits Remaining
                  </div>
                  {coresignalCredits.search_last_updated && (
                    <span className="text-xs text-green-600 dark:text-green-500">
                      Updated: {new Date(coresignalCredits.search_last_updated).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                  {coresignalCredits.search_credits_remaining !== null && coresignalCredits.search_credits_remaining !== undefined
                    ? coresignalCredits.search_credits_remaining.toLocaleString()
                    : 'N/A'}
                </div>
              </div>
              {/* Collect Credits */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-purple-700 dark:text-purple-400">
                    Collect Credits Remaining
                  </div>
                  {coresignalCredits.collect_last_updated && (
                    <span className="text-xs text-purple-600 dark:text-purple-500">
                      Updated: {new Date(coresignalCredits.collect_last_updated).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                  {coresignalCredits.collect_credits_remaining !== null && coresignalCredits.collect_credits_remaining !== undefined
                    ? coresignalCredits.collect_credits_remaining.toLocaleString()
                    : 'N/A'}
                </div>
              </div>
            </div>
          ) : coresignalCredits && coresignalCredits.message ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {coresignalCredits.message}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {loadingCoresignalCredits ? 'Loading credits...' : 'No credits data available. Credits will be updated after the next CoreSignal job fetch.'}
            </div>
          )}
        </div>
      </div>
      {/* Sovren Credits Card */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Sovren API Credits
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Credits updated automatically after each parsing call
                  {sovrenCredits?.last_updated && (
                    <span className="ml-2 text-xs">
                      (Last updated: {new Date(sovrenCredits.last_updated).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={fetchSovrenCredits}
              disabled={loadingSovrenCredits}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSovrenCredits ? 'animate-spin' : ''}`} />
              {loadingSovrenCredits ? 'Loading...' : 'Refresh Credits'}
            </button>
          </div>
        </div>
        <div className="px-6 py-4">
          {sovrenCredits && sovrenCredits.credits_remaining !== null && sovrenCredits.credits_remaining !== undefined ? (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                Credits Remaining
              </div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-200">
                {sovrenCredits.credits_remaining?.toLocaleString() || 'N/A'}
              </div>
            </div>
          ) : sovrenCredits && sovrenCredits.message ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {sovrenCredits.message}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              {loadingSovrenCredits ? 'Loading credits...' : 'No credits data available. Credits will be updated after the next Sovren API call.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

