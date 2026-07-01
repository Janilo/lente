import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { getQualificationData, saveQualification } from "@/lib/qualification.functions";

export const Route = createFileRoute("/_authenticated/qualificacao")({
  head: () => ({ meta: [{ title: "Complete seu perfil — Lente" }] }),
  validateSearch: z.object({ returnTo: z.string().optional() }),
  component: QualificationPage,
});

const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

function QualificationPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const getFn = useServerFn(getQualificationData);
  const saveFn = useServerFn(saveQualification);

  const { data, isLoading } = useQuery({
    queryKey: ["qualification"],
    queryFn: () => getFn(),
  });

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [occupation, setOccupation] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [linkedin, setLinkedin] = useState("");
  // dimension_id -> tag_value_id (""= não informar)
  const [tagByDim, setTagByDim] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setFullName(data.profile?.full_name ?? "");
    setCompany(data.profile?.company ?? "");
    setOccupation(data.profile?.occupation ?? "");
    setCity(data.profile?.city ?? "");
    setState(data.profile?.state ?? "");
    setAgeRange(data.profile?.age_range ?? "");
    setLinkedin(data.profile?.linkedin_url ?? "");
    const map: Record<string, string> = {};
    for (const dim of data.dimensions) {
      const match = dim.values.find((v) => data.currentTagValueIds.includes(v.id));
      if (match) map[dim.id] = match.id;
    }
    setTagByDim(map);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const tag_value_ids = Object.values(tagByDim).filter(Boolean);
      return saveFn({
        data: {
          profile: {
            full_name: fullName.trim(),
            company: company.trim() || null,
            occupation: occupation.trim() || null,
            city: city.trim() || null,
            state: state.trim() || null,
            age_range: ageRange || null,
            linkedin_url: linkedin.trim() || null,
            consent_research: true,
          },
          tag_value_ids,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Perfil salvo (${res.tags_count} segmento(s)).`);
      navigate({ to: returnTo || "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="jps-eyebrow">Complete seu perfil</p>
      <h1 className="mt-3 text-4xl">Conte um pouco sobre você</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Essas informações nos ajudam a convidá-lo para os estudos certos. Leva menos de 1 minuto.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!fullName.trim()) {
            toast.error("Nome completo é obrigatório.");
            return;
          }
          save.mutate();
        }}
        className="mt-10 space-y-8"
      >
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Dados básicos
          </h2>
          <Field label="Nome completo *">
            <input
              required
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empresa">
              <input
                maxLength={120}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Cargo / função">
              <input
                maxLength={120}
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Cidade">
              <input
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Estado (UF)">
              <input
                maxLength={40}
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Faixa etária">
              <select
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                className={inputCls}
              >
                <option value="">—</option>
                {AGE_RANGES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="LinkedIn (URL)">
              <input
                type="url"
                maxLength={300}
                placeholder="https://linkedin.com/in/…"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Segmentação
          </h2>
          <p className="text-xs text-muted-foreground">
            Escolha o que mais se encaixa. Opcional, mas ajuda na curadoria de estudos.
          </p>
          {(data?.dimensions ?? []).map((dim) => (
            <Field key={dim.id} label={dim.label}>
              <select
                value={tagByDim[dim.id] ?? ""}
                onChange={(e) => setTagByDim((prev) => ({ ...prev, [dim.id]: e.target.value }))}
                className={inputCls}
                disabled={dim.values.length === 0}
              >
                <option value="">
                  {dim.values.length === 0 ? "Sem opções cadastradas" : "— selecionar —"}
                </option>
                {dim.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </section>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate({ to: returnTo || "/dashboard" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Pular por agora
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? "Salvando…" : "Salvar e continuar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
