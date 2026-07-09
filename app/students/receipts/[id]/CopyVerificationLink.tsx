"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyVerificationLink({ qrCodeValue }: { qrCodeValue: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(qrCodeValue);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "¡Copiado!" : "Copiar enlace de verificación"}
      </Button>
      <a href={qrCodeValue} target="_blank" rel="noreferrer" className="text-sm font-semibold text-petrol-600 hover:underline">
        Ver página de verificación →
      </a>
    </div>
  );
}
