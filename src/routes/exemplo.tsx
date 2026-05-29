import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/exemplo")({
  head: () => ({
    meta: [
      { title: "Exemplo de síntese — Lente" },
      { name: "description", content: "Veja em 5 segundos o que a Lente produz: temas, clipes de vídeo citáveis e recomendações de negócio a partir de 12 entrevistas." },
      { property: "og:title", content: "Exemplo de síntese — Lente" },
      { property: "og:description", content: "Síntese real de um estudo de onboarding com 12 entrevistas." },
    ],
  }),
  component: DemoPage,
});

const STUDY = {
  title: "Onboarding de conta digital — abandono no fluxo inicial",
  client: "Banco fictício · Q4 2025",
  brief: "Entender por que 38% dos usuários que iniciam o cadastro não concluem a abertura de conta na primeira sessão.",
  metrics: [
    { label: "Entrevistas", val: "12 / 12" },
    { label: "Duração média", val: "18 min" },
    { label: "Follow-ups gerados", val: "47" },
    { label: "Temas identificados", val: "7" },
    { label: "Clipes citáveis", val: "31" },
    { label: "Tempo até síntese", val: "2h" },
  ],
};

const THEMES = [
  {
    id: 1,
    tag: "Tema recorrente · alta confiança",
    title: "Abandono no passo de verificação bancária por falta de contexto",
    summary: "Apareceu em 9 das 12 entrevistas. A objeção não é segurança — é falta de contexto sobre por que o dado é pedido naquele momento do fluxo.",
    coverage: "9 / 12",
    confidence: "alta",
    clips: [
      { name: "Marina, 34 · SP", time: "00:04:12", quote: "Aí eu pensei: por que eles querem isso agora? Travei e fechei o app." },
      { name: "Rafael, 28 · BH", time: "00:02:48", quote: "Não tinha nem aberto a conta direito e já queriam meu banco." },
      { name: "Júlia, 41 · POA", time: "00:06:31", quote: "Se tivesse uma frase explicando, eu teria continuado." },
    ],
    recommendation: "Mover a verificação bancária para depois do primeiro uso, ou adicionar contexto inline antes do pedido.",
  },
  {
    id: 2,
    tag: "Tema recorrente · média confiança",
    title: "Confusão entre 'conta digital' e 'conta corrente tradicional'",
    summary: "7 entrevistados acreditavam que estavam abrindo uma conta secundária — não a principal. Isso reduz o engajamento pós-cadastro.",
    coverage: "7 / 12",
    confidence: "média",
    clips: [
      { name: "Carlos, 52 · RJ", time: "00:08:22", quote: "Achei que era tipo uma carteira, não uma conta de verdade." },
      { name: "Beatriz, 29 · REC", time: "00:05:14", quote: "Só fui entender depois de receber o cartão físico." },
    ],
    recommendation: "Reposicionar a copy do hero do onboarding: deixar explícito que é a conta principal, não uma conta auxiliar.",
  },
  {
    id: 3,
    tag: "Sinal fraco · baixa confiança",
    title: "Expectativa de cashback influencia a decisão de concluir",
    summary: "3 entrevistados mencionaram comparar com concorrentes durante o fluxo. Amostra pequena — vale validar quantitativamente.",
    coverage: "3 / 12",
    confidence: "baixa",
    clips: [
      { name: "Diego, 31 · CWB", time: "00:11:05", quote: "Abri outra aba pra ver se o do concorrente tinha cashback maior." },
    ],
    recommendation: "Não acionar mudança ainda. Incluir pergunta sobre comparação competitiva no próximo estudo quantitativo.",
  },
];

