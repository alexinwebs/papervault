"use client";

import { useId, useState } from "react";

/**
 * File input for private documents (verification proof, ticket attachments).
 * Client-side checks are only for quick feedback; the server re-validates
 * size, real content type and scans every file.
 */
export function DocumentPicker({
  name,
  label,
  maxFiles,
  maxBytes,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  maxFiles: number;
  maxBytes: number;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mb = Math.round(maxBytes / 1024 / 1024);

  return (
    <div>
      <label className="pv-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="file"
        multiple={maxFiles > 1}
        required={required}
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        className="pv-input py-2 file:mr-3 file:border-2 file:border-ink file:bg-cream file:px-2 file:py-1 file:font-mono file:text-[11px] file:uppercase"
        aria-describedby={`${id}-hint`}
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          setFiles(picked);
          if (picked.length > maxFiles) setError(`Choose at most ${maxFiles} files.`);
          else if (picked.some((f) => f.size > maxBytes)) setError(`Each file must be under ${mb} MB.`);
          else if (picked.some((f) => !/\.(pdf|jpe?g|png)$/i.test(f.name))) setError("Only PDF, JPG and PNG files are accepted.");
          else setError(null);
        }}
      />
      <p id={`${id}-hint`} className="mt-1 font-sans text-[11px] text-ink/60">
        PDF, JPG or PNG · up to {mb} MB each{maxFiles > 1 ? ` · up to ${maxFiles} files` : ""}.{" "}
        {hint ?? "Files are scanned for malware and stored privately."}
      </p>
      {files.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1" aria-label="Selected files">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="font-mono text-[11px]">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 font-sans text-[11px] text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
