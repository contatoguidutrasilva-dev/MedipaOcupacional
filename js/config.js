// Configuração da loja. Quando o backend estiver pronto: MOCK = false e ajustar API_BASE.
window.MEDIPA_CONFIG = {
  MOCK: true,                 // true = pagamentos simulados no navegador (nenhuma cobrança real)
  API_BASE: '/api',           // base do backend (ver BACKEND.md)
  WHATSAPP: '553136173970',
  QUOTE_ONLY_ABOVE: 10000,    // itens a partir desse valor (ou sem preço) são só por orçamento
  MAX_INSTALLMENTS: 3,        // parcelas no cartão (sem juros, definir regra real com o cliente)
  BOLETO_DAYS: 3,             // vencimento do boleto, em dias
  PIX_MINUTES: 30,            // validade do QR Code Pix
  // Horário de atendimento. O site antigo não informa: preencher com o cliente. Ex.: [['Segunda a sexta', '07h às 17h']]
  HOURS: [],
  ADDRESS: 'Rua Montes Claros, 81, Centro, Ipatinga – MG',
  // Local usado no mapa, no Street View da entrada e no "Como chegar".
  // ATENÇÃO: coordenadas do Ed. Paradela Center (R. Itajubá, 120), prédio da foto de referência.
  // Confirmar com o cliente se é este o endereço correto (o site antigo diz Rua Montes Claros, 81,
  // que fica ~170 m ao norte: -19.4789967, -42.5232914).
  LOCATION: { lat: -19.4804869, lng: -42.5232289, yaw: 118, pitch: 8, zoom: 0 },
  // Rastreio: deixe vazio para não carregar nada. Formatos: 'G-XXXXXXXXXX' e '1234567890123456'
  GA_ID: '',
  META_PIXEL_ID: '',
  TERMS_URL: 'legal.html#termos',
  PRIVACY_URL: 'legal.html#privacidade'
};
