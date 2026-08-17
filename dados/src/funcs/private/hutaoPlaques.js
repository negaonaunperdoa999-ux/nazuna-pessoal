export const PLAQ_COMMANDS = Object.freeze([
  'plaq1',
  'plaq2',
  'plaq3',
  'plaq4',
  'plaq5',
  'plaq6',
  'plaq7'
]);

const PLAQ_DEFINITIONS = Object.freeze({
  plaq1: Object.freeze({
    maxLength: 25,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Maximo permitido e ate 25 caracteres [!]',
    caption: 'Plaquinha feita',
    urlTemplate:
      'https://ubbornag.sirv.com/Screenshot_20210513-151821.png?text.0.text={text}&text.0.position.x=-40%25&text.0.position.y=-65%25&text.0.size=30&text.0.color=000000&text.0.opacity=53&text.0.font.family=Shadows%20Into%20Light%20Two&text.0.outline.blur=15'
  }),
  plaq2: Object.freeze({
    maxLength: 10,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Maximo permitido e ate 10 caracteres [!]',
    caption: 'Plaquinha feita...',
    urlTemplate:
      'https://rsymenti.sirv.com/images%20(10).jpeg?text.0.text={text}&text.0.position.gravity=south&text.0.position.x=4%25&text.0.position.y=-32%25&text.0.align=left&text.0.size=34&text.0.color=000000&text.0.opacity=78&text.0.background.opacity=78&text.0.outline.blur=72&text.0.outline.opacity=74'
  }),
  plaq3: Object.freeze({
    maxLength: 20,
    missingText: 'What? cade o texto?',
    maxLengthText: 'Maximo permitido e ate 20 caracteres [!]',
    caption: 'Plaquinha feita com sucesso...',
    urlTemplate:
      'https://lculitas.sirv.com/ETw3FRnXgAI3Up_.jpg?text.0.text={text}&text.0.position.gravity=center&text.0.align=left&text.0.size=46&text.0.color=221b1b&text.0.opacity=47&text.0.font.family=Architects%20Daughter&text.0.background.color=783852&text.0.background.opacity=5&text.0.outline.blur=58'
  }),
  plaq4: Object.freeze({
    maxLength: 15,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Maximo permitido e ate 15 caracteres [!]',
    caption: 'Plaquinha feita',
    urlTemplate:
      'https://raptibef.sirv.com/images%20(3).jpeg?text.0.text={text}&text.0.position.gravity=center&text.0.position.x=19%25&text.0.size=45&text.0.color=000000&text.0.opacity=55&text.0.font.family=Crimson%20Text&text.0.font.weight=300&text.0.font.style=italic&text.0.outline.opacity=21'
  }),
  plaq5: Object.freeze({
    maxLength: 15,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Vai fazer uma redacao e? Limite maximo e 15 caracteres',
    caption: 'Plaquinha feita',
    urlTemplate:
      'https://raptibef.sirv.com/images%20(1).jpeg?profile=Zanga%202.0&text.0.text={text}'
  }),
  plaq6: Object.freeze({
    maxLength: 15,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Maximo permitido e ate 15 caracteres [!]',
    caption: 'Plaquinha feita',
    urlTemplate:
      'https://raptibef.sirv.com/images.jpeg?profile=Zanga%203.0&text.0.text={text}&text.0.outline.blur=63'
  }),
  plaq7: Object.freeze({
    maxLength: 10,
    missingText: 'Cade o texto pra gerar a plaq?',
    maxLengthText: 'Maximo permitido e ate 10 caracteres [!]',
    caption: 'Plaquinha feita',
    urlTemplate:
      'https://umethroo.sirv.com/Torcedora-da-sele%C3%A7%C3%A3o-brasileira-nua-mostrando-a-bunda-236x300.jpg?text.0.text={text}&text.0.position.x=-64%25&text.0.position.y=-39%25&text.0.size=25&text.0.color=1b1a1a&text.0.font.family=Architects%20Daughter'
  })
});

export function getPlaqDefinition(command) {
  return PLAQ_DEFINITIONS[command] ?? null;
}

export function buildPlaqUrl(command, text) {
  const definition = getPlaqDefinition(command);
  if (!definition) {
    throw new Error(`Comando de plaq desconhecido: ${command}`);
  }

  return definition.urlTemplate.replace('{text}', encodeURIComponent(text));
}

export async function fetchPlaqImageBuffer(command, text, axiosInstance) {
  const url = buildPlaqUrl(command, text);
  const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
}
