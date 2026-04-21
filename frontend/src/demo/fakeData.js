/**
 * Dados 100% ficticios para a pagina /demo.
 * NUNCA bate no backend de producao.
 * Planos e precos baseados na tabela real da Ta Telecom (valores de revenda e sugerido venda).
 */

// Tabela Ta Telecom - precos oficiais
export const DEMO_PLANOS = [
  { nome: 'Movel 1GB',  franquia: '1GB',  custo: 15.05, valor: 21.49 },
  { nome: 'Movel 2GB',  franquia: '2GB',  custo: 18.74, valor: 24.99 },
  { nome: 'Movel 6GB',  franquia: '6GB',  custo: 24.49, valor: 34.99 },
  { nome: 'Movel 10GB', franquia: '10GB', custo: 27.99, valor: 39.99 },
  { nome: 'Movel 15GB', franquia: '15GB', custo: 34.99, valor: 49.99 },
  { nome: 'Movel 20GB', franquia: '20GB', custo: 41.99, valor: 59.99 },
  { nome: 'Movel 30GB', franquia: '30GB', custo: 52.49, valor: 74.99 },
  { nome: 'Movel 40GB', franquia: '40GB', custo: 59.49, valor: 84.99 },
  { nome: 'Movel 50GB', franquia: '50GB', custo: 66.49, valor: 94.99 },
];

const NOMES = [
  'Joao Silva','Maria Santos','Pedro Costa','Ana Oliveira','Carlos Souza','Juliana Lima',
  'Lucas Ferreira','Beatriz Alves','Rafael Pereira','Camila Rodrigues','Fernando Martins',
  'Patricia Ribeiro','Roberto Almeida','Amanda Barbosa','Thiago Carvalho','Fernanda Dias',
  'Marcelo Gomes','Leticia Araujo','Ricardo Cavalcanti','Isabela Monteiro','Bruno Nascimento',
  'Gabriela Moreira','Diego Fernandes','Vanessa Teixeira','Eduardo Rocha','Natalia Campos',
  'Felipe Correia','Mariana Pinto','Rodrigo Vieira','Aline Freitas','Gustavo Mendes',
  'Carolina Azevedo','Leonardo Cardoso','Bianca Silveira','Vinicius Barros','Larissa Moura',
  'Andre Machado','Tatiana Duarte','Henrique Nogueira','Priscila Castro','Matheus Farias',
  'Daniela Neves','Leandro Batista','Carla Reis','Alexandre Borges','Renata Cunha',
  'Jose Ferreira','Marcia Tavares','Paulo Leite','Sandra Magalhaes','Igor Xavier',
  'Raquel Pacheco','Samuel Vargas','Monica Godoi','Fabio Assis','Cristina Paiva',
  'Wellington Brito','Adriana Moraes','Murilo Bastos','Vivian Salles','Sergio Antunes',
  'Elaine Siqueira','Marcos Peixoto','Luciana Bueno','Kleber Marques','Simone Galvao',
  'Otavio Drumond','Rosana Meireles','Caio Figueira','Roseli Cordeiro','Nelson Bezerra',
  'Katia Lopes','Giovanni Zanini','Eliane Camargo','Tulio Matos','Silvia Prado',
  'Wagner Benicio','Gisele Quintana','Adriano Sanches','Tainara Lyra','Romulo Benevides',
];

const CANAIS = ['Fisica','Revendedor A','Revendedor B','Indicacao','Site','Whatsapp'];
const FRANQUIA_MAP = { '1GB':1, '2GB':2, '6GB':6, '10GB':10, '15GB':15, '20GB':20, '30GB':30, '40GB':40, '50GB':50 };

function rand(n) { return Math.floor(Math.random() * n); }
function pick(arr) { return arr[rand(arr.length)]; }
function cpf() { return `${rand(900)+100}.${rand(900)+100}.${rand(900)+100}-${rand(90)+10}`; }
function tel() { return `(${rand(80)+20}) 9${rand(9000)+1000}-${rand(9000)+1000}`; }
function iccid() { return '8955170110' + String(rand(1e11)).padStart(11,'0'); }
function msisdn() { return '55' + (rand(80)+20) + String(rand(900000000)+100000000); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0,10); }
function daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); }

