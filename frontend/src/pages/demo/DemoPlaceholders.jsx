import DemoComingSoon from './DemoComingSoon';

// Ativações - DIFERENCIAL!
export const DemoAtivacoes = () => (
  <DemoComingSoon
    title="Ativações"
    description="Histórico e gerenciamento de ativações de linhas"
    highlight={{
      title: 'Ativação 100% automática via API Tá Telecom',
      description: 'Ao cadastrar uma nova linha, o sistema chama a API da Tá Telecom, ativa o chip instantaneamente, cria o cliente no Asaas e emite a primeira cobrança — tudo em menos de 10 segundos, sem intervenção humana.',
    }}
    features={[
      { title: 'Ativação instantânea', desc: 'Novo chip ativo em segundos após a confirmação do pagamento' },
      { title: 'Retry automático', desc: 'Se a API da Tá falhar, o sistema tenta novamente até 5 vezes com backoff progressivo' },
      { title: 'Troca de oferta automatizada', desc: 'Cliente muda de plano pelo portal e o sistema ajusta na Tá Telecom e no Asaas' },
      { title: 'Portabilidade integrada', desc: 'Inicia o processo de portabilidade direto do sistema com a Tá Telecom' },
    ]}
  />
);

// Linhas - DIFERENCIAL!
export const DemoLinhas = () => (
  <DemoComingSoon
    title="Linhas"
    description="Gerenciamento completo das linhas ativas"
    highlight={{
      title: 'Bloqueio e desbloqueio automático por inadimplência',
      description: 'Cliente não pagou o boleto? O sistema bloqueia a linha automaticamente via API da Tá Telecom na data de vencimento. Pagou o atrasado? Desbloqueia na hora. Zero gestão manual.',
    }}
    features={[
      { title: 'Bloqueio automático', desc: 'Linha bloqueada na Tá Telecom assim que o Asaas confirma o vencimento' },
      { title: 'Desbloqueio instantâneo', desc: 'Pagamento confirmado = linha liberada automaticamente' },
      { title: 'Sincronização em lote', desc: 'Sincroniza o status de todas as linhas com a Tá em 1 clique' },
      { title: 'Histórico completo', desc: 'Log de cada bloqueio/desbloqueio, recarga e mudança de status' },
      { title: 'Transferência entre clientes', desc: 'Muda a linha de um cliente para outro sem trocar o chip' },
      { title: 'Alertas automáticos', desc: 'WhatsApp e e-mail para o cliente antes do bloqueio' },
    ]}
  />
);

// Clientes
export const DemoClientes = () => (
  <DemoComingSoon
    title="Clientes"
    description="Cadastro e gestão de clientes"
    features={[
      { title: 'Preenchimento automático por CPF', desc: 'Integração com CPFHub puxa nome, endereço e dados do cliente na hora' },
      { title: 'Sincronização com Asaas', desc: 'Cliente criado no sistema já vai para o Asaas automaticamente' },
      { title: 'Histórico completo', desc: 'Linhas, cobranças, assinaturas e observações em um só lugar' },
      { title: 'Importação em lote', desc: 'Envie uma planilha Excel e importe 500 clientes em segundos' },
    ]}
  />
);

// Chips
export const DemoChips = () => (
  <DemoComingSoon
    title="Chips em Estoque"
    description="Controle de estoque de chips"
    features={[
      { title: 'Cadastro por código de barras', desc: 'Leia o ICCID direto da caixa do chip com a câmera do celular' },
      { title: 'QR Code embutido', desc: 'Cada chip possui QR Code próprio para ativação self-service pelo cliente' },
      { title: 'Status em tempo real', desc: 'Disponível, Reservado, Ativado ou Bloqueado — sempre sincronizado' },
      { title: 'Alertas de estoque baixo', desc: 'Notificação quando restam menos chips disponíveis' },
    ]}
  />
);

// Carteira
export const DemoCarteira = () => (
  <DemoComingSoon
    title="Carteira Móvel"
    description="Gestão financeira exclusiva para planos móveis"
    features={[
      { title: 'Cobranças recorrentes Asaas', desc: 'Boleto, PIX e cartão de crédito automático' },
      { title: 'Cartão recorrente', desc: 'Cliente cadastra o cartão uma vez no Asaas e a cobrança é automática todo mês' },
      { title: 'Notificações por e-mail', desc: 'Cliente recebe lembrete antes do vencimento' },
      { title: 'Relatórios exportáveis', desc: 'Excel e CSV com filtros customizados' },
    ]}
  />
);

// Assinaturas
export const DemoAssinaturas = () => (
  <DemoComingSoon
    title="Assinaturas"
    description="Assinaturas recorrentes no Asaas"
    features={[
      { title: 'Mensal, trimestral ou anual', desc: 'Qualquer ciclo de cobrança disponível' },
      { title: 'Boleto, PIX e cartão', desc: 'Cliente escolhe a forma de pagamento' },
      { title: 'Upgrade e downgrade de plano', desc: 'Muda a oferta sem cancelar a assinatura' },
      { title: 'Pausar e retomar', desc: 'Cliente em viagem? Pausa a assinatura sem cancelar' },
    ]}
  />
);

