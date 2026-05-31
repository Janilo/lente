import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lente · Pesquisa qualitativa em vídeo com IA" },
      {
        name: "description",
        content:
          "Conduza entrevistas em vídeo com follow-ups adaptativos. Transcrição automática, síntese de insights e recomendações baseadas em evidências.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div>
      {/* HERO */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16">
        <div className="max-w-3xl">
          <p className="jps-eyebrow">Pesquisa qualitativa · IA</p>
          <h1 className="mt-5 text-6xl md:text-7xl leading-[0.95]">
            Entrevistas em vídeo que{""}
            <em className="lede-em">{"\u00A0"}se aprofundam</em> sozinhas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Você define o roteiro e o contexto. A Lente conduz cada entrevista com perguntas de follow-up adaptativas,
            transcreve as respostas e devolve uma síntese com recortes em vídeo das citações que sustentam cada insight.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 h-10 px-8 text-xs font-semibold uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Criar conta
            </Link>
            <div className="inline-flex flex-col gap-1.5">
              <Link
                to="/demo"
                className="inline-flex items-center justify-center gap-2 h-10 px-8 text-xs font-semibold uppercase tracking-[0.18em] border-[1.5px] border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Eye className="w-4 h-4" />
                Ver demo
              </Link>
              <p className="text-[11px] text-[#5F5B55] leading-[1.7]">
                Sem cadastro<br />
                carrega na hora<br />
                dados ilustrativos
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center h-10 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground transition-colors"
            >
              Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW — o que sai */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <div className="flex items-end justify-between gap-8 mb-10">
            <div>
              <p className="jps-eyebrow">O que você recebe</p>
              <h2 className="mt-4 text-4xl md:text-5xl leading-[1.05] max-w-2xl">
                Uma síntese <em className="lede-em">com evidência em vídeo</em>: cada insight abre o clipe original.
              </h2>
            </div>
            <p className="hidden md:block text-sm text-muted-foreground max-w-xs">
              Cada insight vem ancorado em clipes citáveis dos próprios entrevistados — você clica e ouve a fala
              original.
            </p>
          </div>

          {/* Mock do output da síntese */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Painel principal — tema com clipes */}
            <div className="lg:col-span-3 rounded-md border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-accent/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono">síntese / tema 03 de 07</span>
              </div>

              <div className="p-6">
                <p className="jps-eyebrow text-primary">Tema recorrente</p>
                <h3 className="mt-3 text-2xl leading-tight">
                  Usuários abandonam o onboarding no{" "}
                  <em className="lede-em">passo de verificação bancária</em>.
                </h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Apareceu em 9 das 12 entrevistas. A objeção é de contexto: falta explicar por que o dado
                  é pedido naquele momento do fluxo.
                </p>

                {/* Clipes de vídeo citáveis */}
                <div className="mt-6 space-y-3">
                  {[
                    {
                      name: "Marina, 34 · SP",
                      time: "00:04:12",
                      quote: "Aí eu pensei: por que eles querem isso agora? Travei e fechei o app.",
                    },
                    {
                      name: "Rafael, 28 · BH",
                      time: "00:02:48",
                      quote: "Não tinha nem aberto a conta direito e já queriam meu banco.",
                    },
                    {
                      name: "Júlia, 41 · POA",
                      time: "00:06:31",
                      quote: "Se tivesse uma frase explicando, eu teria continuado.",
                    },
                  ].map((c) => (
                    <div
                      key={c.name}
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
            </div>

            {/* Coluna lateral — recomendação + métricas */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-md border border-border bg-background p-6">
                <p className="jps-eyebrow text-primary">Recomendação</p>
                <p className="mt-3 text-lg leading-snug">
                  Mover a verificação bancária para depois do primeiro uso, ou adicionar contexto inline antes do
                  pedido.
                </p>
                <div className="mt-5 pt-5 border-t border-border flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-sm bg-primary/10 text-primary font-mono">
                    alta confiança
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">9 / 12 evidências</span>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-6">
                <p className="jps-eyebrow">Cobertura do estudo</p>
                <div className="mt-4 space-y-3">
                  {[
                    { label: "Entrevistas concluídas", val: "12 / 12" },
                    { label: "Duração média", val: "18 min" },
                    { label: "Follow-ups gerados", val: "47" },
                    { label: "Temas identificados", val: "7" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className="flex items-baseline justify-between border-b border-border/60 pb-2 last:border-0"
                    >
                      <span className="text-sm text-muted-foreground">{m.label}</span>
                      <span className="font-display text-lg">{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANTES / DEPOIS */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="jps-eyebrow">Antes / depois</p>
          <h2 className="mt-4 text-4xl md:text-5xl leading-[1.05] max-w-3xl">
            Da entrevista bruta ao insight <em className="lede-em">com fonte clicável</em>.
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {/* Antes */}
            <div className="rounded-md border border-border bg-muted/30 p-6">
              <p className="jps-eyebrow text-muted-foreground">Antes — transcrição crua</p>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground font-mono leading-relaxed">
                <p>[00:03:12] entrevistador: e como foi sua experiência abrindo a conta?</p>
                <p>
                  [00:03:18] entrevistado: ah, foi… começou bem, sabe, gostei do design, mas aí num certo ponto pediram
                  meu banco e eu não entendi…
                </p>
                <p>[00:03:34] entrevistador: pode falar mais sobre esse momento?</p>
                <p>[00:03:38] entrevistado: então, eu acho que… não sei, travei. fechei o app.</p>
                <p className="text-muted-foreground/60">… +14 minutos de transcrição</p>
              </div>
            </div>

            {/* Depois */}
            <div className="rounded-md border border-primary/30 bg-background p-6">
              <p className="jps-eyebrow text-primary">Depois — insight estruturado</p>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">PADRÃO</p>
                  <p className="mt-1 text-base leading-snug">
                    Abandono no passo de verificação bancária por falta de contexto.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">EVIDÊNCIA</p>
                  <p className="mt-1 text-base leading-snug italic">
                    "travei. fechei o app."— Marina, 00:03:38 <span className="text-primary">▶</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono text-muted-foreground">AÇÃO SUGERIDA</p>
                  <p className="mt-1 text-base leading-snug">
                    Adicionar contexto inline antes do pedido de dados bancários.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MÉTODO — 3 passos */}
      <section id="metodo" className="border-t border-border bg-card scroll-mt-[var(--header-height)]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="jps-eyebrow">Método</p>
          <div className="mt-10 grid gap-12 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Defina o estudo",
                d: "Briefing de negócio, contexto e roteiro inicial. A IA usa isso para guiar cada conversa.",
              },
              {
                n: "02",
                t: "Capture em vídeo",
                d: "Link único para cada entrevistado. Pergunta a pergunta, com follow-ups quando a resposta merece.",
              },
              {
                n: "03",
                t: "Síntese com evidências",
                d: "Temas recorrentes, clipes citáveis e recomendações de negócio ancoradas nos vídeos.",
              },
            ].map((s) => (
              <div key={s.n} className="border-t border-border pt-5">
                <div className="font-display text-4xl text-primary">{s.n}</div>
                <h3 className="mt-4 text-2xl">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 flex gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 h-10 px-8 text-xs font-semibold uppercase tracking-[0.18em] bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Começar um estudo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
