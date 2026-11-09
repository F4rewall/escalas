export const SECTORS = {
  coroinhas: {
    id: 'coroinhas',
    name: 'Coroinhas',
    fullName: 'Coroinhas e Cerimoniários',
    scheduleTitle: 'Escalas de Altar',
    scheduleSubtitle: 'Acompanhe ou organize a distribuição dos servidores nas missas.',
    profilesTitle: 'Perfis dos Altaristas',
    profilesSubtitle: 'Lista completa de Coroinhas e Cerimoniários da paróquia. Clique em um perfil para ver estatísticas de frequência.',
    memberSingular: 'Servidor',
    memberPlural: 'Servidores',
    adminBadge: 'Admin • Coroinhas',
    accentColor: '#d97706',
    secondaryColor: '#8b5cf6',
    pdfHeaderSubtitle: 'ESCALA GERAL DE CELEBRAÇÕES • ALTAR',
    pdfFooter: 'Paróquia Santo Antônio de Lisboa • Arquidiocese de Palmas • Escala de Servidores do Altar',
    mainRoleLabel: 'Cerimoniário Principal (Coordenador do Altar)',
    mainRoleSelectPlaceholder: 'Selecione o Cerimoniário Principal...',
    mainRoleShortLabel: 'Cerimoniários',
    mainRoleBadge: 'CP',
    mainRoleTitle: 'Cerimoniário Principal',
    auxRoleSectionTitle: 'Selecionar Outros Cerimoniários (Auxiliares)',
    auxRoleLabel: 'Cerimoniários',
    auxRoleBadge: 'C',
    memberRoleSectionTitle: 'Selecionar Coroinhas',
    memberRoleLabel: 'Coroinhas',
    memberRoleBadge: 'Co',
    categories: [
      { id: 'coroinha', label: 'Coroinha', plural: 'Coroinhas', badgeClass: 'badge-coroinha', shortBadge: 'Co', color: '#8b5cf6' },
      { id: 'cerimoniario', label: 'Cerimoniário', plural: 'Cerimoniários', badgeClass: 'badge-cerimoniario', shortBadge: 'C', color: '#eab308' }
    ],
    mainEligibleCategories: ['cerimoniario'],
    auxEligibleCategories: ['cerimoniario'],
    memberEligibleCategories: ['coroinha'],
    emptySelectionAlert: 'Selecione pelo menos um coroinha ou um cerimoniário.'
  },
  musica: {
    id: 'musica',
    name: 'Música',
    fullName: 'Ministério de Música',
    scheduleTitle: 'Escalas da Música',
    scheduleSubtitle: 'Acompanhe ou organize os ministérios, cantores e instrumentistas nas celebrações.',
    profilesTitle: 'Perfis do Ministério de Música',
    profilesSubtitle: 'Lista completa de Cantores, Instrumentistas e Responsáveis da Música. Clique em um perfil para ver a frequência.',
    memberSingular: 'Músico',
    memberPlural: 'Músicos',
    adminBadge: 'Admin • Música',
    accentColor: '#0ea5e9',
    secondaryColor: '#ec4899',
    pdfHeaderSubtitle: 'ESCALA DO MINISTÉRIO DE MÚSICA LITÚRGICA',
    pdfFooter: 'Paróquia Santo Antônio de Lisboa • Arquidiocese de Palmas • Pastoral da Música',
    mainRoleLabel: 'Responsável / Diretor Musical da Missa',
    mainRoleSelectPlaceholder: 'Selecione o Responsável pela Música...',
    mainRoleShortLabel: 'Responsável / Cantores',
    mainRoleBadge: 'RM',
    mainRoleTitle: 'Responsável Musical',
    auxRoleSectionTitle: 'Selecionar Cantores / Salmistas (Vocais)',
    auxRoleLabel: 'Cantores / Vocais',
    auxRoleBadge: 'Ca',
    memberRoleSectionTitle: 'Selecionar Instrumentistas',
    memberRoleLabel: 'Instrumentistas',
    memberRoleBadge: 'In',
    categories: [
      { id: 'cantor', label: 'Cantor(a)', plural: 'Cantores', badgeClass: 'badge-musica-cantor', shortBadge: 'Ca', color: '#0ea5e9' },
      { id: 'instrumentista', label: 'Instrumentista', plural: 'Instrumentistas', badgeClass: 'badge-musica-inst', shortBadge: 'In', color: '#ec4899' },
      { id: 'responsavel', label: 'Responsável', plural: 'Responsáveis', badgeClass: 'badge-cerimoniario', shortBadge: 'RM', color: '#eab308' }
    ],
    mainEligibleCategories: ['responsavel', 'cantor', 'instrumentista'],
    auxEligibleCategories: ['cantor', 'responsavel'],
    memberEligibleCategories: ['instrumentista'],
    emptySelectionAlert: 'Selecione pelo menos um responsável, cantor ou instrumentista para a escala de música.'
  },
  liturgia: {
    id: 'liturgia',
    name: 'Liturgia',
    fullName: 'Pastoral da Liturgia',
    scheduleTitle: 'Escalas da Liturgia',
    scheduleSubtitle: 'Acompanhe ou organize os leitores, salmistas, comentaristas e coordenadores das celebrações.',
    profilesTitle: 'Perfis da Pastoral da Liturgia',
    profilesSubtitle: 'Lista completa de Leitores, Salmistas, Comentaristas e Coordenadores. Clique em um perfil para ver a frequência.',
    memberSingular: 'Membro da Liturgia',
    memberPlural: 'Membros da Liturgia',
    adminBadge: 'Admin • Liturgia',
    accentColor: '#10b981',
    secondaryColor: '#f59e0b',
    pdfHeaderSubtitle: 'ESCALA DA PASTORAL DA LITURGIA',
    pdfFooter: 'Paróquia Santo Antônio de Lisboa • Arquidiocese de Palmas • Pastoral da Liturgia',
    mainRoleLabel: 'Coordenador(a) / Comentarista da Celebração',
    mainRoleSelectPlaceholder: 'Selecione o Coordenador / Comentarista...',
    mainRoleShortLabel: 'Comentarista / Salmista',
    mainRoleBadge: 'CL',
    mainRoleTitle: 'Coordenador / Comentarista',
    auxRoleSectionTitle: 'Selecionar Salmista / Comentaristas',
    auxRoleLabel: 'Salmista / Comentaristas',
    auxRoleBadge: 'Sa',
    memberRoleSectionTitle: 'Selecionar Leitores (1ª, 2ª Leitura e Preces)',
    memberRoleLabel: 'Leitores',
    memberRoleBadge: 'Le',
    categories: [
      { id: 'leitor', label: 'Leitor(a)', plural: 'Leitores', badgeClass: 'badge-liturgia-leitor', shortBadge: 'Le', color: '#10b981' },
      { id: 'salmista', label: 'Salmista', plural: 'Salmistas', badgeClass: 'badge-liturgia-salmista', shortBadge: 'Sa', color: '#3b82f6' },
      { id: 'comentarista', label: 'Comentarista', plural: 'Comentaristas', badgeClass: 'badge-liturgia-comentarista', shortBadge: 'Cm', color: '#f59e0b' },
      { id: 'coordenador', label: 'Coordenador(a)', plural: 'Coordenadores', badgeClass: 'badge-cerimoniario', shortBadge: 'CL', color: '#eab308' }
    ],
    mainEligibleCategories: ['coordenador', 'comentarista', 'leitor', 'salmista'],
    auxEligibleCategories: ['salmista', 'comentarista', 'coordenador'],
    memberEligibleCategories: ['leitor'],
    emptySelectionAlert: 'Selecione pelo menos um membro da liturgia (coordenador, comentarista, salmista ou leitor).'
  },
  mece: {
    id: 'mece',
    name: 'MECE',
    fullName: 'Ministros Extraordinários da Sagrada Comunhão',
    scheduleTitle: 'Escalas dos MECE',
    scheduleSubtitle: 'Acompanhe ou organize os Ministros Extraordinários da Sagrada Comunhão nas celebrações.',
    profilesTitle: 'Perfis dos Ministros (MECE)',
    profilesSubtitle: 'Lista completa de Ministros Extraordinários da Sagrada Comunhão e Coordenadores. Clique em um perfil para ver a frequência.',
    memberSingular: 'Ministro',
    memberPlural: 'Ministros',
    adminBadge: 'Admin • MECE',
    accentColor: '#f43f5e',
    secondaryColor: '#eab308',
    pdfHeaderSubtitle: 'ESCALA DOS MINISTROS EXTRAORDINÁRIOS DA SAGRADA COMUNHÃO • MECE',
    pdfFooter: 'Paróquia Santo Antônio de Lisboa • Arquidiocese de Palmas • Pastoral dos MECE',
    mainRoleLabel: 'Ministro Coordenador da Celebração',
    mainRoleSelectPlaceholder: 'Selecione o Ministro Coordenador...',
    mainRoleShortLabel: 'Coordenador / Auxiliares',
    mainRoleBadge: 'MC',
    mainRoleTitle: 'Ministro Coordenador',
    auxRoleSectionTitle: 'Selecionar Ministros Auxiliares (Purificação / Âmbula)',
    auxRoleLabel: 'Ministros Auxiliares',
    auxRoleBadge: 'MA',
    memberRoleSectionTitle: 'Selecionar Ministros da Eucaristia (MECE)',
    memberRoleLabel: 'Ministros (MECE)',
    memberRoleBadge: 'ME',
    categories: [
      { id: 'ministro', label: 'Ministro(a) (MECE)', plural: 'Ministros (MECE)', badgeClass: 'badge-mece-ministro', shortBadge: 'ME', color: '#f43f5e' },
      { id: 'ministro_auxiliar', label: 'Ministro Auxiliar', plural: 'Ministros Auxiliares', badgeClass: 'badge-mece-aux', shortBadge: 'MA', color: '#a855f7' },
      { id: 'coordenador_mece', label: 'Coordenador(a) MECE', plural: 'Coordenadores MECE', badgeClass: 'badge-cerimoniario', shortBadge: 'MC', color: '#eab308' }
    ],
    mainEligibleCategories: ['coordenador_mece', 'ministro_auxiliar', 'ministro'],
    auxEligibleCategories: ['ministro_auxiliar', 'coordenador_mece'],
    memberEligibleCategories: ['ministro'],
    emptySelectionAlert: 'Selecione pelo menos um ministro (coordenador, auxiliar ou MECE).'
  }
};

export const getSectorConfig = (sectorId) => {
  return SECTORS[sectorId] || SECTORS.coroinhas;
};

export const getItemSector = (item) => {
  return item?.sector || 'coroinhas';
};

export const getCategoryInfo = (sectorId, categoryId) => {
  const sector = getSectorConfig(sectorId);
  const found = sector.categories.find(c => c.id === categoryId);
  if (found) return found;
  return sector.categories[0];
};

