export default async function menurpg(prefix, botName = 'MeuBot', userName = 'Usuario', {
  header = `*RPG MENU*\nHello, #user#!`,
  menuTopBorder = '---',
  bottomBorder = '---',
  menuTitleIcon = '[RPG]',
  menuItemIcon = '-',
  separatorIcon = '*',
  middleBorder = '|',
  profileMenuTitle = 'PROFILE & STATUS',
  economyMenuTitle = 'ECONOMY & FINANCES',
  activitiesMenuTitle = 'DAILY ACTIVITIES',
  adventureMenuTitle = 'ADVENTURE & EXPLORATION',
  combatMenuTitle = 'COMBAT & BATTLES',
  craftingMenuTitle = 'CRAFTING & EQUIPMENT',
  socialMenuTitle = 'SOCIAL & INTERACTIONS',
  familyMenuTitle = 'FAMILY & ADOPTION',
  guildMenuTitle = 'CLAN & COMMUNITY',
  questMenuTitle = 'QUESTS & ACHIEVEMENTS',
  petsMenuTitle = 'PETS & COMPANIONS',
  reputationMenuTitle = 'REPUTATION & FAME',
  investmentMenuTitle = 'INVESTMENTS & STOCKS',
  gamblingMenuTitle = 'CASINO & BETTING',
  evolutionMenuTitle = 'EVOLUTION & PRESTIGE',
  eventsMenuTitle = 'EVENTS',
  premiumMenuTitle = 'PREMIUM SHOP',
  adminMenuTitle = 'ADMIN RPG'
} = {}) {
  const h = header.replace(/#user#/g, userName);

  return `${h}

${menuTopBorder}${separatorIcon} ${profileMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}perfilrpg
${middleBorder}${menuItemIcon}${prefix}carteira
${middleBorder}${menuItemIcon}${prefix}toprpg
${middleBorder}${menuItemIcon}${prefix}rankglobal
${middleBorder}${menuItemIcon}${prefix}ranklvl
${middleBorder}${menuItemIcon}${prefix}inv
${middleBorder}${menuItemIcon}${prefix}equipamentos
${middleBorder}${menuItemIcon}${prefix}conquistas
${bottomBorder}

${menuTopBorder}${separatorIcon} ${evolutionMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}evoluir
${middleBorder}${menuItemIcon}${prefix}prestige
${middleBorder}${menuItemIcon}${prefix}streak
${middleBorder}${menuItemIcon}${prefix}reivindicar
${middleBorder}${menuItemIcon}${prefix}speedup
${bottomBorder}

${menuTopBorder}${separatorIcon} ${economyMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}dep <valor|all>
${middleBorder}${menuItemIcon}${prefix}sacar <valor|all>
${middleBorder}${menuItemIcon}${prefix}pix @user <valor>
${middleBorder}${menuItemIcon}${prefix}loja
${middleBorder}${menuItemIcon}${prefix}comprar <item>
${middleBorder}${menuItemIcon}${prefix}vender <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}vagas
${middleBorder}${menuItemIcon}${prefix}emprego <vaga>
${middleBorder}${menuItemIcon}${prefix}demitir
${middleBorder}${menuItemIcon}${prefix}habilidades
${middleBorder}${menuItemIcon}${prefix}desafiosemanal
${middleBorder}${menuItemIcon}${prefix}desafiomensal
${bottomBorder}

${menuTopBorder}${separatorIcon} ${investmentMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}investir
${middleBorder}${menuItemIcon}${prefix}investir <acao> <qtd>
${middleBorder}${menuItemIcon}${prefix}sell <acao> <qtd>
${bottomBorder}

${menuTopBorder}${separatorIcon} ${gamblingMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}dados <valor>
${middleBorder}${menuItemIcon}${prefix}coinflip <cara|coroa> <valor>
${middleBorder}${menuItemIcon}${prefix}crash <valor>
${middleBorder}${menuItemIcon}${prefix}slots <valor>
${middleBorder}${menuItemIcon}${prefix}apostar <valor>
${middleBorder}${menuItemIcon}${prefix}roleta <valor> <cor>
${middleBorder}${menuItemIcon}${prefix}blackjack <valor>
${middleBorder}${menuItemIcon}${prefix}loteria
${middleBorder}${menuItemIcon}${prefix}loteria comprar <qtd>
${middleBorder}${menuItemIcon}${prefix}corrida <valor> <cavalo>
${middleBorder}${menuItemIcon}${prefix}leilao
${middleBorder}${menuItemIcon}${prefix}topriqueza
${bottomBorder}

${menuTopBorder}${separatorIcon} ${activitiesMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}diario
${middleBorder}${menuItemIcon}${prefix}work
${middleBorder}${menuItemIcon}${prefix}mine
${middleBorder}${menuItemIcon}${prefix}fish
${middleBorder}${menuItemIcon}${prefix}coletar
${middleBorder}${menuItemIcon}${prefix}colher
${middleBorder}${menuItemIcon}${prefix}caçar
${middleBorder}${menuItemIcon}${prefix}plantar <planta>
${middleBorder}${menuItemIcon}${prefix}cultivar <planta>
${middleBorder}${menuItemIcon}${prefix}plantacao
${middleBorder}${menuItemIcon}${prefix}sementes
${bottomBorder}

${menuTopBorder}${separatorIcon} ${adventureMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}explore
${middleBorder}${menuItemIcon}${prefix}masmorra
${middleBorder}${menuItemIcon}${prefix}bossrpg
${middleBorder}${menuItemIcon}${prefix}eventos
${bottomBorder}

${menuTopBorder}${separatorIcon} ${combatMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}duelrpg @user
${middleBorder}${menuItemIcon}${prefix}arena
${middleBorder}${menuItemIcon}${prefix}torneio
${middleBorder}${menuItemIcon}${prefix}assaltar @user
${middleBorder}${menuItemIcon}${prefix}crime
${middleBorder}${menuItemIcon}${prefix}guerra
${middleBorder}${menuItemIcon}${prefix}desafio
${bottomBorder}

${menuTopBorder}${separatorIcon} ${craftingMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}forge <item>
${middleBorder}${menuItemIcon}${prefix}enchant
${middleBorder}${menuItemIcon}${prefix}dismantle <item>
${middleBorder}${menuItemIcon}${prefix}reparar <item>
${middleBorder}${menuItemIcon}${prefix}materiais
${middleBorder}${menuItemIcon}${prefix}precos
${bottomBorder}

${menuTopBorder}${separatorIcon} ${socialMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}casar @user
${middleBorder}${menuItemIcon}${prefix}divorciar
${middleBorder}${menuItemIcon}${prefix}namorar @user
${middleBorder}${menuItemIcon}${prefix}terminar
${middleBorder}${menuItemIcon}${prefix}relacionamento
${middleBorder}${menuItemIcon}${prefix}casais
${middleBorder}${menuItemIcon}${prefix}abracarrpg @user
${middleBorder}${menuItemIcon}${prefix}beijarrpg @user
${middleBorder}${menuItemIcon}${prefix}baterrpg @user
${middleBorder}${menuItemIcon}${prefix}proteger @user
${bottomBorder}

${menuTopBorder}${separatorIcon} ${familyMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}familia
${middleBorder}${menuItemIcon}${prefix}adotaruser @user
${middleBorder}${menuItemIcon}${prefix}deserdar @user
${middleBorder}${menuItemIcon}${prefix}arvore
${bottomBorder}

${menuTopBorder}${separatorIcon} ${guildMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}criarcla <nome>
${middleBorder}${menuItemIcon}${prefix}cla
${middleBorder}${menuItemIcon}${prefix}convidar @user
${middleBorder}${menuItemIcon}${prefix}sair
${middleBorder}${menuItemIcon}${prefix}aceitarconvite <clanId|nome>
${middleBorder}${menuItemIcon}${prefix}recusarconvite <clanId|nome>
${middleBorder}${menuItemIcon}${prefix}expulsar @user
${middleBorder}${menuItemIcon}${prefix}rmconvite @user
${bottomBorder}

${menuTopBorder}${separatorIcon} ${questMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}missoes
${middleBorder}${menuItemIcon}${prefix}conquistas
${bottomBorder}

${menuTopBorder}${separatorIcon} ${petsMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}pets
${middleBorder}${menuItemIcon}${prefix}adotar <pet>
${middleBorder}${menuItemIcon}${prefix}feed <n>
${middleBorder}${menuItemIcon}${prefix}train <n>
${middleBorder}${menuItemIcon}${prefix}evolve <n>
${middleBorder}${menuItemIcon}${prefix}petbattle <n>
${middleBorder}${menuItemIcon}${prefix}renamepet <n> <nome>
${middleBorder}${menuItemIcon}${prefix}petbet <valor> <n> @user
${middleBorder}${menuItemIcon}${prefix}equippet <n> <nome do item>
${middleBorder}${menuItemIcon}${prefix}unequippet <n> <slot?>
${bottomBorder}

${menuTopBorder}${separatorIcon} ${reputationMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}rep
${middleBorder}${menuItemIcon}${prefix}vote @user
${bottomBorder}

${menuTopBorder}${separatorIcon} ${eventsMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}eventos
${bottomBorder}

${menuTopBorder}${separatorIcon} ${premiumMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}lojapremium
${middleBorder}${menuItemIcon}${prefix}comprarpremium <item>
${middleBorder}${menuItemIcon}${prefix}boost
${middleBorder}${menuItemIcon}${prefix}propriedades
${middleBorder}${menuItemIcon}${prefix}cprop <id>
${middleBorder}${menuItemIcon}${prefix}cprops
${middleBorder}${menuItemIcon}${prefix}tributos
${middleBorder}${menuItemIcon}${prefix}meustats
${middleBorder}${menuItemIcon}${prefix}doar <valor>
${middleBorder}${menuItemIcon}${prefix}presente @user <item>
${bottomBorder}

${menuTopBorder}${separatorIcon} ${adminMenuTitle}
${middleBorder}
${middleBorder}${menuItemIcon}${prefix}rpgadd @user <valor>
${middleBorder}${menuItemIcon}${prefix}rpgremove @user <valor>
${middleBorder}${menuItemIcon}${prefix}rpgsetlevel @user <nivel>
${middleBorder}${menuItemIcon}${prefix}rpgadditem @user <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}rpgremoveitem @user <item> <qtd>
${middleBorder}${menuItemIcon}${prefix}rpgresetplayer @user
${middleBorder}${menuItemIcon}${prefix}rpgresetglobal confirmar
${middleBorder}${menuItemIcon}${prefix}rpgstats
${bottomBorder}

${menuTopBorder}${separatorIcon} ${menuTitleIcon} ${botName}
${middleBorder}${menuItemIcon} User: ${userName}
${middleBorder}${menuItemIcon} RPG mode: ${prefix}modorpg
${bottomBorder}`;
}
