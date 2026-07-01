import { createFileRoute } from "@tanstack/react-router";
import { BrandFooter } from "@/components/brand/BrandFooter";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Lente" },
      {
        name: "description",
        content:
          "Como a Lente coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Lente" },
      { property: "og:image", content: "/og-social.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://lente.pereirasaraiva.com/privacidade" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20">
      <p className="jps-eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: maio de 2026</p>

      <div className="mt-12 space-y-10 text-sm leading-relaxed text-foreground/80">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">1. Quem somos</h2>
          <p>
            A Lente é um produto de J P Saraiva Consultoria Ltda. ("nós"), com sede no Brasil. Somos
            o controlador dos dados pessoais coletados nesta plataforma.
          </p>
          <p className="mt-2">
            Contato:{" "}
            <a
              href="mailto:privacidade@pereirasaraiva.com"
              className="text-primary underline underline-offset-2"
            >
              privacidade@pereirasaraiva.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">2. Dados coletados</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Conta:</strong> nome completo e endereço de e-mail (no cadastro).
            </li>
            <li>
              <strong>Entrevistas:</strong> gravações de vídeo e transcrições geradas pelos
              respondentes durante estudos.
            </li>
            <li>
              <strong>Uso:</strong> logs de acesso, tipo de dispositivo e eventos de interação com a
              plataforma.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">
            3. Finalidade e base legal
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Prestação do serviço contratado (execução de contrato — art. 7º, V, LGPD).</li>
            <li>
              Comunicações transacionais, como confirmação de conta e notificações de estudo
              (legítimo interesse — art. 7º, IX, LGPD).
            </li>
            <li>
              Melhoria da plataforma com base em dados agregados e anonimizados (legítimo
              interesse).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">4. Compartilhamento</h2>
          <p>
            Não vendemos dados pessoais. Compartilhamos apenas com subprocessadores necessários à
            operação (ex.: infraestrutura de nuvem, transcrição de vídeo), sempre sob contrato com
            cláusulas de proteção de dados adequadas.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">5. Retenção</h2>
          <p>
            Mantemos os dados pelo prazo necessário à prestação do serviço. Após o encerramento da
            conta, os dados são excluídos em até 90 dias, salvo obrigação legal de retenção.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">6. Seus direitos (LGPD)</h2>
          <p>
            Você pode, a qualquer momento, solicitar: confirmação de existência de tratamento,
            acesso, correção, anonimização, portabilidade, exclusão e revogação do consentimento.
            Envie solicitações para{" "}
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
          <h2 className="mb-3 text-base font-semibold text-foreground">7. Cookies</h2>
          <p>
            Usamos cookies estritamente necessários para autenticação e preferências de sessão. Não
            utilizamos cookies de rastreamento de terceiros para fins publicitários.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">8. Alterações</h2>
          <p>
            Atualizações relevantes serão comunicadas por e-mail ou banner na plataforma com
            antecedência mínima de 15 dias.
          </p>
        </section>
      </div>
      <BrandFooter />
    </div>
  );
}
