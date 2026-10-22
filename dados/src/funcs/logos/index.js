import {
  LOGO_COMMANDS,
  ONE_TEXT_COMMANDS,
  TWO_TEXT_COMMANDS,
  LOGO_STYLES,
  buildLogoSvg,
  generateLocalLogo,
  isImageBuffer
} from './local.js';

async function gerarLogo({ query, type }, options = {}) {
  return generateLocalLogo({ query, type }, options);
}

async function gerarLogo2({ query, query2, type }, options = {}) {
  return generateLocalLogo({ query, query2, type }, options);
}

export {
  gerarLogo,
  gerarLogo2,
  isImageBuffer,
  buildLogoSvg,
  LOGO_COMMANDS,
  ONE_TEXT_COMMANDS,
  TWO_TEXT_COMMANDS,
  LOGO_STYLES
};
