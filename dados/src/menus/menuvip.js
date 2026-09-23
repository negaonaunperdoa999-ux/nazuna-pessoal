const PLAQ_COMMANDS = ['plaq1', 'plaq2', 'plaq3', 'plaq4', 'plaq5', 'plaq6', 'plaq7'];

function buildHeader(header, userName) {
  return header.replace(/#user#/g, userName);
}

async function menuVIP(prefix, botName = "MeuBot", userName = "Usuario", {
  header = `==== ${botName} ====\nOla, #user#!`,
  menuTopBorder = "====",
  bottomBorder = "====",
  menuItemIcon = "- ",
  separatorIcon = "",
  middleBorder = "| "
} = {}) {
  const formattedHeader = buildHeader(header, userName);
  const commandLines = PLAQ_COMMANDS
    .map((cmd) => `${middleBorder}${menuItemIcon}${prefix}${cmd} <texto>`)
    .join('\n');

  return `${formattedHeader}

${menuTopBorder}${separatorIcon} COMANDOS VIP +18
${middleBorder}
${commandLines}
${bottomBorder}

${menuTopBorder}${separatorIcon} ACESSO
${middleBorder}${menuItemIcon}Apenas dono ou VIP
${middleBorder}${menuItemIcon}Requer ${prefix}modo18 ativo no grupo
${bottomBorder}`;
}

async function menuVIPInfo(prefix, botName = "MeuBot", userName = "Usuario", options = {}) {
  return menuVIP(prefix, botName, userName, options);
}

async function listVIPCommands(prefix, botName = "MeuBot", userName = "Usuario", options = {}) {
  return menuVIP(prefix, botName, userName, options);
}

export {
  menuVIP,
  menuVIPInfo,
  listVIPCommands
};

export default menuVIP;
