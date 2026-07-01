import { createFileRoute } from "@tanstack/react-router";
import { BrandFooter } from "@/components/brand/BrandFooter";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Lente" },
      { name: "description", content: "Termos e condições de uso da plataforma Lente." },
      { property: "og:title", content: "Termos de Uso — Lente" },
      { property: "og:image", content: "/og-social.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://lente.pereirasaraiva.com/termos" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="jps-eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">Termos de Uso</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: maio de 2026</p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-foreground/80">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">1. Aceitação</h2>
          <p>
            Ao criar uma conta ou usar a Lente, você concorda com estes Termos. Se não concordar,
            não utilize a plataforma.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">2. Descrição do serviço</h2>
          <p>
            A Lente é uma plataforma de pesquisa qualitativa que permite conduzir entrevistas em
            vídeo com follow-ups adaptativos e síntese automática de insights. O acesso é oferecido
            mediante cadastro e pode ser gratuito ou pago conforme o plano contratado.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">3. Uso aceitável</h2>
          <p>Você concorda em não:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Usar a plataforma para coletar dados de menores de 18 anos sem consentimento dos
              responsáveis.
            </li>
            <li>Realizar entrevistas sem informar os respondentes sobre gravação e finalidade.</li>
            <li>Tentar acessar dados de outros usuários ou contornar mecanismos de segurança.</li>
            <li>Revender ou sublicenciar o acesso à plataforma sem autorização.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">4. Propriedade dos dados</h2>
          <p>
            Você retém a propriedade dos dados e gravações que submete à plataforma. Ao usá-la, nos
            concede licença limitada para processar esses dados exclusivamente para a prestação do
            serviço.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            5. Responsabilidade com respondentes
          </h2>
          <p>
            Você é responsável por obter o consentimento informado dos respondentes das suas
            pesquisas, incluindo consentimento para gravação de vídeo e uso dos dados para análise.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">6. Disponibilidade</h2>
          <p>
            Buscamos disponibilidade contínua, mas não garantimos uptime de 100%. Não nos
            responsabilizamos por perdas decorrentes de indisponibilidade não programada.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">7. Encerramento</h2>
          <p>
            Podemos suspender contas que violem estes Termos. Você pode encerrar sua conta a
            qualquer momento enviando solicitação para{" "}
            <a
              href="mailto:privacidade@pereirasaraiva.com"
              className="text-primary underline underline-offset-2"
            >
              privacidade@pereirasaraiva.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">8. Lei aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis brasileiras. Eventuais conflitos serão resolvidos no
            foro da Comarca de São Paulo — SP.
          </p>
        </section>
      </div>
      <BrandFooter />
    </div>
  );
}
