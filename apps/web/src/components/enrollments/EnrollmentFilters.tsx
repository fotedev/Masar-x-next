
import { useTranslations } from "next-intl";
import { Button } from "../ui";
import { Search } from "lucide-react";

interface EnrollmentFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  activeFilter: string;
  setActiveFilter: (value: string) => void;
}

export function EnrollmentFilters({
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
}: EnrollmentFiltersProps) {
  const t = useTranslations("enrollments");

  const filters = [
    { id: "all", label: t("filterAll") },
    { id: "pending", label: t("statusPending") },
    { id: "active", label: t("statusActive") },
    { id: "rejected", label: t("statusRejected") },
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
      <div className="relative w-full md:w-96">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            variant={activeFilter === filter.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(filter.id)}
            className="whitespace-nowrap"
          >
            {filter.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