// Planos
export const DemoPlanos = () => (
  <DemoComingSoon
    title="Planos"
    description="Catálogo de planos disponíveis"
    features={[
      { title: 'Integração com Tá Telecom', desc: 'Planos importados automaticamente da API com código, nome e franquia' },
      { title: 'Custo configurável', desc: 'Você define o custo do plano e o sistema calcula a margem em tempo real' },
      { title: 'Múltiplas ofertas por plano', desc: 'Um plano pode ter várias ofertas (diferentes preços ou combos)' },
    ]}
  />
);

// Ofertas
export const DemoOfertas = () => (
  <DemoComingSoon
    title="Ofertas"
    description="Ofertas comerciais (combinações de plano e preço)"
    features={[
      { title: 'Ofertas ilimitadas por plano', desc: 'Promoções, descontos, combos — tudo configurável' },
      { title: 'Margem em tempo real', desc: 'O sistema mostra o lucro e a margem de cada oferta automaticamente' },
      { title: 'Ativar e desativar sem apagar', desc: 'Mantém o histórico de ofertas antigas para relatórios' },
    ]}
  />
);

// Revendedores
export const DemoRevendedores = () => (
  <DemoComingSoon
    title="Rede de Revendedores"
    description="Gerenciamento de revendedores parceiros"
    features={[
      { title: 'Portal exclusivo por revendedor', desc: 'Cada revendedor tem seu login e visualiza apenas seus clientes' },
      { title: 'Comissões automáticas', desc: 'O sistema calcula a comissão por ativação ou mensalidade' },
      { title: 'Ranking de performance', desc: 'Melhores revendedores, metas e premiações' },
      { title: 'Link de divulgação personalizado', desc: 'Cada revendedor tem um link próprio para compartilhar' },
    ]}
  />
);

// Self-Service - DIFERENCIAL!
export const DemoSelfService = () => (
  <DemoComingSoon
    title="Ativação Self-Service"
    description="Cliente ativa o chip sozinho em minutos"
    highlight={{
      title: 'Ativação por QR Code — sem envolvimento manual',
      description: 'O cliente lê o QR Code do chip, preenche o CPF (o sistema puxa os dados automaticamente via CPFHub), escolhe o plano, paga via PIX ou cartão e o chip é ativado instantaneamente na Tá Telecom. Você acompanha tudo em tempo real, sem precisar intervir.',
    }}
    features={[
      { title: 'QR Code em cada chip', desc: 'Gerado automaticamente ao cadastrar o chip no sistema' },
      { title: 'Preenchimento de CPF automático', desc: 'Cliente digita apenas o CPF e o sistema busca nome e endereço' },
      { title: 'Pagamento via PIX', desc: 'Aprovação instantânea — o chip ativa na hora' },
      { title: 'Retry inteligente', desc: 'Se a Tá falhar, o sistema reprocessa até 5 vezes sem intervenção' },
      { title: 'Acompanhamento em tempo real', desc: 'Você vê cada ativação acontecendo no painel administrativo' },
      { title: 'Mensagens personalizadas', desc: 'E-mail e WhatsApp com instruções após a ativação' },
    ]}
  />
);

// Divulgacao
export const DemoDivulgacao = () => (
  <DemoComingSoon
    title="Divulgação"
    description="Landing page pública para captar novos clientes"
    features={[
      { title: 'Landing personalizável', desc: 'Mostra seus planos e valores com a sua marca' },
      { title: 'Link curto para divulgar', desc: 'Compartilhe no Instagram, WhatsApp ou Google Ads' },
      { title: 'Métricas de visita', desc: 'Veja quantas pessoas acessaram e quantas converteram' },
      { title: 'Formulário de interesse', desc: 'Cliente deixa o contato e você recebe no WhatsApp' },
    ]}
  />
);

// Usuarios
export const DemoUsuarios = () => (
  <DemoComingSoon
    title="Usuários do Sistema"
    description="Controle de acesso por perfis"
    features={[
      { title: 'Multi-usuário', desc: 'Admin, Atendente, Financeiro — cada um com permissões específicas' },
      { title: 'Controle granular', desc: 'Limita o que cada atendente pode ver e fazer' },
      { title: 'Confirmação por senha', desc: 'Ações críticas exigem confirmação do administrador' },
      { title: 'Log de auditoria', desc: 'Cada ação fica registrada com usuário, IP e horário' },
    ]}
  />
);

// Logs
export const DemoLogs = () => (
  <DemoComingSoon
    title="Logs e Auditoria"
    description="Rastreabilidade completa de todas as ações"
    features={[
      { title: 'Log de cada chamada à API', desc: 'Requisição e resposta da Tá Telecom e do Asaas ficam registradas' },
      { title: 'Histórico de ativações', desc: 'Quem ativou, quando e com quais dados' },
      { title: 'Detecção de erros', desc: 'Alertas em tempo real para falhas de integração' },
      { title: 'Exportação para LGPD', desc: 'Relatórios de acesso a dados pessoais exportáveis' },
    ]}
  />
);
