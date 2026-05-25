import { createFileRoute, Link } from "@tanstack/react-router";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lente — Pesquisa qualitativa em vídeo com IA" },
      { name: "description", content: "Conduza entrevistas em vídeo com follow-ups adaptativos. Transcrição automática, síntese de insights e recomendações baseadas em evidências." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-20">
        <div className="max-w-3xl">
          <p className="jps-eyebrow">Pesquisa qualitativa · IA</p>
          <h1 className="mt-5 text-6xl md:text-7xl leading-[0.95]">
            Entrevistas em vídeo que{" "}
            <em className="font-display italic text-primary">se aprofundam</em> sozinhas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Você define o roteiro e o contexto. A Lente conduz cada entrevista com perguntas de
            follow-up adaptativas, transcreve as respostas e devolve uma síntese com recortes em
            vídeo das citações que sustentam cada insight.
          </p>
          <div className="mt-10 flex gap-3">
            <Link
              to="/signup"
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              Criar conta de pesquisador
            </Link>
            <Link
              to="/login"
              className="rounded-md border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-accent"
            >
              Entrar
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="jps-eyebrow">Método</p>
          <div className="mt-10 grid gap-12 md:grid-cols-3">
            {[
              { n: "01", t: "Defina o estudo", d: "Briefing de negócio, contexto e roteiro inicial. A IA usa isso para guiar cada conversa." },
              { n: "02", t: "Capture em vídeo", d: "Link único para cada entrevistado. Pergunta a pergunta, com follow-ups quando a resposta merece." },
              { n: "03", t: "Síntese com evidências", d: "Temas recorrentes, clipes citáveis e recomendações de negócio ancoradas nos vídeos." },
            ].map((s) => (
              <div key={s.n} className="border-t border-border pt-5">
                <div className="font-display text-4xl text-accent">{s.n}</div>
                <h3 className="mt-4 text-2xl">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      
    </div>
  );
}
