import { getCategory, type CategoryId } from "@/lib/categories";

type Props = {
  category: CategoryId;
  showLabel?: boolean;
  size?: "sm" | "md";
};

export function CategoryBadge({ category, showLabel = true, size = "md" }: Props) {
  const { label, icon: Icon, color } = getCategory(category);
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? 16 : 20;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${box} inline-flex shrink-0 items-center justify-center rounded-full`}
        style={{ backgroundColor: `${color}1f`, color }}
        aria-hidden={showLabel}
        title={showLabel ? undefined : label}
      >
        <Icon size={iconSize} strokeWidth={2.25} />
      </span>
      {showLabel ? (
        <span className="text-sm font-medium">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}
