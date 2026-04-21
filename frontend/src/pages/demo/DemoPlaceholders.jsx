import DemoComingSoon from './DemoComingSoon';

// Ativacoes - DIFERENCIAL!
export const DemoAtivacoes = () => (
  <DemoComingSoon
    title="Ativacoes"
    description="Historico e gerenciamento de ativacoes de linhas"
    highlight={{
      title: 'Ativacao 100% automatica via API Ta Telecom',
      description: 'Ao cadastrar uma nova linha, o sistema chama a API da Ta Telecom, ativa o chip instantaneamente, cria o cliente no Asaas e emite a primeira cobranca — tudo em menos de 10 segundos, sem intervencao humana.',
    }}
    features={[
      { title: 'Ativacao instantanea', desc: 'Novo chip ativo em segundos apos a confirmacao do pagamento' },
      { title: 'Retry automatico', desc: 'Se a API da Ta falhar, o sistema tenta novamente ate 5 vezes com backoff progressivo' },
      { title: 'Troca de oferta automatizada', desc: 'Cliente muda de plano pelo portal e o sistema ajusta na Ta Telecom e no Asaas' },
      { title: 'Portabilidade integrada', desc: 'Inicia processo de portabilidade direto do sistema com a Ta Telecom' },
    ]}
  />
);

// Linhas - DIFERENCIAL!
export const DemoLinhas = () => (
  <DemoComingSoon
    title="Linhas"
    description="Gerenciamento completo das linhas ativas"
    highlight={{
      title: 'Bloqueio e desbloqueio automatico por inadimplencia',
      description: 'Cliente nao pagou o boleto? O sistema bloqueia a linha automaticamente via API da Ta Telecom na data de vencimento. Pagou o atrasado? Desbloqueia na hora. Zero gestao manual.',
    }}
    features={[
      { title: 'Bloqueio automatico', desc: 'Linha bloqueada na Ta Telecom assim que o Asaas confirma vencimento' },
      { title: 'Desbloqueio instantaneo', desc: 'Pagamento confirmado = linha liberada automaticamente' },
      { title: 'Sincronizacao em lote', desc: 'Sincroniza status de todas linhas com a Ta em 1 clique' },
      { title: 'Historico completo', desc: 'Log de cada bloqueio/desbloqueio, recarga e mudanca de status' },
      { title: 'Transferencia entre clientes', desc: 'Muda a linha de um cliente para outro sem trocar o chip' },
      { title: 'Alertas automaticos', desc: 'WhatsApp/Email para cliente antes do bloqueio' },
    ]}
  />
);

// Clientes
export const DemoClientes = () => (
  <DemoComingSoon
    title="Clientes"
    description="Cadastro e gestao de clientes"
    features={[
      { title: 'Preenchimento automatico por CPF', desc: 'Integracao CPFHub puxa nome, endereco e dados do cliente na hora' },
      { title: 'Sincronizacao Asaas', desc: 'Cliente criado no sistema ja vai pro Asaas automaticamente' },
      { title: 'Historico completo', desc: 'Linhas, cobrancas, assinaturas e observacoes em um so lugar' },
      { title: 'Importacao em lote', desc: 'Suba uma planilha Excel e importe 500 clientes em segundos' },
    ]}
  />
);

// Chips
export const DemoChips = () => (
  <DemoComingSoon
    title="Chips em Estoque"
    description="Controle de estoque de chips"
    features={[
      { title: 'Cadastro por codigo de barras', desc: 'Leia o ICCID direto da caixa do chip com a camera' },
      { title: 'QR Code embutido', desc: 'Cada chip tem QR Code para ativacao self-service pelo cliente' },
      { title: 'Status em tempo real', desc: 'Disponivel, Reservado, Ativado, Bloqueado — sempre sincronizado' },
      { title: 'Alertas de estoque baixo', desc: 'Notificacao quando restam menos de N chips disponiveis' },
    ]}
  />
);

// Carteira
export const DemoCarteira = () => (
  <DemoComingSoon
    title="Carteira Movel"
    description="Gestao financeira exclusiva para planos moveis"
    features={[
      { title: 'Cobrancas recorrentes Asaas', desc: 'Boleto, PIX e cartao de credito automatico' },
      { title: 'Cartao recorrente', desc: 'Cliente cadastra cartao 1 vez no Asaas, cobra automatico todo mes' },
      { title: 'Notificacoes por email', desc: 'Cliente recebe lembrete antes do vencimento' },
      { title: 'Relatorios exportaveis', desc: 'Excel e CSV com filtros customizados' },
    ]}
  />
);

// Assinaturas
export const DemoAssinaturas = () => (
  <DemoComingSoon
    title="Assinaturas"
    description="Assinaturas recorrentes no Asaas"
    features={[
      { title: 'Mensal, trimestral, anual', desc: 'Qualquer ciclo de cobranca disponivel' },
      { title: 'Mix boleto + PIX + cartao', desc: 'Cliente escolhe a forma de pagamento' },
      { title: 'Upgrade/downgrade de plano', desc: 'Muda oferta sem cancelar a assinatura' },
      { title: 'Pausar/retomar', desc: 'Cliente em viagem? Pausa a assinatura sem cancelar' },
    ]}
  />
);

