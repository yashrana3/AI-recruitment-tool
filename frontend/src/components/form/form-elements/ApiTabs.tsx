import { useState } from "react";

const apiOptions = [
  { value: "coresignals", label: "Coresignals" },
  { value: "theirstack", label: "Theirstack" },
  { value: "mantiks", label: "Mantiks" },
];

export default function ApiTabs({
  onChange,
}: {
  onChange: (api: string) => void;
}) {
  const [api, setApi] = useState<string>("coresignals");

  const handleTabChange = (value: string) => {
    setApi(value);
    onChange(value);
  };

  return (
    <div className="mb-6">
      <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1 shadow-sm">
        {apiOptions.map((opt) => {
          const active = api === opt.value;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTabChange(opt.value)}
              className={`
                relative px-6 py-2.5 text-sm font-semibold rounded-md transition-all duration-200
                ${active
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }
              `}
            >
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