// Gera dados uma unica vez (cacheado na memoria da sessao)
let CACHE = null;

export function getDemoData() {
  if (CACHE) return CACHE;

  const linhas = [];
  const clientes = [];
  const cobrancas = [];

  // Clientes + linhas (alguns clientes tem 2 linhas = combo familiar)
  for (let i = 0; i < 120; i++) {
    const nome = NOMES[i % NOMES.length] + (i >= NOMES.length ? ` ${Math.floor(i/NOMES.length)+1}` : '');
    const clienteId = `demo-cli-${i}`;
    clientes.push({
      id: clienteId, nome, cpf: cpf(), telefone: tel(),
      email: nome.toLowerCase().replace(/\s/g,'.') + '@demo.com',
      canal: pick(CANAIS),
      ativo: Math.random() > 0.05,
    });
  }

  // 150 linhas distribuidas entre 120 clientes
  for (let i = 0; i < 150; i++) {
    const cliente = clientes[i < 120 ? i : rand(120)];
    // Distribuir planos com peso - mais planos medios/grandes (mais rentaveis) pra mostrar operacao saudavel
    const pesoPlanos = [0, 0, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8]; // indices com peso
    const plano = DEMO_PLANOS[pesoPlanos[rand(pesoPlanos.length)]];
    // 76% ativas, 13% bloqueadas/vencidas, 7% pendentes, 4% canceladas
    const r = Math.random();
    let status, statusChip;
    if (r < 0.76) { status = 'ativo'; statusChip = 'Ativo'; }
    else if (r < 0.89) { status = 'bloqueado'; statusChip = 'Bloqueado - vencimento'; }
    else if (r < 0.96) { status = 'pendente'; statusChip = 'Pendente'; }
    else { status = 'cancelado'; statusChip = 'Cancelado'; }

    const ativadoHaDias = rand(180) + 5;
    const proxRecarga = status === 'ativo' ? daysAhead(rand(30)) : daysAgo(rand(15));
    const descontoCombo = Math.random() < 0.12 ? (Math.random() < 0.5 ? 5 : 10) : 0;

    linhas.push({
      linha_id: `demo-lin-${i}`,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      cliente_cpf: cliente.cpf,
      canal: cliente.canal,
      iccid: iccid(),
      numero: msisdn(),
      status_linha: status,
      status_chip: statusChip,
      expirar_dados: proxRecarga,
      oferta_nome: plano.nome,
      plano_nome: plano.nome,
      franquia: plano.franquia,
      valor: plano.valor,
      desconto: descontoCombo,
      valor_liquido: +(plano.valor - descontoCombo).toFixed(2),
      custo: plano.custo,
      lucro: +(plano.valor - descontoCombo - plano.custo).toFixed(2),
      margem_pct: +(((plano.valor - descontoCombo - plano.custo) / (plano.valor - descontoCombo)) * 100).toFixed(2),
      incluir_custo: status !== 'cancelado',
      incluir_lucro: status === 'ativo',
      complemento: Math.random() < 0.3 ? pick(['Filho','Esposa','Mae','Pai','Filha','Trabalho']) : '',
    });

    // Cobrancas dos ultimos 3 meses
    for (let m = 0; m < 3; m++) {
      const vencimento = daysAhead(-m * 30 + 10);
      const vencido = new Date(vencimento) < new Date();
      const isPaid = !vencido ? Math.random() > 0.3 : Math.random() > 0.25;
      let cobStatus;
      if (isPaid) cobStatus = 'RECEIVED';
      else if (vencido) cobStatus = 'OVERDUE';
      else cobStatus = 'PENDING';
      cobrancas.push({
        id: `demo-cob-${i}-${m}`,
        cliente_id: cliente.id,
        cliente_nome: cliente.nome,
        linha_numero: (linhas[linhas.length-1] || {}).numero || '',
        oferta_nome: plano.nome,
        billing_type: pick(['PIX','BOLETO','PIX','PIX']),
        valor: +(plano.valor - descontoCombo).toFixed(2),
        vencimento,
        status: cobStatus,
        asaas_payment_id: `pay_demo_${i}_${m}`,
        pago_em: isPaid ? daysAgo(rand(5)) : null,
      });
    }
  }

  // Resumo Planilha
  const resumo = {
    total_linhas: linhas.length,
    ativas: linhas.filter(l => l.status_linha === 'ativo').length,
    suspensas: linhas.filter(l => l.status_linha === 'bloqueado').length,
    canceladas: linhas.filter(l => l.status_linha === 'cancelado').length,
    receita: +linhas.filter(l => l.incluir_lucro).reduce((s,l) => s + l.valor_liquido, 0).toFixed(2),
    custo: +linhas.filter(l => l.incluir_custo).reduce((s,l) => s + l.custo, 0).toFixed(2),
    custo_fixo: 350.0, // VPS + dominio + Asaas + email
  };
  resumo.custo_total = +(resumo.custo + resumo.custo_fixo).toFixed(2);
  resumo.lucro = +(resumo.receita - resumo.custo).toFixed(2);
  resumo.lucro_liquido = +(resumo.receita - resumo.custo_total).toFixed(2);
  resumo.margem_pct = resumo.receita > 0 ? +((resumo.lucro / resumo.receita) * 100).toFixed(2) : 0;

  // Resumo Cobrancas
  const receita_total = cobrancas.filter(c => c.status === 'RECEIVED').reduce((s,c) => s + c.valor, 0);
  const pendente_total = cobrancas.filter(c => c.status === 'PENDING').reduce((s,c) => s + c.valor, 0);
  const vencido_total = cobrancas.filter(c => c.status === 'OVERDUE').reduce((s,c) => s + c.valor, 0);
  const pagas = cobrancas.filter(c => c.status === 'RECEIVED').length;
  const pendentes = cobrancas.filter(c => c.status !== 'RECEIVED').length;

  const resumoCobrancas = {
    financeiro: {
      receita_total: +receita_total.toFixed(2),
      pendente_total: +pendente_total.toFixed(2),
      vencido_total: +vencido_total.toFixed(2),
    },
    cobrancas: { total: cobrancas.length, pagas, pendentes, vencidas: cobrancas.filter(c=>c.status==='OVERDUE').length },
    assinaturas: { ativas: 3, total: 5 },
  };

  // Custos por plano (para tela Custos)
  const custosPorPlano = DEMO_PLANOS.map(p => {
    const linhasDoPlano = linhas.filter(l => l.plano_nome === p.nome && l.incluir_custo);
    const receita = linhasDoPlano.reduce((s,l) => s + l.valor_liquido, 0);
    const custoTotal = linhasDoPlano.reduce((s,l) => s + l.custo, 0);
    return {
      plano: p.nome, franquia: p.franquia, custo_unit: p.custo, valor_unit: p.valor,
      qtd_linhas: linhasDoPlano.length,
      receita: +receita.toFixed(2), custo_total: +custoTotal.toFixed(2),
      lucro: +(receita - custoTotal).toFixed(2),
    };
  });

  // Custos fixos
  const custosFixos = [
    { id: 'cf1', nome: 'VPS (Linode 8GB)', valor: 180.00, ativo: true },
    { id: 'cf2', nome: 'Dominio .com.br', valor: 40.00, ativo: true },
    { id: 'cf3', nome: 'Taxa Asaas mensal', valor: 49.90, ativo: true },
    { id: 'cf4', nome: 'Email Marketing', valor: 80.00, ativo: true },
  ];

  CACHE = {
    clientes, linhas, cobrancas, resumo, resumoCobrancas,
    custosPorPlano, custosFixos, planos: DEMO_PLANOS,
  };
  return CACHE;
}

export function brl(n) { return `R$ ${Number(n || 0).toFixed(2).replace('.',',')}`; }
