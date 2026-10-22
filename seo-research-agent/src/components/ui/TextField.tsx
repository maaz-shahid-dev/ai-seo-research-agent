import { useId, type InputHTMLAttributes } from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Keeps the label for screen readers when the placeholder already explains the field. */
  hideLabel?: boolean;
  hint?: string;
};

export function TextField({ label, hideLabel = false, hint, id, className = "", ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={hideLabel ? "sr-only" : "mb-1.5 block text-sm font-medium text-slate-700"}
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-describedby={hintId}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 placeholder:text-slate-400"
        {...props}
      />
      {hint ? <p id={hintId} className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
