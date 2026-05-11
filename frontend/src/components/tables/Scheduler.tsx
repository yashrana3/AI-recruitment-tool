import ReactSelect from "react-select";
import { useState, useEffect } from "react";
import { Trash2, Eye, Play, Square, History, Edit } from "lucide-react";
import PageBreadcrumb from "../common/PageBreadCrumb";
import { getSchedulers, deleteScheduler, startScheduler, stopScheduler, getSchedulerRuns, SchedulerData, SchedulerRun, updateSchedulerPayload, getMappings, TechnologyMapping, createMapping, getSchedulerRunJobs, JobData } from "../../api/DashBoard.API";
import { useUserRole } from "../../hooks/useUserRole";

export default function Scheduler() {
  const { isAdmin, isViewer } = useUserRole();
  const [tableData, setTableData] = useState<SchedulerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<SchedulerData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<SchedulerRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalSchedulers, setTotalSchedulers] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingScheduler, setEditingScheduler] = useState<SchedulerData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [countryCodeMap, setCountryCodeMap] = useState<Map<string, string>>(new Map());
  const [mantiksLocationMap, setMantiksLocationMap] = useState<Map<number, string>>(new Map());
  const [mappingsLoaded, setMappingsLoaded] = useState(false);

  // Job details modal state
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runJobs, setRunJobs] = useState<JobData[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Edit form state
  const [editLimit, setEditLimit] = useState<number>(1);
  const [editInterval, setEditInterval] = useState<"1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly">("daily");
  const [editSkills, setEditSkills] = useState<string[]>([]);

  // Location state (varies by API)
  const [editCity, setEditCity] = useState<string>("");
  const [editCountry, setEditCountry] = useState<string>("");
  const [editLocationPattern, setEditLocationPattern] = useState<string[]>([]);
  const [editCountryCodes, setEditCountryCodes] = useState<string[]>([]);
  const [editMantiksLocationIds, setEditMantiksLocationIds] = useState<number[]>([]);
  // Skills dropdown state for Edit modal
  const [selectedEditTechnologies, setSelectedEditTechnologies] = useState<{ keyword: string; slug: string }[]>([]);
  const [editTechnologyInput, setEditTechnologyInput] = useState("");
  const [editTechnologyInputPreserved, setEditTechnologyInputPreserved] = useState("");
  const [editTechnologyOptions, setEditTechnologyOptions] = useState<{ value: string; label: string; slug: string }[]>([]);
  const [isLoadingEditTechnologies, setIsLoadingEditTechnologies] = useState(false);

  // CoreSignal country dropdown state
  const [selectedEditCountries, setSelectedEditCountries] = useState<{ keyword: string; slug: string }[]>([]);
  const [editCountryInput, setEditCountryInput] = useState("");
  const [editCountryOptions, setEditCountryOptions] = useState<{ value: string; label: string; slug: string }[]>([]);
  const [isLoadingEditCountries, setIsLoadingEditCountries] = useState(false);

  // TheirStack country dropdown state
  const [selectedEditTheirstackCountries, setSelectedEditTheirstackCountries] = useState<{ keyword: string; slug: string }[]>([]);
  const [editTheirstackCountryInput, setEditTheirstackCountryInput] = useState("");
  const [editTheirstackCountryOptions, setEditTheirstackCountryOptions] = useState<{ value: string; label: string; slug: string }[]>([]);
  const [isLoadingEditTheirstackCountries, setIsLoadingEditTheirstackCountries] = useState(false);

  // Mantiks location dropdown state
  const [selectedEditMantiksLocations, setSelectedEditMantiksLocations] = useState<{ keyword: string; slug: string }[]>([]);
  const [editMantiksLocationInput, setEditMantiksLocationInput] = useState("");
  const [editMantiksLocationOptions, setEditMantiksLocationOptions] = useState<{ value: string; label: string; slug: string }[]>([]);
  const [isLoadingEditMantiksLocations, setIsLoadingEditMantiksLocations] = useState(false);

  // Fetch schedulers from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const response = await getSchedulers(itemsPerPage, offset);
        setTableData(response.schedulers);
        setTotalSchedulers(response.total);
      } catch (error) {
        console.error("Error fetching schedulers:", error);
        setTableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage]);

  const totalPages = Math.ceil(totalSchedulers / itemsPerPage);
  const startItem = totalSchedulers === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalSchedulers);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        // Load country codes mapping
        const countries = await getMappings({ q: "", limit: 1000, datapoint: "countries" });
        const countryMap = new Map<string, string>();
        countries.forEach((c: TechnologyMapping) => {
          // Map slug (code) to keyword (name)
          if (c.slug && c.keyword) {
            countryMap.set(c.slug.toUpperCase(), c.keyword);
          }
        });
        setCountryCodeMap(countryMap);

        // Load Mantiks location IDs mapping
        const mantiksLocations = await getMappings({ q: "", limit: 1000, datapoint: "mantiks_countries" });
        const mantiksMap = new Map<number, string>();
        mantiksLocations.forEach((m: TechnologyMapping) => {
          // Map slug (ID) to keyword (name)
          if (m.slug && m.keyword) {
            const id = Number(m.slug);
            if (!isNaN(id)) {
              mantiksMap.set(id, m.keyword);
            }
          }
        });
        setMantiksLocationMap(mantiksMap);

        setMappingsLoaded(true);
      } catch (error) {
        console.error("Error loading location mappings:", error);
      }
    };

    loadMappings();
  }, []);

  // Fetch technologies for Edit modal with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!editTechnologyInput || !showEditModal) {
        setEditTechnologyOptions([]);
        setIsLoadingEditTechnologies(false);
        return;
      }

      const fetchTechnologies = async () => {
        setIsLoadingEditTechnologies(true);
        try {
          const data = await getMappings({
            q: editTechnologyInput,
            limit: 20,
            datapoint: "technologies",
          });
          setEditTechnologyOptions(
            data.map((tech: TechnologyMapping) => ({
              value: tech.keyword,
              label: tech.keyword,
              slug: tech.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch technologies:", err);
          setEditTechnologyOptions([]);
        } finally {
          setIsLoadingEditTechnologies(false);
        }
      };

      fetchTechnologies();
    }, 300);

    return () => clearTimeout(handler);
  }, [editTechnologyInput, showEditModal]);

  // Fetch countries for CoreSignal Edit modal with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!editCountryInput || !showEditModal || editingScheduler?.api_name.toLowerCase() !== "coresignal") {
        setEditCountryOptions([]);
        setIsLoadingEditCountries(false);
        return;
      }

      const fetchCountries = async () => {
        setIsLoadingEditCountries(true);
        try {
          const data = await getMappings({
            q: editCountryInput,
            limit: 20,
            datapoint: "countries",
          });
          setEditCountryOptions(
            data.map((country: TechnologyMapping) => ({
              value: country.keyword,
              label: country.keyword,
              slug: country.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch countries:", err);
          setEditCountryOptions([]);
        } finally {
          setIsLoadingEditCountries(false);
        }
      };

      fetchCountries();
    }, 300);

    return () => clearTimeout(handler);
  }, [editCountryInput, showEditModal, editingScheduler?.api_name]);

  // Fetch countries for TheirStack Edit modal with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!editTheirstackCountryInput || !showEditModal || editingScheduler?.api_name.toLowerCase() !== "theirstack") {
        setEditTheirstackCountryOptions([]);
        setIsLoadingEditTheirstackCountries(false);
        return;
      }

      const fetchCountries = async () => {
        setIsLoadingEditTheirstackCountries(true);
        try {
          const data = await getMappings({
            q: editTheirstackCountryInput,
            limit: 20,
            datapoint: "countries",
          });
          setEditTheirstackCountryOptions(
            data.map((country: TechnologyMapping) => ({
              value: country.keyword,
              label: country.keyword,
              slug: country.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch countries:", err);
          setEditTheirstackCountryOptions([]);
        } finally {
          setIsLoadingEditTheirstackCountries(false);
        }
      };

      fetchCountries();
    }, 300);

    return () => clearTimeout(handler);
  }, [editTheirstackCountryInput, showEditModal, editingScheduler?.api_name]);

  // Fetch Mantiks locations for Edit modal with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!editMantiksLocationInput || !showEditModal || editingScheduler?.api_name.toLowerCase() !== "mantiks") {
        setEditMantiksLocationOptions([]);
        setIsLoadingEditMantiksLocations(false);
        return;
      }

      const fetchLocations = async () => {
        setIsLoadingEditMantiksLocations(true);
        try {
          const data = await getMappings({
            q: editMantiksLocationInput,
            limit: 20,
            datapoint: "mantiks_countries",
          });
          setEditMantiksLocationOptions(
            data.map((location: TechnologyMapping) => ({
              value: location.keyword,
              label: location.keyword,
              slug: location.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch Mantiks locations:", err);
          setEditMantiksLocationOptions([]);
        } finally {
          setIsLoadingEditMantiksLocations(false);
        }
      };

      fetchLocations();
    }, 300);

    return () => clearTimeout(handler);
  }, [editMantiksLocationInput, showEditModal, editingScheduler?.api_name]);

  // Helper function to get country name from code
  const getCountryName = (code: string): string | null => {
    if (!code) return null;
    return countryCodeMap.get(code.toUpperCase()) || null;
  };

  // Helper function to get Mantiks location name from ID
  const getMantiksLocationName = (id: number): string | null => {
    if (!id) return null;
    return mantiksLocationMap.get(id) || null;
  };

  // Handler to add new skill in Edit modal
  const handleAddEditSkill = async () => {
    const inputToUse = editTechnologyInput.trim() || editTechnologyInputPreserved.trim();
    const trimmed = inputToUse;
    if (!trimmed) {
      alert("Please enter a skill name");
      return;
    }

    try {
      // Check if skill already exists
      if (selectedEditTechnologies.some(skill => skill.keyword.toLowerCase() === trimmed.toLowerCase())) {
        alert("This skill is already added");
        setEditTechnologyInput("");
        return;
      }

      // Create mapping in database
      const response = await createMapping({ raw: trimmed });

      // Add to selected skills
      const newSkill = {
        keyword: response.raw,
        slug: response.mapped,
      };
      setSelectedEditTechnologies([...selectedEditTechnologies, newSkill]);
      setEditTechnologyInput("");
      setEditTechnologyInputPreserved("");

      // Refresh the options list
      const data = await getMappings({
        q: trimmed,
        limit: 20,
        datapoint: "technologies",
      });
      setEditTechnologyOptions(
        data.map((tech: TechnologyMapping) => ({
          value: tech.keyword,
          label: tech.keyword,
          slug: tech.slug,
        })),
      );
    } catch (error: any) {
      console.error("Error adding skill:", error);
      if (error.response?.data?.detail) {
        alert(`Error: ${error.response.data.detail}`);
      } else {
        alert("Failed to add skill. Please try again.");
      }
    }
  };



  const handleDelete = async (schedulerId: string) => {
    if (isViewer) {
      alert("Viewers do not have access to delete schedulers. Please contact an administrator.");
      return;
    }
    if (!confirm("Are you sure you want to delete this scheduler?")) return;

    try {
      await deleteScheduler(schedulerId);
      // Remove from local state after successful deletion
      setTableData((prev) =>
        prev.filter((s) => s.scheduler_id !== schedulerId)
      );
      // Close modal if it's open
      if (selectedRow?.scheduler_id === schedulerId) {
        setShowModal(false);
        setSelectedRow(null);
      }
    } catch (err) {
      console.error("Error deleting scheduler:", err);
      alert("Failed to delete scheduler. Please try again.");
    }
  };

  const handleView = (row: SchedulerData) => {
    setSelectedRow(row);
    setShowModal(true);
  };

  const handleStart = async (schedulerId: string) => {
    if (isViewer) {
      alert("Viewers do not have access to start schedulers. Please contact an administrator.");
      return;
    }

    // Update local state immediately for instant UI feedback
    setTableData((prev) =>
      prev.map((s) =>
        s.scheduler_id === schedulerId ? { ...s, is_active: true } : s
      )
    );

    try {
      await startScheduler(schedulerId);
      // Refresh the list in background to get latest data
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getSchedulers(itemsPerPage, offset);
      setTableData(response.schedulers);
      setTotalSchedulers(response.total);
    } catch (err) {
      console.error("Error starting scheduler:", err);
      // Revert on error
      setTableData((prev) =>
        prev.map((s) =>
          s.scheduler_id === schedulerId ? { ...s, is_active: false } : s
        )
      );
      alert("Failed to start scheduler. Please try again.");
    }
  };

  const handleStop = async (schedulerId: string) => {
    if (isViewer) {
      alert("Viewers do not have access to stop schedulers. Please contact an administrator.");
      return;
    }

    // Update local state immediately for instant UI feedback
    setTableData((prev) =>
      prev.map((s) =>
        s.scheduler_id === schedulerId ? { ...s, is_active: false } : s
      )
    );

    try {
      await stopScheduler(schedulerId);
      // Refresh the list in background to get latest data
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getSchedulers(itemsPerPage, offset);
      setTableData(response.schedulers);
      setTotalSchedulers(response.total);
    } catch (err) {
      console.error("Error stopping scheduler:", err);
      // Revert on error
      setTableData((prev) =>
        prev.map((s) =>
          s.scheduler_id === schedulerId ? { ...s, is_active: true } : s
        )
      );
      alert("Failed to stop scheduler. Please try again.");
    }
  };

  const handleEdit = (row: SchedulerData) => {
    // Open modal immediately for better UX
    setEditingScheduler(row);
    setShowEditModal(true);

    // Parse payload to populate form (synchronous, fast)
    try {
      const payload = row.payload_json ? JSON.parse(row.payload_json) : {};

      // Set limit
      setEditLimit(payload.limit || 1);

      // Set interval
      if (row.interval_type) {
        setEditInterval(row.interval_type.toLowerCase() as any);
      }

      // Set skills based on API type - use simple mapping first (fast)
      const apiName = row.api_name.toLowerCase();
      let skillsArray: string[] = [];
      if (apiName === "coresignal" && payload.skills) {
        skillsArray = Array.isArray(payload.skills) ? payload.skills : [];
      } else if (apiName === "theirstack" && payload.job_technology_slug) {
        skillsArray = Array.isArray(payload.job_technology_slug) ? payload.job_technology_slug : [];
      } else if (apiName === "mantiks" && payload.job_description) {
        skillsArray = Array.isArray(payload.job_description) ? payload.job_description : [];
      }

      // Use simple mapping first (fast, no API call)
      const technologyObjects: { keyword: string; slug: string }[] = skillsArray.map(skill => ({
        keyword: skill,
        slug: skill.toLowerCase(),
      }));

      setSelectedEditTechnologies(technologyObjects);
      setEditSkills(skillsArray);

      // Set location based on API type - use pre-loaded maps (fast)
      if (apiName === "coresignal") {
        setEditCity(payload.city || "");
        if (payload.country) {
          // Use pre-loaded country code map (fast, no API call)
          const countryName = getCountryName(payload.country);
          if (countryName) {
            setSelectedEditCountries([{
              keyword: countryName,
              slug: payload.country.toUpperCase(),
            }]);
            setEditCountry(countryName);
          } else {
            setSelectedEditCountries([]);
            setEditCountry("");
          }
        } else {
          setSelectedEditCountries([]);
          setEditCountry("");
        }
      } else if (apiName === "theirstack") {
        setEditLocationPattern(Array.isArray(payload.location_pattern) ? payload.location_pattern : []);
        if (payload.job_country_code_or && Array.isArray(payload.job_country_code_or)) {
          // Use pre-loaded country code map (fast, no API call)
          const countries = payload.job_country_code_or.map((code: string) => {
            const name = getCountryName(code);
            return {
              keyword: name || code,
              slug: code.toUpperCase(),
            };
          });
          setSelectedEditTheirstackCountries(countries);
          setEditCountryCodes(payload.job_country_code_or);
        } else {
          setSelectedEditTheirstackCountries([]);
          setEditCountryCodes([]);
        }
      } else if (apiName === "mantiks") {
        if (payload.job_location_ids && Array.isArray(payload.job_location_ids)) {
          // Use pre-loaded Mantiks location map (fast, no API call)
          const locations = payload.job_location_ids.map((id: number) => {
            const name = getMantiksLocationName(id);
            return {
              keyword: name || String(id),
              slug: String(id),
            };
          });
          setSelectedEditMantiksLocations(locations);
          setEditMantiksLocationIds(payload.job_location_ids);
        } else {
          setSelectedEditMantiksLocations([]);
          setEditMantiksLocationIds([]);
        }
      }
    } catch (e) {
      console.error("Error parsing payload:", e);
    }

    // Optionally: Fetch proper mappings in background (non-blocking)
    // This can be done after modal opens if needed for better accuracy
  };

  const handleUpdateScheduler = async () => {
    if (!editingScheduler) return;

    if (editLimit <= 0) {
      alert("Limit must be greater than 0");
      return;
    }

    if (selectedEditTechnologies.length === 0) {
      alert("Please add at least one skill");
      return;
    }

    setIsUpdating(true);

    try {
      const apiName = editingScheduler.api_name.toLowerCase();
      const updatePayload: any = {
        limit: editLimit,
        interval: editInterval,
      };

      // Add skills based on API type - use slugs from mappings
      // For TheirStack and Mantiks, we need to use slugs, for CoreSignal we use keywords
      if (apiName === "coresignal") {
        // CoreSignal uses keywords (skill names)
        updatePayload.skills = selectedEditTechnologies.map(tech => tech.keyword.toLowerCase());
      } else if (apiName === "theirstack") {
        // TheirStack uses slugs (technology slugs)
        updatePayload.skills = selectedEditTechnologies.map(tech => tech.slug);
      } else if (apiName === "mantiks") {
        // Mantiks uses keywords (skill names)
        updatePayload.skills = selectedEditTechnologies.map(tech => tech.keyword.toLowerCase());
      }

      // Add location based on API type - match SchedularForm.tsx pattern
      if (apiName === "coresignal") {
        if (editCity) updatePayload.city = editCity;
        if (selectedEditCountries.length > 0) {
          // CoreSignal uses keyword (country name) not slug - matching SchedularForm.tsx line 643
          updatePayload.country = selectedEditCountries[0].keyword;
        } else if (editCountry && editCountry.trim()) {
          // Fallback: use editCountry if selectedEditCountries is empty
          updatePayload.country = editCountry.trim();
        }
      } else if (apiName === "theirstack") {
        if (editLocationPattern.length > 0) updatePayload.location_pattern = editLocationPattern;
        if (selectedEditTheirstackCountries.length > 0) {
          // Use slugs (country codes) from mappings
          updatePayload.job_country_code_or = selectedEditTheirstackCountries.map(c => c.slug);
        } else if (editCountryCodes.length > 0) {
          updatePayload.job_country_code_or = editCountryCodes;
        }
      } else if (apiName === "mantiks") {
        if (selectedEditMantiksLocations.length > 0) {
          // Use slugs (location IDs) from mappings
          updatePayload.job_location_ids = selectedEditMantiksLocations.map(loc => Number(loc.slug));
        } else if (editMantiksLocationIds.length > 0) {
          updatePayload.job_location_ids = editMantiksLocationIds;
        }
      }

      await updateSchedulerPayload(editingScheduler.scheduler_id.toString(), updatePayload);

      // Refresh scheduler list
      const offset = (currentPage - 1) * itemsPerPage;
      const response = await getSchedulers(itemsPerPage, offset);
      setTableData(response.schedulers);
      setTotalSchedulers(response.total);

      setShowEditModal(false);
      setEditingScheduler(null);
      // Reset all edit state
      setSelectedEditTechnologies([]);
      setEditTechnologyInput("");
      setEditTechnologyInputPreserved("");
      setEditCity("");
      setEditCountry("");
      setSelectedEditCountries([]);
      setEditCountryInput("");
      setEditLocationPattern([]);
      setEditCountryCodes([]);
      setSelectedEditTheirstackCountries([]);
      setEditTheirstackCountryInput("");
      setEditMantiksLocationIds([]);
      setSelectedEditMantiksLocations([]);
      setEditMantiksLocationInput("");
      alert("Scheduler updated successfully!");
    } catch (err) {
      console.error("Error updating scheduler:", err);
      alert("Failed to update scheduler. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewHistory = async (schedulerId: string) => {
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const data = await getSchedulerRuns(schedulerId, 20);
      // Enrich each run with an accurate jobs count computed from /api/scheduler-runs/{run_id}/jobs
      const enrichedRuns = await Promise.all(
        data.runs.map(async (run) => {
          try {
            const jobsData = await getSchedulerRunJobs((run as any).run_id as number);
            return {
              ...run,
              computed_jobs_fetched: jobsData.total_jobs ?? jobsData.jobs.length,
            };
          } catch (e) {
            console.error("Error fetching jobs for run to compute count:", e);
            return run;
          }
        })
      );
      setExecutionHistory(enrichedRuns);
    } catch (err) {
      console.error("Error fetching execution history:", err);
      alert("Failed to load execution history");
      setShowHistoryModal(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewRunJobs = async (runId: number) => {
    setLoadingJobs(true);
    setShowJobDetailsModal(true);
    setSelectedRunId(runId);
    try {
      const data = await getSchedulerRunJobs(runId);
      setRunJobs(data.jobs);
    } catch (err) {
      console.error("Error fetching run jobs:", err);
      alert("Failed to load job details");
      setShowJobDetailsModal(false);
    } finally {
      setLoadingJobs(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).replace(",", "");
    } catch {
      return dateString;
    }
  };
  // React-Select custom styles with dark mode support
  const getCustomSelectStyles = () => {
    const isDark =
      typeof window !== "undefined" &&
      document.documentElement.classList.contains("dark");

    return {
      control: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: isDark ? "#111827" : "transparent",
        borderColor: state.isFocused ? "#3b82f6" : isDark ? "#374151" : "#d1d5db",
        borderWidth: "1px",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
        minHeight: "44px",
        transition: "all 0.2s ease",
        color: isDark ? "#e8e8ea" : "#111827",
        "&:hover": {
          borderColor: "#3b82f6",
        },
      }),
      input: (provided: any) => ({
        ...provided,
        color: isDark ? "#e8e8ea" : "#111827",
      }),
      menu: (provided: any) => ({
        ...provided,
        backgroundColor: isDark ? "#111827" : "white",
        border: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
        boxShadow: isDark
          ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
          : "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        zIndex: 9999,
      }),
      option: (provided: any, state: any) => ({
        ...provided,
        backgroundColor: state.isSelected
          ? "#3b82f6"
          : state.isFocused
            ? isDark
              ? "#1f2937"
              : "#eff6ff"
            : "transparent",
        color: state.isSelected
          ? "white"
          : state.isFocused
            ? isDark
              ? "#e8e8ea"
              : "#1e40af"
            : isDark
              ? "#e8e8ea"
              : "#111827",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:active": {
          backgroundColor: "#2563eb",
        },
      }),
      multiValue: (provided: any) => ({
        ...provided,
        backgroundColor: "#3b82f6",
        borderRadius: "6px",
      }),
      multiValueLabel: (provided: any) => ({
        ...provided,
        color: "white",
        paddingLeft: "6px",
      }),
      multiValueRemove: (provided: any) => ({
        ...provided,
        color: "white",
        borderRadius: "0 6px 6px 0",
        transition: "all 0.15s ease",
        ":hover": {
          backgroundColor: "#2563eb",
          color: "white",
        },
      }),
      placeholder: (provided: any) => ({
        ...provided,
        color: isDark ? "#9ca3af" : "#9ca3af",
        fontSize: "14px",
      }),
      singleValue: (provided: any) => ({
        ...provided,
        color: isDark ? "#e8e8ea" : "#111827",
      }),
    };
  };

  const getActiveStatusColor = (isActive: boolean | string) => {
    const active = typeof isActive === "boolean" ? isActive : (isActive === "True" || isActive === "true");
    return active
      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  };

  const isActive = (isActiveValue: boolean | string) => {
    return typeof isActiveValue === "boolean" ? isActiveValue : (isActiveValue === "True" || isActiveValue === "true");
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="mb-6">
        <PageBreadcrumb pageTitle="Scheduler Management" />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Scheduler Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {tableData.length} {tableData.length === 1 ? "scheduler" : "schedulers"} found
              </p>
            </div>
          </div>
        </div>

        {/* Table Container - Scrollable within container, doesn't affect page */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Scheduler ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  API Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Total Jobs Fetched
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Interval
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Next Run
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Last Run
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading && tableData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading schedulers...</p>
                    </div>
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-gray-500 dark:text-gray-400">No schedulers found</p>
                  </td>
                </tr>
              ) : (
                tableData.map((row, index) => (
                  <tr
                    key={row.scheduler_id}
                    className="hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.scheduler_id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 uppercase">
                      {row.api_name}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getActiveStatusColor(row.is_active)}`}
                      >
                        {isActive(row.is_active) ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {row.total_jobs_fetched ?? row.jobs_fetched ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {row.interval_type ? row.interval_type.toUpperCase() : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatDate(
                        new Date(new Date(row.next_run).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {row.execution_history?.length > 0 ? (
                        (() => {
                          const lastRun = row.execution_history[0];
                          const lastNonZeroRun = row.execution_history.find((r) => r.jobs_fetched > 0) || lastRun;
                          const jobsFromHistory = lastNonZeroRun.jobs_fetched;
                          const totalJobs = (row as any).total_jobs_fetched ?? (row as any).jobs_fetched ?? 0;
                          const jobsToShow = jobsFromHistory > 0 ? jobsFromHistory : totalJobs;
                          return (
                            <>
                              <div>
                                {formatDate(
                                  new Date(new Date(lastNonZeroRun.executed_at || (lastRun.executed_at as string)).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
                                )}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {jobsToShow} job{jobsToShow !== 1 ? "s" : ""} fetched
                              </div>
                            </>
                          );
                        })()
                      ) : row.last_run ? (
                        <>
                          <div>{formatDate(row.last_run)}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No runs</div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {isAdmin ? (
                          <>
                            {isActive(row.is_active) ? (
                              <button
                                onClick={() => handleStop(row.scheduler_id)}
                                className="px-3 py-2 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                                title="Stop Scheduler"
                              >
                                <Square className="w-4 h-4" />
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStart(row.scheduler_id)}
                                className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                                title="Start Scheduler"
                              >
                                <Play className="w-4 h-4" />
                                Start
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {isActive(row.is_active) ? (
                              <button
                                disabled
                                className="px-3 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1"
                                title="Viewers do not have access to stop schedulers"
                              >
                                <Square className="w-4 h-4" />
                                Stop
                              </button>
                            ) : (
                              <button
                                disabled
                                className="px-3 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1"
                                title="Viewers do not have access to start schedulers"
                              >
                                <Play className="w-4 h-4" />
                                Start
                              </button>
                            )}
                          </>
                        )}
                        <button
                          onClick={() => handleViewHistory(row.scheduler_id)}
                          className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          title="View Execution History"
                        >
                          <History className="w-4 h-4" />
                          History
                        </button>
                        <button
                          onClick={() => handleEdit(row)}
                          className="px-3 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          title="Edit Scheduler"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>

                        <button
                          onClick={() => handleView(row)}
                          className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        {isAdmin ? (
                          <button
                            onClick={() => handleDelete(row.scheduler_id)}
                            className="px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 inline-flex items-center gap-1"
                            title="Delete Scheduler"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-3 py-2 bg-gray-400 dark:bg-gray-600 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-50 inline-flex items-center gap-1"
                            title="Viewers do not have access to delete schedulers"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Showing {startItem} to {endItem} of {totalSchedulers} schedulers
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1); // Reset to first page when changing items per page
                }}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${currentPage === pageNum
                        ? "bg-yellow-600 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Edit Modal */}
      {showEditModal && editingScheduler && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-yellow-600 to-yellow-700 p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                Edit Scheduler - {editingScheduler.api_name.toUpperCase()}
              </h3>
              <p className="text-yellow-100 text-sm mt-1">
                Update limit, interval, skills, and location
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Limit
                </label>
                <input
                  type="number"
                  value={editLimit}
                  onChange={(e) => setEditLimit(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Interval */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Interval
                </label>
                <select
                  value={editInterval}
                  onChange={(e) => setEditInterval(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="1hr">1 Hour</option>
                  <option value="2hr">2 Hours</option>
                  <option value="4hr">4 Hours</option>
                  <option value="6hr">6 Hours</option>
                  <option value="12hr">12 Hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Skills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Skills
                </label>
                <div className="flex items-center gap-3">
                  {/* Skills select */}
                  <div className="flex-1 w-full">
                    <ReactSelect
                      isMulti
                      name="editTechnologies"
                      options={editTechnologyOptions}
                      value={selectedEditTechnologies.map((tech) => ({
                        value: tech.keyword,
                        label: tech.keyword,
                        slug: tech.slug,
                      }))}
                      inputValue={editTechnologyInput}
                      onInputChange={(input) => {
                        setEditTechnologyInput(input);
                        if (input.trim()) {
                          setEditTechnologyInputPreserved(input);
                        }
                      }}
                      onMenuClose={() => {
                        if (editTechnologyInput.trim()) {
                          setEditTechnologyInputPreserved(editTechnologyInput);
                        }
                      }}
                      onChange={(selected: any) => {
                        const techs = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setSelectedEditTechnologies(techs);
                      }}
                      isLoading={isLoadingEditTechnologies}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search technologies (e.g., Python)"
                      noOptionsMessage={() =>
                        isLoadingEditTechnologies
                          ? "Loading..."
                          : editTechnologyInput
                            ? "No technologies found"
                            : "Type to search technologies"
                      }
                    />
                  </div>

                  {/* Add Skill button */}
                  <button
                    type="button"
                    onClick={handleAddEditSkill}
                    disabled={
                      (!editTechnologyInput.trim() && !editTechnologyInputPreserved.trim()) ||
                      editTechnologyOptions.some(opt =>
                        opt.value.toLowerCase() === (editTechnologyInput.trim() || editTechnologyInputPreserved.trim()).toLowerCase()
                      )
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                    title={
                      editTechnologyOptions.some(opt =>
                        opt.value.toLowerCase() === (editTechnologyInput.trim() || editTechnologyInputPreserved.trim()).toLowerCase()
                      )
                        ? "Skill already exists in the list"
                        : "Add new skill"
                    }
                  >
                    Add Skill
                  </button>
                </div>

                {/* Selected skills chips */}
                {selectedEditTechnologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border mt-2">
                    {selectedEditTechnologies.map((tech) => (
                      <div
                        key={tech.keyword}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                      >
                        <span>{tech.keyword}</span>
                        <button
                          onClick={() =>
                            setSelectedEditTechnologies(
                              selectedEditTechnologies.filter(
                                (t) => t.keyword !== tech.keyword,
                              ),
                            )
                          }
                          className="text-blue-600 dark:text-blue-300 font-bold text-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Location - CoreSignal */}
              {editingScheduler.api_name.toLowerCase() === "coresignal" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="City (optional)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Country
                    </label>
                    <ReactSelect
                      isMulti={false}
                      name="editCountries"
                      options={editCountryOptions}
                      value={selectedEditCountries.length > 0 ? {
                        value: selectedEditCountries[0].keyword,
                        label: selectedEditCountries[0].keyword,
                        slug: selectedEditCountries[0].slug,
                      } : null}
                      onInputChange={(input) => setEditCountryInput(input)}
                      onChange={(selected: any) => {
                        if (selected) {
                          setSelectedEditCountries([{
                            keyword: selected.value,
                            slug: selected.slug,
                          }]);
                          // Store keyword (country name) not slug, matching SchedularForm.tsx pattern
                          setEditCountry(selected.value);
                        } else {
                          setSelectedEditCountries([]);
                          setEditCountry("");
                        }
                      }}
                      isLoading={isLoadingEditCountries}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search countries (e.g., India)"
                      noOptionsMessage={() =>
                        isLoadingEditCountries
                          ? "Loading..."
                          : editCountryInput
                            ? "No countries found"
                            : "Type to search countries"
                      }
                    />
                    {selectedEditCountries.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border mt-2">
                        {selectedEditCountries.map((country) => (
                          <div
                            key={country.keyword}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                          >
                            <span>{country.keyword}</span>
                            <button
                              onClick={() => {
                                setSelectedEditCountries([]);
                                setEditCountry("");
                              }}
                              className="text-green-600 dark:text-green-300 font-bold text-lg"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location - TheirStack */}
              {editingScheduler.api_name.toLowerCase() === "theirstack" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={editLocationPattern.join(", ")}
                      onChange={(e) =>
                        setEditLocationPattern(
                          e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter city"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Country
                    </label>
                    <ReactSelect
                      isMulti
                      name="editTheirstackCountries"
                      options={editTheirstackCountryOptions}
                      value={selectedEditTheirstackCountries.map((country) => ({
                        value: country.keyword,
                        label: country.keyword,
                        slug: country.slug,
                      }))}
                      onInputChange={(input) => setEditTheirstackCountryInput(input)}
                      onChange={(selected: any) => {
                        const countries = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setSelectedEditTheirstackCountries(countries);
                        setEditCountryCodes(countries.map(c => c.slug));
                      }}
                      isLoading={isLoadingEditTheirstackCountries}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search countries (e.g., India)"
                      noOptionsMessage={() =>
                        isLoadingEditTheirstackCountries
                          ? "Loading..."
                          : editTheirstackCountryInput
                            ? "No countries found"
                            : "Type to search countries"
                      }
                    />
                    {selectedEditTheirstackCountries.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border mt-2">
                        {selectedEditTheirstackCountries.map((country) => (
                          <div
                            key={country.keyword}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                          >
                            <span>{country.keyword}</span>
                            <button
                              onClick={() => {
                                const updated = selectedEditTheirstackCountries.filter(
                                  (c) => c.keyword !== country.keyword,
                                );
                                setSelectedEditTheirstackCountries(updated);
                                setEditCountryCodes(updated.map(c => c.slug));
                              }}
                              className="text-green-600 dark:text-green-300 font-bold text-lg"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location - Mantiks */}
              {editingScheduler.api_name.toLowerCase() === "mantiks" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Country
                  </label>
                  <ReactSelect
                    isMulti
                    name="editMantiksLocations"
                    options={editMantiksLocationOptions}
                    value={selectedEditMantiksLocations.map((location) => ({
                      value: location.keyword,
                      label: location.keyword,
                      slug: location.slug,
                    }))}
                    onInputChange={(input) => setEditMantiksLocationInput(input)}
                    onChange={(selected: any) => {
                      const locations = selected
                        ? selected.map((opt: any) => ({
                          keyword: opt.value,
                          slug: opt.slug,
                        }))
                        : [];
                      setSelectedEditMantiksLocations(locations);
                      setEditMantiksLocationIds(locations.map(loc => Number(loc.slug)));
                    }}
                    isLoading={isLoadingEditMantiksLocations}
                    styles={getCustomSelectStyles()}
                    menuPosition="fixed"
                    placeholder="Type to search countries (e.g., India)"
                    noOptionsMessage={() =>
                      isLoadingEditMantiksLocations
                        ? "Loading..."
                        : editMantiksLocationInput
                          ? "No countries found"
                          : "Type to search countries"
                    }
                  />
                  {selectedEditMantiksLocations.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border mt-2">
                      {selectedEditMantiksLocations.map((location) => (
                        <div
                          key={location.slug}
                          className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                        >
                          <span>{location.keyword}</span>
                          <button
                            onClick={() => {
                              const updated = selectedEditMantiksLocations.filter(
                                (l) => l.slug !== location.slug,
                              );
                              setSelectedEditMantiksLocations(updated);
                              setEditMantiksLocationIds(updated.map(loc => Number(loc.slug)));
                            }}
                            className="text-blue-600 dark:text-blue-300 font-bold text-lg"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingScheduler(null);
                  // Reset all edit state
                  setSelectedEditTechnologies([]);
                  setEditTechnologyInput("");
                  setEditTechnologyInputPreserved("");
                  setEditCity("");
                  setEditCountry("");
                  setSelectedEditCountries([]);
                  setEditCountryInput("");
                  setEditLocationPattern([]);
                  setEditCountryCodes([]);
                  setSelectedEditTheirstackCountries([]);
                  setEditTheirstackCountryInput("");
                  setEditMantiksLocationIds([]);
                  setSelectedEditMantiksLocations([]);
                  setEditMantiksLocationInput("");
                }}
                disabled={isUpdating}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateScheduler}
                disabled={isUpdating}
                className="flex-1 px-4 py-2 rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 font-medium transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Update
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Modal */}
      {showModal && selectedRow && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                Scheduler Details
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Scheduler ID:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedRow.scheduler_id}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  API Name:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white uppercase">
                  {selectedRow.api_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Interval:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedRow.interval_type ? selectedRow.interval_type.toUpperCase() : "-"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Status:
                </span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getActiveStatusColor(
                    selectedRow.is_active
                  )}`}
                >
                  {isActive(selectedRow.is_active) ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Last Jobs Fetched (Recent Successful Run):
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    // Prefer execution_history if it has a successful run count
                    if (selectedRow.execution_history && selectedRow.execution_history.length > 0) {
                      const lastRun = selectedRow.execution_history[0];
                      const lastNonZeroRun = selectedRow.execution_history.find((r) => r.jobs_fetched > 0) || lastRun;
                      if (lastNonZeroRun.jobs_fetched > 0) {
                        return lastNonZeroRun.jobs_fetched;
                      }
                    }
                    // Fallback: use total_jobs_fetched when we only have a single run
                    const total = selectedRow.total_jobs_fetched ?? selectedRow.jobs_fetched ?? 0;
                    return total;
                  })()}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Jobs in Database:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedRow.total_jobs_fetched ?? selectedRow.jobs_fetched ?? 0}
                </span>
              </div>

              {/* ✅ ADD LIMIT FIELD */}
              <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Limit:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    try {
                      if (selectedRow.payload_json) {
                        const payload = JSON.parse(selectedRow.payload_json);
                        return payload.limit || "-";
                      }
                      return "-";
                    } catch (e) {
                      return "-";
                    }
                  })()}
                </span>
              </div>

              {/* ✅ ADD LOCATION FIELD */}
              {(() => {
                try {
                  if (!selectedRow.payload_json) {
                    return null;
                  }

                  const payload = JSON.parse(selectedRow.payload_json);
                  const apiName = selectedRow.api_name.toLowerCase();
                  const locationInfo: string[] = [];

                  if (apiName === "coresignal") {
                    // CoreSignal: city and country
                    if (payload.city) {
                      locationInfo.push(payload.city);
                    }
                    if (payload.country) {
                      const countryDisplay = getCountryName(payload.country) || payload.country;
                      locationInfo.push(countryDisplay);
                    }
                  } else if (apiName === "theirstack") {
                    // TheirStack: location_pattern or job_country_code_or
                    if (payload.location_pattern && Array.isArray(payload.location_pattern)) {
                      locationInfo.push(...payload.location_pattern);
                    } else if (payload.location_pattern && typeof payload.location_pattern === "string") {
                      locationInfo.push(payload.location_pattern);
                    }

                    if (payload.job_country_code_or && Array.isArray(payload.job_country_code_or)) {
                      const countryNames = payload.job_country_code_or.map((code: string) => {
                        const name = getCountryName(code);
                        return name ? `${name}` : code;
                      });
                      locationInfo.push(...countryNames);
                    } else if (payload.job_country_code_or && typeof payload.job_country_code_or === "string") {
                      const countryName = getCountryName(payload.job_country_code_or);
                      locationInfo.push(countryName ? `${countryName} (${payload.job_country_code_or})` : payload.job_country_code_or);
                    }
                  } else if (apiName === "mantiks") {
                    // Mantiks: job_location_ids
                    if (payload.job_location_ids && Array.isArray(payload.job_location_ids)) {
                      const locationNames = payload.job_location_ids.map((id: number) => {
                        const name = getMantiksLocationName(id);
                        return name ? `${name}` : String(id);
                      });
                      locationInfo.push(...locationNames);
                    }
                  }

                  // No fallback needed if locationInfo is empty

                  if (locationInfo.length === 0) {
                    return null;
                  }

                  return (
                    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-gray-600 dark:text-gray-400">Location:</span>
                      <span className="font-semibold text-gray-900 dark:text-white text-right">
                        {locationInfo.join(" | ")}
                      </span>
                    </div>
                  );
                } catch (e) {
                  console.error("Error parsing payload for location:", e);
                  return null;
                }
              })()}


              {/* Skills from Payload */}
              {(() => {
                try {
                  if (!selectedRow.payload_json) return null;

                  const payload = JSON.parse(selectedRow.payload_json);
                  let skills: string[] = [];

                  // Extract skills based on API type
                  if (payload.skills && Array.isArray(payload.skills)) {
                    // CoreSignal format: payload.skills is an array
                    skills = payload.skills;
                  } else if (payload.job_description && Array.isArray(payload.job_description)) {
                    // Mantiks format: payload.job_description is an array
                    skills = payload.job_description;
                  } else if (payload.job_technology_slug && Array.isArray(payload.job_technology_slug)) {
                    // TheirStack format: payload.job_technology_slug is an array
                    skills = payload.job_technology_slug;
                    // Optionally also include job_title_pattern_or for TheirStack
                    if (payload.job_title_pattern_or && Array.isArray(payload.job_title_pattern_or)) {
                      skills = [...skills, ...payload.job_title_pattern_or];
                    }
                  }

                  // Only render if we have skills
                  if (skills.length > 0) {
                    return (
                      <div className="py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400 block mb-2">
                          Skills ({skills.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {skills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-400"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                } catch (e) {
                  console.error("Error parsing payload for skills:", e);
                }
                return null;
              })()}
              {/*               
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600 dark:text-gray-400">
                  Last Run:
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {(() => {
                    // Try to get last run from execution history first (most accurate)
                    if (selectedRow.execution_history && selectedRow.execution_history.length > 0) {
                      // Get the most recent run (first in array, as it's sorted by executed_at desc)
                      const lastRun = selectedRow.execution_history[0];
                      if (lastRun.executed_at) {
                        return formatDate(lastRun.executed_at)+(5.5 * 60 * 60 * 1000);
                      }
                    }
                    // Fallback to selectedRow.last_run if execution history is not available
                    return formatDate(selectedRow.last_run);
                  })()}
                </span>
              </div> */}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95"
              >
                Close
              </button>
              {isAdmin ? (
                <button
                  onClick={() => {
                    handleDelete(selectedRow.scheduler_id);
                    setShowModal(false);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors flex items-center justify-center gap-2 active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              ) : (
                <button
                  disabled
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-400 dark:bg-gray-600 text-white font-medium cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
                  title="Viewers do not have access to delete schedulers"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Execution History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                Execution History
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                Recent scheduler executions with job counts
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600 dark:text-gray-400 mt-3">Loading history...</p>
                </div>
              ) : executionHistory.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No execution history found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executionHistory.map((run, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border ${run.has_error
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${run.has_error
                                ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                                : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                }`}
                            >
                              {run.has_error ? "Failed" : "Success"}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {(run as any).computed_jobs_fetched ?? run.jobs_fetched} job
                              {((run as any).computed_jobs_fetched ?? run.jobs_fetched) !== 1 ? "s" : ""} fetched
                            </span>
                            {run.execution_time_seconds && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                ({run.execution_time_seconds}s)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {formatDate(new Date(new Date(run.executed_at).getTime() + 5.5 * 60 * 60 * 1000).toISOString() || "")}
                          </p>
                          {run.has_error && run.error_message && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Error: {run.error_message}
                            </p>
                          )}
                        </div>
                        {/* View Button */}
                        {!run.has_error && run.jobs_fetched > 0 && (
                          <button
                            onClick={() => handleViewRunJobs((run as any).run_id)}
                            className="ml-4 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm transition-colors flex items-center gap-2 active:scale-95"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setExecutionHistory([]);
                  setSelectedEditTechnologies([]);
                  setEditTechnologyInput("");
                  setEditTechnologyInputPreserved("");
                  setEditCity("");
                  setEditCountry("");
                  setSelectedEditCountries([]);
                  setEditCountryInput("");
                  setEditLocationPattern([]);
                  setEditCountryCodes([]);
                  setSelectedEditTheirstackCountries([]);
                  setEditTheirstackCountryInput("");
                  setEditMantiksLocationIds([]);
                  setSelectedEditMantiksLocations([]);
                  setEditMantiksLocationInput("");
                }}
                disabled={isUpdating}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {showJobDetailsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                Job Details
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                {runJobs.length} job{runJobs.length !== 1 ? "s" : ""} fetched in this run
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingJobs ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-gray-600 dark:text-gray-400 mt-3">Loading jobs...</p>
                </div>
              ) : runJobs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No jobs found for this run</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {runJobs.map((job, index) => (
                    <div
                      key={index}
                      className="p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {job.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {job.company_name}
                          </p>
                        </div>
                        {job.seniority && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400">
                            {job.seniority}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        {job.location && (
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Location:</span>
                            <span>{job.location}</span>
                          </div>
                        )}
                        {job.country && (
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Country:</span>
                            <span>{job.country}</span>
                          </div>
                        )}
                        {job.company_industry && (
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Industry:</span>
                            <span>{job.company_industry}</span>
                          </div>
                        )}
                        {job.company_website && (
                          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">Website:</span>
                            <a
                              href={job.company_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {job.company_website}
                            </a>
                          </div>
                        )}
                      </div>

                      {job.description && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description:</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                            {job.description}
                          </p>
                        </div>
                      )}

                      {job.job_url && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <a
                            href={job.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            View Job Posting →
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl">
              <button
                onClick={() => {
                  setShowJobDetailsModal(false);
                  setRunJobs([]);
                  setSelectedRunId(null);
                }}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors active:scale-95"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );

}
