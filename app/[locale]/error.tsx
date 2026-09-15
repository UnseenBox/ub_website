"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

const COPY = {
  en: { title: "Something broke inside the box.", text: "An unexpected error occurred. Try again in a moment.", retry: "Try again" },
  fr: { title: "Quelque chose s'est cassé dans la boîte.", text: "Une erreur inattendue s'est produite. Réessayez dans un instant.", retry: "Réessayer" },
  ar: { title: "انكسر شيءٌ داخل الصندوق.", text: "حدث خطأ غير متوقّع. حاول مجددًا بعد لحظة.", retry: "حاول مجددًا" },
} as const;

export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const copy = COPY[(params.locale as keyof typeof COPY) ?? "en"] ?? COPY.en;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="shell flex min-h-[80svh] flex-col justify-center gap-6 pt-28" role="alert">
      <p className="font-pixel text-uv-400">ERR{error.digest ? ` · ${error.digest}` : ""}</p>
      <h1 className="font-display max-w-3xl text-title text-balance">{copy.title}</h1>
      <p className="max-w-xl text-mist">{copy.text}</p>
      <div>
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex h-12 items-center bg-bone px-6 font-mono text-xs uppercase tracking-[0.16em] text-void transition-colors hover:bg-uv-500 hover:text-white"
        >
          {copy.retry}
        </button>
      </div>
    </section>
  );
}
