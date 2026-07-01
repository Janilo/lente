import { useState } from "react";
import { LGPD_TERMS, LGPD_VERSION } from "@/lib/lgpd";

export function ConsentCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border bg-muted/30 p-4">
      <label className="flex items-start gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-input"
        />
        <span>
          Li e aceito o{""}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpen((o) => !o);
            }}
            className="text-primary underline"
          >
            termo de privacidade ({LGPD_VERSION})
          </button>
          {""}e autorizo a gravação em vídeo das minhas respostas para fins desta pesquisa, conforme
          a LGPD.
        </span>
      </label>
      {open && (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-3 text-xs text-muted-foreground font-sans">
          {LGPD_TERMS}
        </pre>
      )}
    </div>
  );
}
