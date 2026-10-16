import { forwardRef, useId } from "react";

export function Field({ label, hint, error, required, children, htmlFor }) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-rose-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

const Input = forwardRef(function Input(
  { label, hint, error, required, id, className = "", prefix, suffix, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={required}
      htmlFor={inputId}
    >
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 text-sm text-ink-400">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${prefix ? "pl-9" : ""} ${suffix ? "pr-11" : ""} ${
            error ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15" : ""
          } ${className}`}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-xs font-medium text-ink-400">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
});

export default Input;