// Planos
export const DemoPlanos = () => (
  <DemoComingSoon
    title="Planos"
    description="Catalogo de planos disponiveis"
    features={[
      { title: 'Integracao Ta Telecom', desc: 'Planos puxados automaticamente da API com codigo, nome e franquia' },
      { title: 'Custo configuravel', desc: 'Voce define o custo do plano e o sistema calcula margem em tempo real' },
      { title: 'Multiplas ofertas por plano', desc: '1 plano pode ter varias ofertas (diferentes precos ou combos)' },
    ]}
  />
);

// Ofertas
export const DemoOfertas = () => (
  <DemoComingSoon
    title="Ofertas"
    description="Ofertas comerciais (combinacoes de plano + preco)"
    features={[
      { title: 'Ofertas ilimitadas por plano', desc: 'Promocoes, descontos, combos — tudo configuravel' },
      { title: 'Margem em tempo real', desc: 'Sistema mostra lucro e margem de cada oferta automaticamente' },
      { title: 'Ativar/desativar sem deletar', desc: 'Mantem historico de ofertas antigas para relatorios' },
    ]}
  />
);

// Revendedores
export const DemoRevendedores = () => (
  <DemoComingSoon
    title="Rede de Revendedores"
    description="Gerenciamento de revendedores parceiros"
    features={[
      { title: 'Portal exclusivo por revendedor', desc: 'Cada revendedor tem login proprio e ve so seus clientes' },
      { title: 'Comissoes automaticas', desc: 'Sistema calcula comissao por ativacao ou mensalidade' },
      { title: 'Ranking de performance', desc: 'Top revendedores, metas e premiacoes' },
      { title: 'Link de divulgacao personalizado', desc: 'Cada revendedor tem um link proprio para compartilhar' },
    ]}
  />
);

// Self-Service - DIFERENCIAL!
export const DemoSelfService = () => (
  <DemoComingSoon
    title="Ativacao Self-Service"
    description="Cliente ativa o chip sozinho em minutos"
    highlight={{
      title: 'Ativacao por QR Code — sem envolvimento manual',
      description: 'O cliente le o QR Code do chip, preenche CPF (sistema puxa os dados automaticamente via CPFHub), escolhe o plano, paga via PIX/cartao e o chip e ativado instantaneamente na Ta Telecom. Voce acompanha tudo em tempo real, mas nao precisa fazer NADA.',
    }}
    features={[
      { title: 'QR Code em cada chip', desc: 'Gerado automaticamente ao cadastrar o chip no sistema' },
      { title: 'Preenchimento CPF automatico', desc: 'Cliente digita so o CPF, sistema busca nome/endereco' },
      { title: 'Pagamento via PIX', desc: 'Aprovacao instantanea, chip ativa na hora' },
      { title: 'Retry inteligente', desc: 'Se a Ta falhar, o sistema reprocessa ate 5 vezes sem intervencao' },
      { title: 'Acompanhamento em tempo real', desc: 'Voce ve cada ativacao acontecendo no painel admin' },
      { title: 'Mensagens personalizadas', desc: 'Email/WhatsApp com instrucoes apos ativacao' },
    ]}
  />
);

// Divulgacao
export const DemoDivulgacao = () => (
  <DemoComingSoon
    title="Divulgacao"
    description="Landing page publica para captar novos clientes"
    features={[
      { title: 'Landing customizavel', desc: 'Mostra seus planos e valores com sua marca' },
      { title: 'Link curto para divulgar', desc: 'Compartilhe no Instagram, WhatsApp ou Google Ads' },
      { title: 'Metricas de visita', desc: 'Veja quantas pessoas acessaram e quantas converteram' },
      { title: 'Formulario de interesse', desc: 'Cliente deixa contato e voce recebe no WhatsApp' },
    ]}
  />
);

// Usuarios
export const DemoUsuarios = () => (
  <DemoComingSoon
    title="Usuarios do Sistema"
    description="Controle de acesso por perfis"
    features={[
      { title: 'Multi-usuario', desc: 'Admin, Atendente, Financeiro — cada um com permissoes especificas' },
      { title: 'Controle granular', desc: 'Limita o que cada atendente pode ver e fazer' },
      { title: 'Confirmacao por senha', desc: 'Acoes criticas exigem confirmacao do admin' },
      { title: 'Log de auditoria', desc: 'Cada acao fica registrada com usuario, IP e horario' },
    ]}
  />
);

// Logs
export const DemoLogs = () => (
  <DemoComingSoon
    title="Logs & Auditoria"
    description="Rastreabilidade completa de todas as acoes"
    features={[
      { title: 'Log de cada chamada API', desc: 'Requisicao + resposta da Ta Telecom e Asaas registradas' },
      { title: 'Historico de ativacoes', desc: 'Quem ativou, quando e com quais dados' },
      { title: 'Detec de erros', desc: 'Alertas em tempo real para falhas de integracao' },
      { title: 'Exportacao para LGPD', desc: 'Relatorios de acesso a dados pessoais exportaveis' },
    ]}
  />
);
