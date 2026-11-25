import { QueryCategory } from '@semcache/shared-types';
import { CATEGORY_LABELS } from '@/features/knowledge-base/model/knowledge-base-helpers';
import { cn } from '@/shared/lib/utils';

export interface QueryCategorySelectProps {
  id?: string;
  ariaLabel?: string;
  value: QueryCategory | 'all';
  onChange: (value: QueryCategory | 'all') => void;
  includeAllOption?: boolean;
  className?: string;
}

export function QueryCategorySelect({
  id,
  ariaLabel,
  value,
  onChange,
  includeAllOption = false,
  className,
}: QueryCategorySelectProps) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value as QueryCategory | 'all')}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 text-sm',
        className,
      )}
    >
      {includeAllOption ? <option value="all">All categories</option> : null}
      {Object.values(QueryCategory).map((cat) => (
        <option key={cat} value={cat}>
          {CATEGORY_LABELS[cat]}
        </option>
      ))}
    </select>
  );
}