function DemoPage() {
  const [activeTheme, setActiveTheme] = useState(1);
  const theme = THEMES.find((t) => t.id === activeTheme)!;
  const confidenceColor =
    theme.confidence === "alta"
      ? "bg-primary/10 text-primary"
      : theme.confidence === "média"
      ? "bg-accent/15 text-accent"
      : "bg-muted text-muted-foreground";

  return (
    <div>
      {/* Faixa demo-ready — sinaliza que a página é um link compartilhável de apresentação */}
      <div className="border-b border-primary/20 bg-primary/5">
        <div className="mx-auto max-w-6xl px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-mono uppercase tracking-wider">Demo-ready</span>
            <span className="text-muted-foreground hidden sm:inline">· síntese real de exemplo, pronta para apresentar em reunião</span>
          </div>
          <a
            href="mailto:janilo@pereirasaraiva.com?subject=Conversa%20sobre%20a%20Lente&body=Vi%20a%20demo%20em%20%2Fexemplo%20e%20queria%20conversar."
            className="rounded-sm border border-primary/40 bg-background px-2.5 py-1 font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Agendar conversa →
          </a>
        </div>
      </div>

      {/* Header da demo */}
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span className="px-2 py-1 rounded-sm bg-accent/15 text-accent uppercase tracking-wider">Exemplo · dados ilustrativos</span>
            <span>Síntese gerada pela Lente</span>
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl leading-tight max-w-3xl">
            {STUDY.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-mono">{STUDY.client}</p>
          <p className="mt-4 max-w-3xl text-base text-muted-foreground leading-relaxed">
            <span className="jps-eyebrow mr-2">Briefing</span>
            {STUDY.brief}
          </p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-border pt-6">
            {STUDY.metrics.map((m) => (
              <div key={m.label}>
                <div className="font-display text-2xl">{m.val}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Síntese — temas + detalhe */}
      <section>
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="jps-eyebrow">Síntese</p>
          <h2 className="mt-3 text-3xl md:text-4xl leading-tight">
            3 temas <em className="font-display italic text-primary">acionáveis</em>, cada um com evidência em vídeo.
          </h2>

          <div className="mt-10 grid gap-6 lg:grid-cols-5">
            {/* Lista de temas */}
            <aside className="lg:col-span-2 space-y-3">
              {THEMES.map((t) => {
                const active = t.id === activeTheme;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTheme(t.id)}
                    className={`w-full text-left p-5 rounded-md border transition-colors ${
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {t.tag}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{t.coverage}</span>
                    </div>
                    <p className="mt-2 text-base leading-snug">{t.title}</p>
                  </button>
                );
              })}
            </aside>

            {/* Detalhe do tema selecionado */}
            <div className="lg:col-span-3 rounded-md border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  tema {String(theme.id).padStart(2, "0")} de {String(THEMES.length).padStart(2, "0")}
                </span>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-sm ${confidenceColor}`}>
                    confiança {theme.confidence}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{theme.coverage} evidências</span>
                </div>
                <h3 className="mt-3 text-2xl leading-tight">{theme.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{theme.summary}</p>

                <div className="mt-6">
                  <p className="jps-eyebrow text-muted-foreground">Clipes citáveis</p>
                  <div className="mt-3 space-y-3">
                    {theme.clips.map((c) => (
                      <div
                        key={c.name + c.time}
                        className="flex gap-4 p-3 rounded-sm border border-border bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="relative shrink-0 w-24 h-16 rounded-sm bg-muted flex items-center justify-center">
                          <svg className="w-6 h-6 text-background" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          <span className="absolute bottom-1 right-1 text-[10px] font-mono text-background bg-foreground/70 px-1 rounded-sm">
                            {c.time}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">"{c.quote}"</p>
                          <p className="mt-1.5 text-xs text-muted-foreground font-mono">{c.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <p className="jps-eyebrow text-accent">Recomendação</p>
                  <p className="mt-2 text-lg leading-snug">{theme.recommendation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Antes / depois */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="jps-eyebrow">Bastidor</p>
          <h2 className="mt-3 text-3xl md:text-4xl leading-tight max-w-3xl">
            Da transcrição crua ao insight <em className="font-display italic text-primary">com fonte clicável</em>.
          </h2>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-6">
              <p className="jps-eyebrow text-muted-foreground">Entrada — transcrição</p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground font-mono leading-relaxed">
                <p>[00:03:12] entrevistador: e como foi sua experiência abrindo a conta?</p>
                <p>[00:03:18] entrevistado: ah, foi… começou bem, gostei do design, mas aí num certo ponto pediram meu banco e eu não entendi…</p>
                <p>[00:03:34] entrevistador: pode falar mais sobre esse momento?</p>
                <p>[00:03:38] entrevistado: então, eu acho que… não sei, travei. fechei o app.</p>
                <p className="text-muted-foreground/60">… +14 minutos de transcrição</p>
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-background p-6">
              <p className="jps-eyebrow text-primary">Saída — insight estruturado</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">PADRÃO</p>
                  <p className="mt-1 text-base leading-snug">Abandono no passo de verificação bancária por falta de contexto.</p>
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">EVIDÊNCIA</p>
                  <p className="mt-1 text-base leading-snug italic">
                    "travei. fechei o app." — Marina, 00:03:38 <span className="text-primary">▶</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">AÇÃO SUGERIDA</p>
                  <p className="mt-1 text-base leading-snug">Adicionar contexto inline antes do pedido de dados bancários.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <p className="jps-eyebrow">Pronto para o seu estudo</p>
              <h2 className="mt-3 text-3xl md:text-4xl leading-tight">
                Rode com <em className="font-display italic text-primary">suas próprias entrevistas</em> — ou converse com quem construiu.
              </h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="mailto:janilo@pereirasaraiva.com?subject=Conversa%20sobre%20a%20Lente&body=Vi%20a%20demo%20em%20%2Fexemplo%20e%20queria%20conversar%20sobre%20aplicar%20a%20Lente%20no%20seguinte%20cen%C3%A1rio%3A%0A%0A"
                className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground text-center"
              >
                Agendar conversa
              </a>
              <Link
                to="/signup"
                className="rounded-md border border-border bg-card px-5 py-3 text-sm font-medium text-foreground hover:bg-accent text-center"
              >
                Criar conta de pesquisador
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
