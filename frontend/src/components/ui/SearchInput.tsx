import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Extra classes for the wrapper (e.g. "flex-1 max-w-md" for filter rows). */
  className?: string
  'aria-label'?: string
}

/**
 * Single shared search bar for every page (Departments, Faculty, Classrooms,
 * Subjects, …). Rendering and spacing come from the shared `.search-input` /
 * `.search-icon` rules in index.css so the icon, placeholder and borders stay
 * identical everywhere and on small screens. Filtering stays the caller's job.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder,
  className = '',
  'aria-label': ariaLabel,
}: SearchInputProps) {
  return (
    <div className={`relative w-full min-w-0 ${className}`}>
      <Search className="search-icon" aria-hidden="true" />
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  )
}
