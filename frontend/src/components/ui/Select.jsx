import { forwardRef, useId } from "react";
import { ChevronDown } from "lucide-react";
import { Field } from "./Input.jsx";

const Select = forwardRef(function Select(
  { label, hint, error, required, id, className = "", children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id || generatedId;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={selectId}
    >
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`input appearance-none pr-10 ${className}`}
          aria-invalid={Boolean(error)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      </div>
    </Field>
  );
});

export default Select;
