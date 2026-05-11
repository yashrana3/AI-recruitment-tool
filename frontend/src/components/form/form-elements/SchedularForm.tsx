import { useState, useEffect } from "react";
import Label from "../Label";
import Input from "../input/InputField";
import Button from "../../ui/button/Button";
import ApiTabs from "./ApiTabs";
import ReactSelect from "react-select";
import {
  createCoresignalsScheduler,
  createTheirstackScheduler,
  getMappings,
  TechnologyMapping,
  createMantiksScheduler,
  createUnifiedScheduler,
  UnifiedSchedulerParams,
  createMapping,
} from "../../../api/DashBoard.API";

interface SelectedTechnology {
  keyword: string;
  slug: string;
}

interface SelectedCountry {
  keyword: string;
  slug: string;
}

interface SelectedIndustry {
  keyword: string;
  slug: string | number;
}

export default function SchedulerForm() {
  const [api, setApi] = useState("coresignals");

  // Coresignals state
  const [limit, setLimit] = useState("");

  const [selectedTechnologies, setSelectedTechnologies] = useState<
    SelectedTechnology[]
  >([]);
  const [technologyInput, setTechnologyInput] = useState("");
  const [technologyInputPreserved, setTechnologyInputPreserved] = useState("");
  const [technologyOptions, setTechnologyOptions] = useState<
    { value: string; label: string; slug: string }[]
  >([]);

  // Theirstack state
  const [theirstackLimit, setTheirstackLimit] = useState("");
  const [maxAgeDays, setMaxAgeDays] = useState("");
  const [locationPattern, setLocationPattern] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [useLocationPattern, setUseLocationPattern] = useState(true);
  const [selectedCountries, setSelectedCountries] = useState<SelectedCountry[]>(
    [],
  );
  const [theirstackSkillsError, setTheirstackSkillsError] = useState(false);
  const [countryInput, setCountryInput] = useState("");
  const [countryOptions, setCountryOptions] = useState<
    { value: string; label: string; slug: string }[]
  >([]);
  const [selectedTheirstackTechnologies, setSelectedTheirstackTechnologies] =
    useState<SelectedTechnology[]>([]);
  const [theirstackTechnologyInput, setTheirstackTechnologyInput] =
    useState("");
  const [theirstackTechnologyInputPreserved, setTheirstackTechnologyInputPreserved] = useState("");
  const [theirstackTechnologyOptions, setTheirstackTechnologyOptions] =
    useState<{ value: string; label: string; slug: string }[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<
    SelectedIndustry[]
  >([]);
  const [industryInput, setIndustryInput] = useState("");
  const [industryOptions, setIndustryOptions] = useState<
    { value: string; label: string; slug: string | number }[]
  >([]);
  const [theirstackLogic, setTheirstackLogic] = useState<"or" | "and">("or");
  const [skillsLogic, setSkillsLogic] = useState<"or" | "and">("or");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interval, setInterval] = useState<"1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly">("daily");
  const [mantiksLimit, setMantiksLimit] = useState("");
  const [mantiksJobAgeDays, setMantiksJobAgeDays] = useState("");

  const [mantiksLocations, setMantiksLocations] = useState<SelectedCountry[]>(
    [],
  );
  const [mantiksLocationInput, setMantiksLocationInput] = useState("");
  const [mantiksLocationOptions, setMantiksLocationOptions] = useState<
    { value: string; label: string; slug: string }[]
  >([]);
  // TheirStack employment status state
  const [theirstackEmploymentStatuses, setTheirstackEmploymentStatuses] = useState<string[]>([]);

  // Mantiks skills state
  const [mantiksSkills, setMantiksSkills] = useState<SelectedTechnology[]>([]);
  const [mantiksSkillInput, setMantiksSkillInput] = useState("");
  const [mantiksSkillInputPreserved, setMantiksSkillInputPreserved] = useState("");
  const [mantiksSkillOptions, setMantiksSkillOptions] = useState<{ value: string; label: string; slug: string }[]>([]);

  const [coresignalsMaxAgeDays, setCoresignalsMaxAgeDays] = useState("");
  const [coresignalsLocationPattern, setCoresignalsLocationPattern] = useState<
    string[]
  >([]);
  const [coresignalsLocationInput, setCoresignalsLocationInput] = useState("");
  const [useCityOrCountry, setUseCityOrCountry] = useState(true);
  const [coresignalsSelectedCountries, setCoresignalsSelectedCountries] =
    useState<SelectedCountry[]>([]);
  const [coresignalsCountryInput, setCoresignalsCountryInput] = useState("");
  const [coresignalsCountryOptions, setCoresignalsCountryOptions] = useState<
    { value: string; label: string; slug: string }[]
  >([]);

  // Loading states for dropdowns
  const [isLoadingTechnologies, setIsLoadingTechnologies] = useState(false);
  const [isLoadingTheirstackTechnologies, setIsLoadingTheirstackTechnologies] = useState(false);
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(false);
  const [isLoadingCoresignalsCountries, setIsLoadingCoresignalsCountries] = useState(false);
  const [isLoadingMantiksLocations, setIsLoadingMantiksLocations] = useState(false);
  const [isLoadingMantiksSkills, setIsLoadingMantiksSkills] = useState(false);

  // Fetch technologies for Coresignals with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!technologyInput || api !== "coresignals") {
        setTechnologyOptions([]);
        setIsLoadingTechnologies(false);
        return;
      }

      const fetchTechnologies = async () => {
        setIsLoadingTechnologies(true);
        try {
          const data = await getMappings({
            q: technologyInput,
            limit: 20,
            datapoint: "technologies",
          });
          setTechnologyOptions(
            data.map((tech: TechnologyMapping) => ({
              value: tech.keyword,
              label: tech.keyword,
              slug: tech.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch technologies:", err);
          setTechnologyOptions([]);
        } finally {
          setIsLoadingTechnologies(false);
        }
      };

      fetchTechnologies();
    }, 300);

    return () => clearTimeout(handler);
  }, [technologyInput, api]);

  // Fetch technologies for Theirstack with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!theirstackTechnologyInput || api !== "theirstack") {
        setTheirstackTechnologyOptions([]);
        setIsLoadingTheirstackTechnologies(false);
        return;
      }

      const fetchTechnologies = async () => {
        setIsLoadingTheirstackTechnologies(true);
        try {
          const data = await getMappings({
            q: theirstackTechnologyInput,
            limit: 20,
            datapoint: "technologies",
          });
          setTheirstackTechnologyOptions(
            data.map((tech: TechnologyMapping) => ({
              value: tech.keyword,
              label: tech.keyword,
              slug: tech.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch technologies:", err);
          setTheirstackTechnologyOptions([]);
        } finally {
          setIsLoadingTheirstackTechnologies(false);
        }
      };

      fetchTechnologies();
    }, 300);

    return () => clearTimeout(handler);
  }, [theirstackTechnologyInput, api]);

  // Fetch countries for Theirstack with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!countryInput || api !== "theirstack") {
        setCountryOptions([]);
        setIsLoadingCountries(false);
        return;
      }

      const fetchCountries = async () => {
        setIsLoadingCountries(true);
        try {
          const data = await getMappings({
            q: countryInput,
            limit: 20,
            datapoint: "countries",
          });
          setCountryOptions(
            data.map((country: TechnologyMapping) => ({
              value: country.keyword,
              label: country.keyword,
              slug: country.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch countries:", err);
          setCountryOptions([]);
        } finally {
          setIsLoadingCountries(false);
        }
      };

      fetchCountries();
    }, 300);

    return () => clearTimeout(handler);
  }, [countryInput, api]);

  // Fetch industries for Theirstack with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!industryInput || api !== "theirstack") {
        setIndustryOptions([]);
        setIsLoadingIndustries(false);
        return;
      }

      const fetchIndustries = async () => {
        setIsLoadingIndustries(true);
        try {
          const data = await getMappings({
            q: industryInput,
            limit: 20,
            datapoint: "industries",
          });
          setIndustryOptions(
            data.map((industry: TechnologyMapping) => ({
              value: industry.keyword,
              label: industry.keyword,
              slug: industry.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch industries:", err);
          setIndustryOptions([]);
        } finally {
          setIsLoadingIndustries(false);
        }
      };

      fetchIndustries();
    }, 300);

    return () => clearTimeout(handler);
  }, [industryInput, api]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!coresignalsCountryInput || api !== "coresignals") {
        setCoresignalsCountryOptions([]);
        setIsLoadingCoresignalsCountries(false);
        return;
      }

      const fetchCoresignalsCountries = async () => {
        setIsLoadingCoresignalsCountries(true);
        try {
          const data = await getMappings({
            q: coresignalsCountryInput,
            limit: 20,
            datapoint: "countries",
          });
          setCoresignalsCountryOptions(
            data.map((country: TechnologyMapping) => ({
              value: country.keyword,
              label: country.keyword,
              slug: country.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch Coresignals countries:", err);
          setCoresignalsCountryOptions([]);
        } finally {
          setIsLoadingCoresignalsCountries(false);
        }
      };

      fetchCoresignalsCountries();
    }, 300);

    return () => clearTimeout(handler);
  }, [coresignalsCountryInput, api]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (!mantiksLocationInput || api !== "mantiks") {
        setMantiksLocationOptions([]);
        setIsLoadingMantiksLocations(false);
        return;
      }

      const fetchMantiksCountries = async () => {
        setIsLoadingMantiksLocations(true);
        try {
          const data = await getMappings({
            q: mantiksLocationInput,
            limit: 20,
            datapoint: "mantiks_countries",
          });
          setMantiksLocationOptions(
            data.map((location: TechnologyMapping) => ({
              value: location.keyword,
              label: location.keyword,
              slug: location.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch Mantiks countries:", err);
          setMantiksLocationOptions([]);
        } finally {
          setIsLoadingMantiksLocations(false);
        }
      };

      fetchMantiksCountries();
    }, 300);

    return () => clearTimeout(handler);
  }, [mantiksLocationInput, api]);

  // Fetch skills for Mantiks with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (!mantiksSkillInput || api !== "mantiks") {
        setMantiksSkillOptions([]);
        setIsLoadingMantiksSkills(false);
        return;
      }

      const fetchSkills = async () => {
        setIsLoadingMantiksSkills(true);
        try {
          const data = await getMappings({
            q: mantiksSkillInput,
            limit: 20,
            datapoint: "technologies",
          });
          setMantiksSkillOptions(
            data.map((tech: TechnologyMapping) => ({
              value: tech.keyword,
              label: tech.keyword,
              slug: tech.slug,
            })),
          );
        } catch (err) {
          console.error("Failed to fetch skills for Mantiks:", err);
          setMantiksSkillOptions([]);
        } finally {
          setIsLoadingMantiksSkills(false);
        }
      };

      fetchSkills();
    }, 300);

    return () => clearTimeout(handler);
  }, [mantiksSkillInput, api]);

  // Handler to add new skill for Coresignals
  const handleAddCoresignalsSkill = async () => {
    // Use preserved input if current input is empty (ReactSelect cleared it on blur)
    const inputToUse = technologyInput.trim() || technologyInputPreserved.trim();
    console.log("handleAddCoresignalsSkill called, technologyInput:", technologyInput, "preserved:", technologyInputPreserved, "using:", inputToUse);
    const trimmed = inputToUse;
    if (!trimmed) {
      alert("Please enter a skill name");
      return;
    }

    try {
      // Check if skill already exists in selected skills
      if (selectedTechnologies.some(skill => skill.keyword.toLowerCase() === trimmed.toLowerCase())) {
        alert("This skill is already added");
        setTechnologyInput("");
        return;
      }

      console.log("Calling createMapping API with:", trimmed);
      // Create mapping in database
      const response = await createMapping({ raw: trimmed });
      console.log("createMapping response:", response);
      
      // Add to selected skills
      const newSkill: SelectedTechnology = {
        keyword: response.raw,
        slug: response.mapped,
      };
      setSelectedTechnologies([...selectedTechnologies, newSkill]);
      setTechnologyInput("");
      setTechnologyInputPreserved("");
      
      // Refresh the options list by triggering a search
      const data = await getMappings({
        q: trimmed,
        limit: 20,
        datapoint: "technologies",
      });
      setTechnologyOptions(
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

  // Handler to add new skill for TheirStack
  const handleAddTheirstackSkill = async () => {
    // Use preserved input if current input is empty (ReactSelect cleared it on blur)
    const inputToUse = theirstackTechnologyInput.trim() || theirstackTechnologyInputPreserved.trim();
    console.log("handleAddTheirstackSkill called, theirstackTechnologyInput:", theirstackTechnologyInput, "preserved:", theirstackTechnologyInputPreserved, "using:", inputToUse);
    const trimmed = inputToUse;
    if (!trimmed) {
      alert("Please enter a skill name");
      return;
    }

    try {
      // Check if skill already exists in selected skills
      if (selectedTheirstackTechnologies.some(skill => skill.keyword.toLowerCase() === trimmed.toLowerCase())) {
        alert("This skill is already added");
        setTheirstackTechnologyInput("");
        return;
      }

      console.log("Calling createMapping API with:", trimmed);
      // Create mapping in database
      const response = await createMapping({ raw: trimmed });
      console.log("createMapping response:", response);
      
      // Add to selected skills
      const newSkill: SelectedTechnology = {
        keyword: response.raw,
        slug: response.mapped,
      };
      setSelectedTheirstackTechnologies([...selectedTheirstackTechnologies, newSkill]);
      setTheirstackTechnologyInput("");
      setTheirstackTechnologyInputPreserved("");
      
      // Refresh the options list by triggering a search
      const data = await getMappings({
        q: trimmed,
        limit: 20,
        datapoint: "technologies",
      });
      setTheirstackTechnologyOptions(
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

  // Handler to add new skill for Mantiks
  const handleAddMantiksSkill = async () => {
    // Use preserved input if current input is empty (ReactSelect cleared it on blur)
    const inputToUse = mantiksSkillInput.trim() || mantiksSkillInputPreserved.trim();
    console.log("handleAddMantiksSkill called, mantiksSkillInput:", mantiksSkillInput, "preserved:", mantiksSkillInputPreserved, "using:", inputToUse);
    const trimmed = inputToUse;
    if (!trimmed) {
      alert("Please enter a skill name");
      return;
    }

    try {
      // Check if skill already exists in selected skills
      if (mantiksSkills.some(skill => skill.keyword.toLowerCase() === trimmed.toLowerCase())) {
        alert("This skill is already added");
        setMantiksSkillInput("");
        return;
      }

      console.log("Calling createMapping API with:", trimmed);
      // Create mapping in database
      const response = await createMapping({ raw: trimmed });
      console.log("createMapping response:", response);
      
      // Add to selected skills
      const newSkill: SelectedTechnology = {
        keyword: response.raw,
        slug: response.mapped,
      };
      setMantiksSkills([...mantiksSkills, newSkill]);
      setMantiksSkillInput("");
      setMantiksSkillInputPreserved("");
      
      // Refresh the options list by triggering a search
      const data = await getMappings({
        q: trimmed,
        limit: 20,
        datapoint: "technologies",
      });
      setMantiksSkillOptions(
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

  // Employment status options for TheirStack
  const employmentStatusOptions = [
    { value: "full_time", label: "Full Time" },
    { value: "part_time", label: "Part Time" },
    { value: "contract", label: "Contract" },
    { value: "internship", label: "Internship" },
    { value: "temporary", label: "Temporary" },
    { value: "freelance", label: "Freelance" },
  ];

  const addCoresignalsLocation = () => {
    const trimmed = coresignalsLocationInput.trim().toLowerCase();
    if (trimmed && !coresignalsLocationPattern.includes(trimmed)) {
      setCoresignalsLocationPattern([...coresignalsLocationPattern, trimmed]);
      setCoresignalsLocationInput("");
    }
  };

  const removeCoresignalsLocation = (loc: string) => {
    setCoresignalsLocationPattern(
      coresignalsLocationPattern.filter((l) => l !== loc),
    );
  };

  // Replace lines 217-226 with:
  const handleRemoveMantiksLocationId = (slug: string) => {
    setMantiksLocations(mantiksLocations.filter((loc) => loc.slug !== slug));
  };

  const addLocation = () => {
    const trimmed = locationInput.trim().toLowerCase();
    if (trimmed && !locationPattern.includes(trimmed)) {
      setLocationPattern([...locationPattern, trimmed]);
      setLocationInput("");
    }
  };

  const removeLocation = (loc: string) => {
    setLocationPattern(locationPattern.filter((l) => l !== loc));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let schedulerParams: UnifiedSchedulerParams;

      if (api === "coresignals") {
        // Validation
        if (
          !limit ||
          !coresignalsMaxAgeDays ||
          selectedTechnologies.length === 0
        ) {
          alert("Please fill all required fields before creating scheduler.");
          setIsSubmitting(false);
          return;
        }

        if (
          useCityOrCountry &&
          coresignalsLocationPattern.length === 0 &&
          coresignalsSelectedCountries.length === 0
        ) {
          alert(
            "Please provide either City or Country Code (at least one is required).",
          );
          setIsSubmitting(false);
          return;
        }

        if (!useCityOrCountry && coresignalsSelectedCountries.length === 0) {
          alert("Please provide at least one Country Code.");
          setIsSubmitting(false);
          return;
        }

        // Prepare CoreSignal parameters
        const skillsForApi = selectedTechnologies.map((tech) =>
          tech.keyword.toLowerCase(),
        );

        const cityString =
          useCityOrCountry && coresignalsLocationPattern.length > 0
            ? coresignalsLocationPattern.join(", ")
            : undefined;

        // For CoreSignal, country should be a single string (first country)
        const countryString =
          !useCityOrCountry && coresignalsSelectedCountries.length > 0
            ? coresignalsSelectedCountries[0].keyword
            : undefined;

        schedulerParams = {
          api_name: "coresignal",
          interval: interval,
          limit: Number(limit),
          skills: skillsForApi,
          logic: skillsLogic,
          city: cityString,
          country: countryString,
        };
      } else if (api === "theirstack") {
        // Validation
        if (!theirstackLimit || !maxAgeDays) {
          alert(
            "Please fill all required fields (Limit and Max Age Days) before creating scheduler.",
          );
          setIsSubmitting(false);
          return;
        }

        if (locationPattern.length === 0 && selectedCountries.length === 0) {
          alert(
            "Please provide either Location Pattern or Country Code (at least one is required).",
          );
          setIsSubmitting(false);
          return;
        }

        if (theirstackEmploymentStatuses.length === 0) {
          alert("Please select at least one Employment Status.");
          setIsSubmitting(false);
          return;
        }

        // Prepare TheirStack parameters
        schedulerParams = {
          api_name: "theirstack",
          interval: interval,
          limit: Number(theirstackLimit),
          max_age_days: Number(maxAgeDays),
          location_pattern: useLocationPattern ? locationPattern : undefined,
          job_country_code_or: !useLocationPattern
            ? selectedCountries.map((c) => c.slug)
            : undefined,
          job_technology_slug:
            selectedTheirstackTechnologies.length > 0
              ? selectedTheirstackTechnologies.map((tech) => tech.slug)
              : undefined,
          employment_statuses:
            theirstackEmploymentStatuses.length > 0
              ? theirstackEmploymentStatuses
              : undefined,
          industry_id_or:
            selectedIndustries.length > 0
              ? selectedIndustries.map((ind) => Number(ind.slug))
              : undefined,
          logic: theirstackLogic,
        };
      } else if (api === "mantiks") {
        // Validation
        if (
          !mantiksLimit ||
          !mantiksJobAgeDays ||
          mantiksLocations.length === 0 ||
          mantiksSkills.length === 0
        ) {
          alert(
            "Please fill all required fields (Limit, Job Age Days, at least one Location, and at least one Skill) before creating scheduler.",
          );
          setIsSubmitting(false);
          return;
        }

        // Prepare Mantiks parameters
        schedulerParams = {
          api_name: "mantiks",
          interval: interval,
          limit: Number(mantiksLimit),
          job_age_in_days: Number(mantiksJobAgeDays),
          job_location_ids: mantiksLocations.map((loc) => Number(loc.slug)),
          job_description:
            mantiksSkills.length > 0
              ? mantiksSkills.map((skill) => skill.keyword.toLowerCase())
              : undefined,
          logic: "or",
        };
      } else {
        alert("Invalid API selection");
        setIsSubmitting(false);
        return;
      }

      // Call unified scheduler endpoint
      const response = await createUnifiedScheduler(schedulerParams);

      const jobsCount = response.initial_jobs_fetched ?? response.jobs_fetched ?? 0;
      const hasError = response.has_error ?? false;
      const success = response.success ?? true; // Default to true for backward compatibility

      // Build message based on response
      let message = "";
      let title = "";

      if (hasError) {
        // Error occurred
        title = "Scheduler Created with Errors";
        const errorType = response.error_type || "unknown_error";
        const errorMsg = response.error_message || "Unknown error occurred";
        const errorDetails = response.error_details;

        message = `Scheduler ID: ${response.scheduler_id}\n\n`;
        message += `⚠️ Error Type: ${errorType.toUpperCase().replace(/_/g, " ")}\n`;
        message += `Error: ${errorMsg}\n\n`;
        message += `Jobs Fetched: ${jobsCount}\n`;

        // Add error details if available
        if (errorDetails) {
          if (errorDetails.status_code) {
            message += `\nStatus Code: ${errorDetails.status_code}`;
          }
          if (errorDetails.rate_limit) {
            message += `\n⚠️ Rate limit exceeded. Please wait before trying again.`;
          }
          if (errorDetails.exception_type) {
            message += `\nException: ${errorDetails.exception_type}`;
          }
        }
      } else if (jobsCount === 0) {
        // No jobs found but no error (valid empty result)
        title = "Scheduler Created Successfully";
        message = `Scheduler ID: ${response.scheduler_id}\n\n`;
        message += `✅ Scheduler created successfully!\n`;
        message += `⚠️ No matching jobs found for the given criteria.\n\n`;
        message += `Jobs Fetched: ${jobsCount}\n`;
        if (response.warning) {
          message += `\nNote: ${response.warning}`;
        }
      } else {
        // Success with jobs
        title = "Scheduler Created Successfully";
        message = `Scheduler ID: ${response.scheduler_id}\n\n`;
        message += `✅ Scheduler created and executed successfully!\n\n`;
        message += `Jobs Fetched: ${jobsCount}`;
        if (response.warning) {
          message += `\n\n⚠️ ${response.warning}`;
        }
      }

      // Display alert with appropriate message
      alert(`${title}\n\n${message}`);

      // Reset form only if successful (no errors)
      if (success && !hasError) {
        if (api === "coresignals") {
          setLimit("");
          setCoresignalsMaxAgeDays("");
          setCoresignalsLocationPattern([]);
          setCoresignalsLocationInput("");
          setCoresignalsSelectedCountries([]);
          setCoresignalsCountryInput("");
          setCoresignalsCountryOptions([]);
          setSelectedTechnologies([]);
          setTechnologyInput("");
          setTechnologyOptions([]);
          setSkillsLogic("or");
        } else if (api === "theirstack") {
          setTheirstackLimit("");
          setMaxAgeDays("");
          setLocationPattern([]);
          setLocationInput("");
          setSelectedCountries([]);
          setCountryInput("");
          setCountryOptions([]);
          setSelectedTheirstackTechnologies([]);
          setTheirstackTechnologyInput("");
          setTheirstackTechnologyOptions([]);
          setSelectedIndustries([]);
          setIndustryInput("");
          setIndustryOptions([]);
          setTheirstackLogic("or");
          setTheirstackEmploymentStatuses([]);
        } else if (api === "mantiks") {
          setMantiksLimit("");
          setMantiksJobAgeDays("");
          setMantiksLocations([]);
          setMantiksLocationInput("");
          setMantiksLocationOptions([]);
          setMantiksSkills([]);
          setMantiksSkillInput("");
          setMantiksSkillOptions([]);
        }
      }
    } catch (error: any) {
      console.error("Failed to create scheduler:", error);
      let errorMessage = "Unknown error";
      let errorType = "unknown_error";
      let errorDetails: any = null;

      if (error.response?.data) {
        const data = error.response.data;
        
        // Check if response has structured error information
        if (data.has_error !== undefined) {
          errorType = data.error_type || "unknown_error";
          errorMessage = data.error_message || "Unknown error occurred";
          errorDetails = data.error_details;
          
          // Build detailed error message
          let message = `❌ Failed to Create Scheduler\n\n`;
          message += `Error Type: ${errorType.toUpperCase().replace(/_/g, " ")}\n`;
          message += `Error: ${errorMessage}\n\n`;
          
          if (data.scheduler_id) {
            message += `Scheduler ID: ${data.scheduler_id}\n`;
          }
          
          if (errorDetails) {
            if (errorDetails.status_code) {
              message += `\nStatus Code: ${errorDetails.status_code}`;
            }
            if (errorDetails.rate_limit) {
              message += `\n⚠️ Rate limit exceeded. Please wait before trying again.`;
            }
            if (errorDetails.api) {
              message += `\nAPI: ${errorDetails.api}`;
            }
          }
          
          alert(message);
          return;
        }
        
        // Fallback to old error handling format
        if (typeof data === "string") {
          errorMessage = data;
        } else if (data.detail) {
          if (typeof data.detail === "string") {
            errorMessage = data.detail;
          } else if (typeof data.detail === "object") {
            errorMessage = data.detail.message || data.detail.msg || JSON.stringify(data.detail);
            if (data.detail.type) {
              errorType = data.detail.type;
            }
          }
        } else if (data.message) {
          errorMessage = data.message;
        } else {
          errorMessage = JSON.stringify(data);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Display error alert with detailed information
      let message = `❌ Failed to Create Scheduler\n\n`;
      message += `Error: ${errorMessage}\n`;
      if (errorType !== "unknown_error") {
        message += `\nError Type: ${errorType.toUpperCase().replace(/_/g, " ")}`;
      }
      
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create Scheduler
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure and create a new job scheduler
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <ApiTabs onChange={(api: string) => setApi(api)} />

          {api === "coresignals" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Limit */}
                <div className="space-y-2">
                  <Label>
                    Limit <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter limit (e.g., 10)"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    min="1"
                  />
                </div>

                {/* Max Age Days */}
                <div className="space-y-2">
                  <Label>
                    Max Age Days <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter max age days (e.g., 30)"
                    value={coresignalsMaxAgeDays}
                    onChange={(e) => setCoresignalsMaxAgeDays(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              {/* City or Country Code (mutually exclusive) */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="coresignalsLocationType"
                      checked={useCityOrCountry}
                      onChange={() => {
                        setUseCityOrCountry(true);
                        setCoresignalsSelectedCountries([]);
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      City
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="coresignalsLocationType"
                      checked={!useCityOrCountry}
                      onChange={() => {
                        setUseCityOrCountry(false);
                        setCoresignalsLocationPattern([]);
                        setCoresignalsLocationInput("");
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Country
                    </span>
                  </label>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-red-500">*</span> At least one is
                  required
                </div>

                {useCityOrCountry ? (
                  <div className="space-y-2">
                    <Label>
                      City <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="Type city (e.g., mumbai)"
                          value={coresignalsLocationInput}
                          onChange={(e) =>
                            setCoresignalsLocationInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCoresignalsLocation();
                            }
                          }}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={addCoresignalsLocation}
                        className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        Add
                      </Button>
                    </div>
                    {coresignalsLocationPattern.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        {coresignalsLocationPattern.map((loc) => (
                          <div
                            key={loc}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-green-200 hover:to-green-200 dark:hover:from-green-900/50 dark:hover:to-green-900/50"
                          >
                            <span>{loc}</span>
                            <button
                              onClick={() => removeCoresignalsLocation(loc)}
                              className="text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-100 font-bold text-lg leading-none transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <ReactSelect
                      isMulti
                      name="coresignalsCountries"
                      options={coresignalsCountryOptions}
                      value={coresignalsSelectedCountries.map((country) => ({
                        value: country.keyword,
                        label: country.keyword,
                        slug: country.slug,
                      }))}
                      onInputChange={(input) =>
                        setCoresignalsCountryInput(input)
                      }
                      onChange={(selected: any) => {
                        const countries: SelectedCountry[] = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setCoresignalsSelectedCountries(countries);
                      }}
                      isLoading={isLoadingCoresignalsCountries}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search countries (e.g., India)"
                      noOptionsMessage={() =>
                        isLoadingCoresignalsCountries
                          ? "Loading..."
                          : coresignalsCountryInput
                            ? "No countries found"
                            : "Type to search countries"
                      }
                    />
                    {coresignalsSelectedCountries.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                        {coresignalsSelectedCountries.map((country) => (
                          <div
                            key={country.keyword}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-green-200 hover:to-green-200 dark:hover:from-green-900/50 dark:hover:to-green-900/50"
                          >
                            <span>{country.keyword}</span>
                            <button
                              onClick={() =>
                                setCoresignalsSelectedCountries(
                                  coresignalsSelectedCountries.filter(
                                    (c) => c.keyword !== country.keyword,
                                  ),
                                )
                              }
                              className="text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-100 font-bold text-lg leading-none transition-colors"
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

              {/* Skills */}
              {/* <div className="space-y-2">
                <Label>
                  Skills <span className="text-red-500">*</span>
                </Label>
                <ReactSelect
                  isMulti
                  name="technologies"
                  options={technologyOptions}
                  value={selectedTechnologies.map((tech) => ({
                    value: tech.keyword,
                    label: tech.keyword,
                    slug: tech.slug,
                  }))}
                  onInputChange={(input) => setTechnologyInput(input)}
                  onChange={(selected: any) => {
                    const techs: SelectedTechnology[] = selected
                      ? selected.map((opt: any) => ({
                          keyword: opt.value,
                          slug: opt.slug,
                        }))
                      : [];
                    setSelectedTechnologies(techs);
                  }}
                  styles={getCustomSelectStyles()}
                  menuPosition="fixed"
                  placeholder="Type to search technologies (e.g., Python)"
                  noOptionsMessage={() =>
                    technologyInput
                      ? "No technologies found"
                      : "Type to search technologies"
                  }
                />
                {selectedTechnologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {selectedTechnologies.map((tech) => (
                      <div
                        key={tech.keyword}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50"
                      >
                        <span>{tech.keyword}</span>
                        <button
                          onClick={() =>
                            setSelectedTechnologies(
                              selectedTechnologies.filter(
                                (t) => t.keyword !== tech.keyword
                              )
                            )
                          }
                          className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-bold text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div> */}
              <div className="space-y-2">
                <Label>
                  Skills <span className="text-red-500">*</span>
                </Label>

                <div className="flex items-center gap-3">
                  {/* Skills select */}
                  <div className="flex-1 w-full">
                    <ReactSelect
                      isMulti
                      name="technologies"
                      options={technologyOptions}
                      value={selectedTechnologies.map((tech) => ({
                        value: tech.keyword,
                        label: tech.keyword,
                        slug: tech.slug,
                      }))}
                      inputValue={technologyInput}
                      onInputChange={(input) => {
                        setTechnologyInput(input);
                        if (input.trim()) {
                          setTechnologyInputPreserved(input);
                        }
                      }}
                      onMenuClose={() => {
                        // Preserve input value when menu closes
                        if (technologyInput.trim()) {
                          setTechnologyInputPreserved(technologyInput);
                        }
                      }}
                      onChange={(selected: any) => {
                        const techs: SelectedTechnology[] = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setSelectedTechnologies(techs);
                      }}
                      isLoading={isLoadingTechnologies}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search technologies (e.g., Python)"
                      noOptionsMessage={() =>
                        isLoadingTechnologies
                          ? "Loading..."
                          : technologyInput
                            ? "No technologies found"
                            : "Type to search technologies"
                      }
                    />
                  </div>

                  {/* Add Skill button */}
                  <button
                    type="button"
                    onClick={handleAddCoresignalsSkill}
                    disabled={
                      (!technologyInput.trim() && !technologyInputPreserved.trim()) ||
                      technologyOptions.some(opt => 
                        opt.value.toLowerCase() === (technologyInput.trim() || technologyInputPreserved.trim()).toLowerCase()
                      )
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                    title={
                      technologyOptions.some(opt => 
                        opt.value.toLowerCase() === (technologyInput.trim() || technologyInputPreserved.trim()).toLowerCase()
                      )
                        ? "Skill already exists in the list"
                        : "Add new skill"
                    }
                  >
                    Add Skill
                  </button>

                  {/* OR / AND toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-medium ${skillsLogic === "or"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      OR
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setSkillsLogic(skillsLogic === "or" ? "and" : "or")
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${skillsLogic === "and"
                        ? "bg-blue-600"
                        : "bg-gray-300 dark:bg-gray-600"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${skillsLogic === "and"
                          ? "translate-x-6"
                          : "translate-x-1"
                          }`}
                      />
                    </button>

                    <span
                      className={`text-sm font-medium ${skillsLogic === "and"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      AND
                    </span>
                  </div>
                </div>

                {/* Selected skills chips */}
                {selectedTechnologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border mt-2">
                    {selectedTechnologies.map((tech) => (
                      <div
                        key={tech.keyword}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                      >
                        <span>{tech.keyword}</span>
                        <button
                          onClick={() =>
                            setSelectedTechnologies(
                              selectedTechnologies.filter(
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

              {/* Schedule Interval */}
              <div className="space-y-2 mt-4">
                <Label>
                  Interval <span className="text-red-500">*</span>
                </Label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly")}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="1hr">Every 1 Hour</option>
                  <option value="2hr">Every 2 Hours</option>
                  <option value="4hr">Every 4 Hours</option>
                  <option value="6hr">Every 6 Hours</option>
                  <option value="12hr">Every 12 Hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  className="px-8 py-2.5 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Scheduler"}
                </Button>
              </div>
            </div>
          )}

          {api === "theirstack" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Limit */}
                <div className="space-y-2">
                  <Label>
                    Limit <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter limit (e.g., 10)"
                    value={theirstackLimit}
                    onChange={(e) => setTheirstackLimit(e.target.value)}
                    min="1"
                  />
                </div>

                {/* Max Age Days */}
                <div className="space-y-2">
                  <Label>
                    Max Age Days <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter max age days (e.g., 30)"
                    value={maxAgeDays}
                    onChange={(e) => setMaxAgeDays(e.target.value)}
                    min="1"
                  />
                </div>
              </div>
              {/* Location Pattern or Country Code (mutually exclusive) */}
              <div className="space-y-4">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span className="text-red-500">*</span> At least one is
                  required
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="locationType"
                      checked={useLocationPattern}
                      onChange={() => {
                        setUseLocationPattern(true);
                        setSelectedCountries([]);
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      City
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="locationType"
                      checked={!useLocationPattern}
                      onChange={() => {
                        setUseLocationPattern(false);
                        setLocationPattern([]);
                        setLocationInput("");
                      }}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Country
                    </span>
                  </label>
                </div>

                {useLocationPattern ? (
                  <div className="space-y-2">
                    <Label>
                      City <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <Input
                          type="text"
                          placeholder="Type location (e.g., mumbai)"
                          value={locationInput}
                          onChange={(e) => setLocationInput(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        onClick={addLocation}
                        className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        Add
                      </Button>
                    </div>
                    {locationPattern.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        {locationPattern.map((loc) => (
                          <div
                            key={loc}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-green-200 hover:to-green-200 dark:hover:from-green-900/50 dark:hover:to-green-900/50"
                          >
                            <span>{loc}</span>
                            <button
                              onClick={() => removeLocation(loc)}
                              className="text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-100 font-bold text-lg leading-none transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>
                      Country <span className="text-red-500">*</span>
                    </Label>
                    <ReactSelect
                      isMulti
                      name="countries"
                      options={countryOptions}
                      value={selectedCountries.map((country) => ({
                        value: country.keyword,
                        label: country.keyword,
                        slug: country.slug,
                      }))}
                      onInputChange={(input) => setCountryInput(input)}
                      onChange={(selected: any) => {
                        const countries: SelectedCountry[] = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setSelectedCountries(countries);
                      }}
                      isLoading={isLoadingCountries}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search countries (e.g., India)"
                      noOptionsMessage={() =>
                        isLoadingCountries
                          ? "Loading..."
                          : countryInput
                            ? "No countries found"
                            : "Type to search countries"
                      }
                    />
                    {selectedCountries.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                        {selectedCountries.map((country) => (
                          <div
                            key={country.keyword}
                            className="bg-gradient-to-r from-green-100 to-green-100 dark:from-green-900/30 dark:to-green-900/30 text-green-800 dark:text-green-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-green-200 hover:to-green-200 dark:hover:from-green-900/50 dark:hover:to-green-900/50"
                          >
                            <span>{country.keyword}</span>
                            <button
                              onClick={() =>
                                setSelectedCountries(
                                  selectedCountries.filter(
                                    (c) => c.keyword !== country.keyword,
                                  ),
                                )
                              }
                              className="text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-100 font-bold text-lg leading-none transition-colors"
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


              {/* Industries */}
              {/* <div className="space-y-2">
                <Label>Industry ID</Label>
                <ReactSelect
                  isMulti
                  name="industries"
                  options={industryOptions}
                  value={selectedIndustries.map((industry) => ({
                    value: industry.keyword,
                    label: industry.keyword,
                    slug: industry.slug,
                  }))}
                  onInputChange={(input) => setIndustryInput(input)}
                  onChange={(selected: any) => {
                    const industries: SelectedIndustry[] = selected
                      ? selected.map((opt: any) => ({
                          keyword: opt.value,
                          slug: opt.slug,
                        }))
                      : [];
                    setSelectedIndustries(industries);
                  }}
                  isLoading={isLoadingIndustries}
                  styles={getCustomSelectStyles()}
                  menuPosition="fixed"
                  placeholder="Type to search industries"
                  noOptionsMessage={() =>
                    isLoadingIndustries
                      ? "Loading..."
                      : industryInput
                        ? "No industries found"
                        : "Type to search industries"
                  }
                />
                {selectedIndustries.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {selectedIndustries.map((industry) => (
                      <div
                        key={industry.keyword}
                        className="bg-gradient-to-r from-purple-100 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/30 text-purple-800 dark:text-purple-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-purple-200 hover:to-purple-200 dark:hover:from-purple-900/50 dark:hover:to-purple-900/50"
                      >
                        <span>{industry.keyword}</span>
                        <button
                          onClick={() =>
                            setSelectedIndustries(
                              selectedIndustries.filter(
                                (i) => i.keyword !== industry.keyword
                              )
                            )
                          }
                          className="text-purple-600 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-100 font-bold text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div> */}

              {/* Technologies */}
              <div className="space-y-2">
                <Label>
                  Skills <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  {/* Technology input - takes full width */}
                  <div className="flex-1 w-full">
                    <ReactSelect
                      isMulti
                      name="theirstackTechnologies"
                      options={theirstackTechnologyOptions}
                      value={selectedTheirstackTechnologies.map((tech) => ({
                        value: tech.keyword,
                        label: tech.keyword,
                        slug: tech.slug,
                      }))}
                      inputValue={theirstackTechnologyInput}
                      onInputChange={(input) => {
                        setTheirstackTechnologyInput(input);
                        if (input.trim()) {
                          setTheirstackTechnologyInputPreserved(input);
                        }
                      }}
                      onMenuClose={() => {
                        // Preserve input value when menu closes
                        if (theirstackTechnologyInput.trim()) {
                          setTheirstackTechnologyInputPreserved(theirstackTechnologyInput);
                        }
                      }}
                      onChange={(selected: any) => {
                        const techs: SelectedTechnology[] = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setSelectedTheirstackTechnologies(techs);
                      }}
                      isLoading={isLoadingTheirstackTechnologies}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search technologies (e.g., Python)"
                      noOptionsMessage={() =>
                        isLoadingTheirstackTechnologies
                          ? "Loading..."
                          : theirstackTechnologyInput
                            ? "No technologies found"
                            : "Type to search technologies"
                      }
                    />
                  </div>

                  {/* Add Skill button */}
                  <button
                    type="button"
                    onClick={handleAddTheirstackSkill}
                    disabled={
                      (!theirstackTechnologyInput.trim() && !theirstackTechnologyInputPreserved.trim()) ||
                      theirstackTechnologyOptions.some(opt => 
                        opt.value.toLowerCase() === (theirstackTechnologyInput.trim() || theirstackTechnologyInputPreserved.trim()).toLowerCase()
                      )
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                    title={
                      theirstackTechnologyOptions.some(opt => 
                        opt.value.toLowerCase() === (theirstackTechnologyInput.trim() || theirstackTechnologyInputPreserved.trim()).toLowerCase()
                      )
                        ? "Skill already exists in the list"
                        : "Add new skill"
                    }
                  >
                    Add Skill
                  </button>

                  {/* OR/AND toggle - small width on the right */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-medium transition-colors whitespace-nowrap ${theirstackLogic === "or"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      OR
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setTheirstackLogic(
                          theirstackLogic === "or" ? "and" : "or",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${theirstackLogic === "and"
                        ? "bg-blue-600"
                        : "bg-gray-300 dark:bg-gray-600"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theirstackLogic === "and"
                          ? "translate-x-6"
                          : "translate-x-1"
                          }`}
                      />
                    </button>
                    <span
                      className={`text-sm font-medium transition-colors whitespace-nowrap ${theirstackLogic === "and"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      AND
                    </span>
                  </div>
                </div>
                {selectedTheirstackTechnologies.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {selectedTheirstackTechnologies.map((tech) => (
                      <div
                        key={tech.keyword}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50"
                      >
                        <span>{tech.keyword}</span>
                        <button
                          onClick={() =>
                            setSelectedTheirstackTechnologies(
                              selectedTheirstackTechnologies.filter(
                                (t) => t.keyword !== tech.keyword,
                              ),
                            )
                          }
                          className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-bold text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Employment Status */}
              <div className="space-y-2">
                <Label>
                  Employment Status <span className="text-red-500">*</span>
                </Label>
                <ReactSelect
                  isMulti
                  name="employmentStatuses"
                  options={employmentStatusOptions}
                  value={employmentStatusOptions.filter((opt) =>
                    theirstackEmploymentStatuses.includes(opt.value)
                  )}
                  onChange={(selected: any) => {
                    const statuses: string[] = selected
                      ? selected.map((opt: any) => opt.value)
                      : [];
                    setTheirstackEmploymentStatuses(statuses);
                  }}
                  styles={getCustomSelectStyles()}
                  menuPosition="fixed"
                  placeholder="Select employment status(es)"
                />
                {theirstackEmploymentStatuses.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {theirstackEmploymentStatuses.map((status) => {
                      const label = employmentStatusOptions.find((opt) => opt.value === status)?.label || status;
                      return (
                        <div
                          key={status}
                          className="bg-gradient-to-r from-purple-100 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/30 text-purple-800 dark:text-purple-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                        >
                          <span>{label}</span>
                          <button
                            onClick={() =>
                              setTheirstackEmploymentStatuses(
                                theirstackEmploymentStatuses.filter((s) => s !== status),
                              )
                            }
                            className="text-purple-600 dark:text-purple-300 font-bold text-lg"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Schedule Interval */}
              <div className="space-y-2 mt-4">
                <Label>
                  Interval <span className="text-red-500">*</span>
                </Label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly")}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="1hr">Every 1 Hour</option>
                  <option value="2hr">Every 2 Hours</option>
                  <option value="4hr">Every 4 Hours</option>
                  <option value="6hr">Every 6 Hours</option>
                  <option value="12hr">Every 12 Hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  className="px-8 py-2.5 text-base font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Scheduler"}
                </Button>
              </div>
            </div>
          )}

          {api === "mantiks" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Limit */}
                <div className="space-y-2">
                  <Label>
                    Limit <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter limit (e.g., 10)"
                    value={mantiksLimit}
                    onChange={(e) => setMantiksLimit(e.target.value)}
                    min="1"
                  />
                </div>

                {/* Job Age Days */}
                <div className="space-y-2">
                  <Label>
                    Max Age Days<span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter job age in days (e.g., 90)"
                    value={mantiksJobAgeDays}
                    onChange={(e) => setMantiksJobAgeDays(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              {/* Job Location IDs */}
              <div className="space-y-2">
                <Label>
                  Country <span className="text-red-500">*</span>
                </Label>
                <ReactSelect
                  isMulti
                  name="mantiksLocations"
                  options={mantiksLocationOptions}
                  value={mantiksLocations.map((location) => ({
                    value: location.keyword,
                    label: location.keyword,
                    slug: location.slug,
                  }))}
                  onInputChange={(input) => setMantiksLocationInput(input)}
                  onChange={(selected: any) => {
                    const locations: SelectedCountry[] = selected
                      ? selected.map((opt: any) => ({
                        keyword: opt.value,
                        slug: opt.slug,
                      }))
                      : [];
                    setMantiksLocations(locations);
                  }}
                  isLoading={isLoadingMantiksLocations}
                  styles={getCustomSelectStyles()}
                  menuPosition="fixed"
                  placeholder="Type to search countries (e.g., India)"
                  noOptionsMessage={() =>
                    isLoadingMantiksLocations
                      ? "Loading..."
                      : mantiksLocationInput
                        ? "No countries found"
                        : "Type to search countries"
                  }
                />
                {mantiksLocations.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {mantiksLocations.map((location) => (
                      <div
                        key={location.slug}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium transition-all hover:from-blue-200 hover:to-indigo-200 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50"
                      >
                        <span>{location.keyword}</span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMantiksLocationId(location.slug)
                          }
                          className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-bold text-lg leading-none transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <Label>
                  Skills <span className="text-red-500">*</span>
                </Label>
                <div className="flex items-center gap-3">
                  {/* Skills input - takes full width */}
                  <div className="flex-1 w-full">
                    <ReactSelect
                      isMulti
                      name="mantiksSkills"
                      options={mantiksSkillOptions}
                      value={mantiksSkills.map((skill) => ({
                        value: skill.keyword,
                        label: skill.keyword,
                        slug: skill.slug,
                      }))}
                      inputValue={mantiksSkillInput}
                      onInputChange={(input) => {
                        setMantiksSkillInput(input);
                        if (input.trim()) {
                          setMantiksSkillInputPreserved(input);
                        }
                      }}
                      onMenuClose={() => {
                        // Preserve input value when menu closes
                        if (mantiksSkillInput.trim()) {
                          setMantiksSkillInputPreserved(mantiksSkillInput);
                        }
                      }}
                      onChange={(selected: any) => {
                        const skills: SelectedTechnology[] = selected
                          ? selected.map((opt: any) => ({
                            keyword: opt.value,
                            slug: opt.slug,
                          }))
                          : [];
                        setMantiksSkills(skills);
                      }}
                      isLoading={isLoadingMantiksSkills}
                      styles={getCustomSelectStyles()}
                      menuPosition="fixed"
                      placeholder="Type to search skills (e.g., Python)"
                      noOptionsMessage={() =>
                        isLoadingMantiksSkills
                          ? "Loading..."
                          : mantiksSkillInput
                            ? "No skills found"
                            : "Type to search skills"
                      }
                    />
                  </div>

                  {/* Add Skill button */}
                  <button
                    type="button"
                    onClick={handleAddMantiksSkill}
                    disabled={
                      (!mantiksSkillInput.trim() && !mantiksSkillInputPreserved.trim()) ||
                      mantiksSkillOptions.some(opt => 
                        opt.value.toLowerCase() === (mantiksSkillInput.trim() || mantiksSkillInputPreserved.trim()).toLowerCase()
                      )
                    }
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                    title={
                      mantiksSkillOptions.some(opt => 
                        opt.value.toLowerCase() === (mantiksSkillInput.trim() || mantiksSkillInputPreserved.trim()).toLowerCase()
                      )
                        ? "Skill already exists in the list"
                        : "Add new skill"
                    }
                  >
                    Add Skill
                  </button>

                  {/* OR/AND toggle - small width on the right */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-medium transition-colors whitespace-nowrap ${skillsLogic === "or"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      OR
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSkillsLogic(
                          skillsLogic === "or" ? "and" : "or",
                        )
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${skillsLogic === "and"
                        ? "bg-blue-600"
                        : "bg-gray-300 dark:bg-gray-600"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${skillsLogic === "and"
                          ? "translate-x-6"
                          : "translate-x-1"
                          }`}
                      />
                    </button>
                    <span
                      className={`text-sm font-medium transition-colors whitespace-nowrap ${skillsLogic === "and"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      AND
                    </span>
                  </div>
                </div>
                {mantiksSkills.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 mt-2">
                    {mantiksSkills.map((skill) => (
                      <div
                        key={skill.keyword}
                        className="bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-800 dark:text-blue-200 px-3 py-1.5 rounded-md flex items-center gap-2 text-sm font-medium"
                      >
                        <span>{skill.keyword}</span>
                        <button
                          onClick={() =>
                            setMantiksSkills(
                              mantiksSkills.filter(
                                (s) => s.keyword !== skill.keyword,
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

              {/* Schedule Interval */}
              <div className="space-y-2 mt-4">
                <Label>
                  Interval <span className="text-red-500">*</span>
                </Label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "1hr" | "2hr" | "4hr" | "6hr" | "12hr" | "daily" | "weekly")}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="1hr">Every 1 Hour</option>
                  <option value="2hr">Every 2 Hours</option>
                  <option value="4hr">Every 4 Hours</option>
                  <option value="6hr">Every 6 Hours</option>
                  <option value="12hr">Every 12 Hours</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Creating..." : "Create Scheduler"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// React-Select custom styles with dark mode support
const getCustomSelectStyles = () => {
  // Check for dark mode by looking at the document element
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
