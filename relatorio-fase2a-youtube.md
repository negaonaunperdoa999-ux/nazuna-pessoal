# Relatório da Fase 2A - Alternativas para YouTube em `/play`

**Data:** 2026-10-20  
**Base:** branch `main`, HEAD `0a5c3b0`  
**Escopo:** pesquisa e decisão de arquitetura; nenhuma implementação de produção  
**Relacionado:** `relatorio-vex-play.md`

## 1. Objetivo

Definir como substituir gradualmente a Vex nos comandos `/play`, `/ytmp3`, `/play2`, `/playvid` e `/ytmp4`, mantendo as assinaturas atuais e priorizando:

- baixo uso de RAM;
- download controlado, com timeout, cancelamento e limite de bytes;
- compatibilidade com o Baileys;
- possibilidade de fallback para a Vex durante a transição;
- operação viável em Windows, Node.js 24 e sem infraestrutura obrigatória.

Esta fase é somente de investigação. Não foram feitos downloads reais, chamadas à Vex ou ao WhatsApp, instalação de dependências, alterações de código de produção, commit ou push.

## 2. Resumo executivo

A recomendação principal é:

1. **Produção:** usar um **backend próprio de mídia com `yt-dlp` + `ffmpeg`**, e manter o bot apenas como cliente. O backend concentra extração, conversão, fila, limites e limpeza; o bot recebe um stream ou arquivo temporário e entrega ao Baileys.
2. **Transição local, se não houver backend na Fase 2B:** usar `youtubei.js` apenas como opção local, com limitações explícitas: download de formatos nativos, vídeo normalmente limitado a MP4 360p com áudio e áudio em M4A/Opus, sem garantia de MP3 e sem fusão de faixas.
3. **Não usar** `@distube/ytdl-core`, `ytdl-core`, `play-dl` ou `yt-dlp-wrap` como base nova: os dois primeiros estão oficialmente descontinuados/pausados, o repositório do `play-dl` não está disponível e o repositório do `yt-dlp-wrap` também retorna 404.
4. **Não usar `youtube-dl-exec` como primeira escolha** em Windows: o wrapper exige Python 3.9 disponível como `python3`, baixa o `yt-dlp` no pós-instalação e adiciona uma camada que não resolve o problema principal. Se for para usar `yt-dlp`, chamar o executável diretamente é mais previsível.
5. **Manter `yt-search` apenas como busca**, nunca como extrator de mídia. Ele já está instalado e pode ser fallback de pesquisa, mas sozinho não atende `/play`.
6. **Não passar URL remota de mídia diretamente ao Baileys.** A URL pode expirar, pode apontar para host não confiável e não permite controle confiável de tamanho. O fluxo deve baixar/armazenar de forma controlada e entregar um stream ou arquivo local.
7. **Sempre usar stream/arquivo temporário**, não `Buffer` integral, mesmo abaixo do limite. O Baileys já grava a mídia em arquivo temporário; manter mais uma cópia inteira em RAM é desnecessário.

A decisão final ainda depende das respostas da seção 13, principalmente: existe backend próprio, é permitido instalar `yt-dlp`/`ffmpeg` e o comando precisa entregar MP3 ou pode entregar M4A.

## 3. Requisitos considerados

- Preservar comandos, aliases e textos atuais.
- Aceitar URL do YouTube e busca por texto.
- Validar host/ID com `new URL`, não com `includes`.
- Checar duração antes de baixar, inclusive no caminho com URL.
- Áudio: limite inicial de 32 MB; vídeo 360p: 64 MB; busca: 15 s; download: 120 s; concorrência: 2; fila: 20; redirecionamentos: 3. Valores configuráveis.
- Entregar áudio, vídeo ou documento sem manter o arquivo inteiro em memória.
- Limpar arquivos temporários em sucesso, erro, timeout e cancelamento.
- Cachear somente metadados de busca, nunca mídia.
- Fallback para Vex apenas antes do envio ao WhatsApp; depois de iniciado o envio, não baixar de novo e arriscar mensagem duplicada.
- Default permanecer `vex` durante a transição.

## 4. Estado atual relevante

- `youtube.search()` usa a Vex e retorna somente o primeiro resultado.
- `youtube.mp3()` e `youtube.mp4()` baixam o arquivo inteiro para `Buffer`; o segundo parâmetro de qualidade é aceito nas chamadas, mas ignorado pelas funções.
- `/play` e `/playvid` não validam duração/tamanho no caminho com URL.
- `/playvid` acessa `author.name`, `views.toLocaleString()` e `description.slice()` sem proteção.
- `/play2` é quase uma cópia de `/play` sem a mensagem de metadados.
- O envio atual usa `audio: dlRes.buffer` / `video: dlRes.buffer`, com fallback reativo para documento em erro de tamanho.
- O `author` retornado pelo módulo é uma string, mas o `index.js` espera `author.name`; isso tende a produzir `undefined` na apresentação.
- `package.json` declara `baileys: ^7.0.0-rc.9`, o lock registra `rc13` e a instalação local contém `rc14`. Não alterar nesta fase; apenas registrar a divergência.
- `sharp` está instalado, mas não declarado no `package.json`.
- `ffmpeg`, `ffprobe`, `yt-dlp` e `youtube-dl` não estão no PATH.
- Node v24.19.0 está disponível fora do PATH; Python 3.14 e `pip` estão disponíveis.
- `yt-search@2.13.1` e `fluent-ffmpeg@2.1.3` estão instalados; `youtubei.js` não.

## 5. Contrato de mídia do Baileys

O Baileys instalado é `7.0.0-rc14`. As evidências abaixo são do código local em `node_modules/baileys/lib`.

### 5.1 O que é aceito

`WAMediaUpload` aceita:

```ts
Buffer | { stream: Readable } | { url: URL | string }
```

Referência: `node_modules/baileys/lib/Types/Message.d.ts:37-40`.

Para `audio` e `video`, o tipo é `WAMediaUpload`; portanto, `{ stream }` é oficialmente aceito, não é gambiarra.

### 5.2 O que o Baileys faz com o stream

`prepareWAMessageMedia()` chama `encryptedStream()` (`lib/Utils/messages.js:139`). O `encryptedStream()`:

- obtém o stream via `getStream()`;
- grava o conteúdo cifrado em arquivo temporário;
- opcionalmente grava uma cópia "original" para calcular duração/thumbnail;
- faz hash, criptografia e upload;
- remove os temporários no `finally`.

Referências: `lib/Utils/messages-media.js:309-399` e `lib/Utils/messages.js:184-195`.

### 5.3 Limite de tamanho

O `encryptedStream()` só aplica `opts.maxContentLength` quando o tipo é `remote`, ou seja, quando o Baileys mesmo baixa uma URL:

```js
if (type === 'remote' && opts?.maxContentLength && ...)
```

Referência: `lib/Utils/messages-media.js:338-344`.

Quando entregamos `{ stream }`, o tipo é `readable`, e esse limite não é aplicado. Portanto:

- o nosso código precisa contar bytes e abortar;
- não podemos confiar no Baileys para impor o limite;
- o stream precisa ser destruído/cancelado em erro, timeout e excesso de tamanho.

### 5.4 Duração, thumbnail e PTT

`prepareWAMessageMedia()` decide o que calcular:

- áudio sem `seconds`: calcula duração com `music-metadata`;
- vídeo sem `jpegThumbnail`: tenta gerar thumbnail com `ffmpeg`;
- áudio com `ptt: true` e sem `waveform`: tenta gerar waveform.

Referências: `lib/Utils/messages.js:134-137` e `lib/Utils/messages-media.js:176-234`.

Consequências:

- **Áudio:** passar `seconds` evita uma leitura extra do arquivo e evita depender do cálculo de duração.
- **Vídeo:** passar `jpegThumbnail` em base64 evita a chamada externa ao `ffmpeg`. Como não há `ffmpeg` no PATH, sem isso o Baileys registra falha ao gerar thumbnail, embora o vídeo possa continuar.
- **PTT:** não ativar `ptt: true` sem um plano de conversão para Ogg/Opus e geração de waveform. O fluxo atual de `/play` envia áudio normal, não voice note; manter assim reduz risco.

### 5.5 Stream da Web vs stream do Node

`youtubei.js` retorna um `ReadableStream` da Web. O Baileys espera um `Readable` do Node (`stream`). A conversão deve ser explícita com `Readable.fromWeb(...)`; não passar o objeto da Web diretamente, porque o Baileys chama `.destroy()` e outros métodos do stream do Node.

### 5.6 Implicação arquitetural

O fluxo seguro é:

```text
provider
  -> stream de origem
  -> gravação controlada em arquivo temporário nosso
  -> validação de tamanho/tipo
  -> createReadStream() para o Baileys
  -> limpeza do nosso temporário
```

Isso permite:

- limite de bytes controlado por nós;
- nova abertura do arquivo para fallback como documento;
- retry/erro sem manter tudo em RAM;
- limpeza determinística.

O custo é disco e uma passada extra. É preferível a `Buffer` de 32/64 MB por download concorrente.

## 6. Comparação de alternativas

As classificações são qualitativas. Não foram executados benchmarks; portanto, não há números de RAM, CPU ou latência inventados.

### 6.1 Matriz de extração de mídia

| Alternativa | Busca | Áudio | Vídeo | Instalação em Windows | Manutenção | Avaliação |
|---|---|---|---|---|---|---|
| `yt-dlp` direto ou em backend | Sim (`ytsearch`) | Sim, com pós-processamento | Sim, inclusive merge | Binário x64 disponível | Muito ativa | **Melhor robustez**; custo operacional maior |
| `youtubei.js` | Sim | Formato nativo | Formato nativo; merge exige FFmpeg | npm, sem binário nativo | Ativa | Boa opção local, mas exige avaliador JS e tem limites de formato |
| `youtube-dl-exec` | Via `yt-dlp` | Via `yt-dlp` | Via `yt-dlp` | npm + Python + download do binário | Ativa | Camada extra; não é necessária |
| `yt-search` | Sim | Não | Não | npm | Ativa | Apenas busca/fallback |
| `youtube-sr` | Sim | Não | Não | npm, sem dependências | Ativa em 2025 | Busca alternativa, menos usada |
| `ytsr` | Sim | Não | Não | npm | Parada desde 2023 | Evitar |
| `@distube/ytdl-core` | Não | Sim, em teoria | Sim, em teoria | npm | Descontinuado pelo próprio README | Evitar |
| `ytdl-core` | Não | Sim, em teoria | Sim, em teoria | npm | Desenvolvimento pausado em 2023 | Evitar |
| `play-dl` | Sim | Sim, em teoria | Sim, em teoria | npm | Última publicação em 2023; repositório 404 | Evitar |
| `yt-dlp-wrap` | Via `yt-dlp` | Via `yt-dlp` | Via `yt-dlp` | npm | Última publicação em 2023; repositório 404 | Evitar |

### 6.2 Matriz de busca

| Alternativa | Versão | Última publicação | Downloads/30d | Dependências | Situação |
|---|---:|---|---:|---|---|
| `youtubei.js` | 18.2.0 | 2026-10-18 | 814.888 | `fflate`, `meriyah`, `@bufbuild/protobuf` | Ativa; busca + metadados + download |
| `yt-search` | 2.13.1 | 2025-05-02 | 261.643 | várias, incluindo `cheerio` | Instalada; somente busca |
| `youtube-sr` | 4.3.12 | 2025-07-03 | 24.692 | nenhuma | Busca apenas; alternativa secundária |
| `ytsr` | 3.8.4 | 2023-08-11 | 10.188 | `miniget` | Parada; evitar |
| `yt-dlp` (via `ytsearch`) | 2026.08.19 | 2026-08-19 | não se aplica | binário | Busca integrada ao extrator |

### 6.3 Matriz de ferramentas de conversão

| Alternativa | Versão | Publicação | Situação | Observação |
|---|---:|---|---|---|
| `ffmpeg-static` | 5.3.0 | 2025-11-14 | Ativa | Binários estáticos para Windows 32/64; usa FFmpeg 6.1.1; licença GPL-3.0-or-later; baixa binário na instalação |
| `fluent-ffmpeg` | 2.1.3 | 2024-05-19 | Estável, mas depende de binário | Não traz `ffmpeg`/`ffprobe`; já está no `package.json` |
| `@ffmpeg-installer/ffmpeg` | 1.1.0 | 2021-07-15 | Antiga | Binários de 2018; não recomendada |
| `ffprobe-static` | 3.1.0 | 2022-06-17 | Antiga | Só faz sentido junto de um FFmpeg atualizado |

## 7. Análise detalhada

### 7.1 `yt-dlp`

**Situação atual:** repositório ativo, release estável `2026.08.19`, binário Windows x64 `yt-dlp.exe` com aproximadamente 17,8 MB. O projeto tem cerca de 200 mil estrelas no GitHub e releases frequentes. A documentação atual recomenda `ffmpeg`/`ffprobe`, `yt-dlp-ejs` e um runtime JavaScript para suporte completo ao YouTube; o canal `nightly` é recomendado para correções rápidas.

**Vantagens:**

- extração mais robusta contra mudanças do YouTube;
- busca, metadados, formatos, legendas, cookies, proxies e limites;
- fusão de áudio/vídeo e conversão para MP3 via FFmpeg;
- executa em processo separado, então uma falha de extração não derruba o bot;
- atualização relativamente simples (`yt-dlp -U`).

**Desvantagens:**

- exige binário externo;
- FFmpeg é necessário para merge e MP3;
- o binário standalone pode ser GPLv3+ por incluir componentes GPL;
- updates podem quebrar compatibilidade ou exigir validação;
- executar por requisição tem custo de processo e disco;
- é preciso controle rígido de argumentos para não permitir injeção de opções.

**Conclusão:** é a opção mais confiável para produção, desde que executada com argumentos controlados e, preferencialmente, em backend separado.

### 7.2 `youtubei.js`

**Situação atual:** versão 18.2.0, publicada em 2026-10-18, cerca de 815 mil downloads/mês, licença MIT, sem dependências nativas. O repositório tem cerca de 5,4 mil estrelas e está ativo. Oferece `Innertube.search()`, `getInfo()`, `getStreamingData()` e `download()`; este último retorna um `ReadableStream` da Web.

**Vantagens:**

- uma única biblioteca para busca, metadados e download;
- sem binário externo;
- API de stream adequada para gravar em arquivo temporário;
- formatos nativos permitem áudio M4A/Opus e vídeo MP4 360p sem FFmpeg;
- MIT.

**Desvantagens:**

- a documentação atual exige um avaliador JavaScript próprio para decifrar URLs de streaming. O avaliador padrão do Node em `src/platform/jsruntime/default.ts` lança erro explicitamente;
- o exemplo oficial usa `new Function` para executar o código ofuscado do YouTube, o que é execução de código remoto sem sandbox. Isso precisa ser tratado com cuidado ou evitado;
- sem `ffmpeg`, não há MP3 nem merge de faixas de alta qualidade;
- alguns vídeos/formatos podem exigir PO token, cookies ou ajustes de cliente;
- mudanças do YouTube podem exigir atualização da biblioteca e do avaliador;
- a API pode retornar formatos diferentes do esperado; é preciso fallback de formato.

**Conclusão:** é a melhor opção local sem binários, mas não é equivalente à Vex em formato/qualidade. Só deve ser adotada após validar o avaliador JS e os formatos reais. Para produção, `yt-dlp` é mais robusto.

### 7.3 Bibliotecas somente de busca

- **`yt-search`:** já instalado, versão 2.13.1, ativa em 2025, bom volume de downloads. O README e a API deixam claro que é busca; não baixa mídia. Pode ser fallback de pesquisa se `youtubei.js` falhar, mas não resolve `/play`.
- **`youtube-sr`:** 4.3.12, ativa em 2025, sem dependências. É uma alternativa de busca mais leve, porém com menos adoção e sem extração.
- **`ytsr`:** parada desde 2023; não usar em código novo.

### 7.4 Bibliotecas descontinuadas ou inadequadas

- **`@distube/ytdl-core` 4.16.12:** o próprio README diz que o fork não será mais mantido e recomenda `youtubei.js`.
- **`ytdl-core` 4.11.5:** desenvolvimento pausado desde 2023-07-14, conforme o README.
- **`play-dl` 1.9.7:** última publicação em 2023-09-24; o repositório indicado no npm retorna 404.
- **`yt-dlp-wrap` 2.3.12:** última publicação em 2023-09-13; o repositório indicado no npm retorna 404.
- **`youtube-dl-exec` 3.1.17:** ativo, mas é um wrapper; exige Python 3.9 como `python3` e baixa o `yt-dlp` no pós-instalação. Em Windows, o comando `python3` pode não existir, e o pós-instalação adiciona um ponto de falha. Preferir o binário direto.

### 7.5 Conversão e FFmpeg

`fluent-ffmpeg` não inclui binários; sem `ffmpeg`/`ffprobe` no PATH, não funciona. Para uma solução local, as opções são:

- `ffmpeg-static@5.3.0` + binário FFmpeg 6.1.1, Windows 32/64, licença GPL-3.0-or-later, download na instalação;
- instalar FFmpeg manualmente e configurar o caminho;
- manter conversão no backend, fora do bot.

Para o escopo inicial, a melhor decisão é **não exigir FFmpeg no bot**. Se o produto exigir MP3 e merge de alta qualidade, isso deve ficar no backend ou ser uma dependência explicitamente aprovada.

### 7.6 Formatos e WhatsApp

- O fluxo atual envia áudio como `audio/mpeg` (MP3). Se o extrator entregar M4A, o mimetype precisaria ser `audio/mp4`; isso precisa ser validado no WhatsApp antes de virar padrão.
- Voice note (`ptt: true`) exige Ogg/Opus e waveform. Não ativar PTT no `/play`; ele envia áudio normal.
- Para vídeo, o caso mais simples é MP4 360p com áudio já combinado. Formatos acima de 360p normalmente exigem faixas separadas e merge com FFmpeg.
- O formato 18 (MP4 360p com áudio) é comum, mas não deve ser tratado como garantido para todo vídeo. O provider precisa escolher o melhor formato combinado disponível ou falhar de forma explícita.

## 8. Arquitetura recomendada

### 8.1 Visão geral

```text
index.js
  -> api/index.js: run('youtube.audio' | 'youtube.video', input)
      -> features/youtube.js
          -> normalização e validação
          -> cache de metadados
          -> limiter
          -> provider escolhido
              -> backend próprio (yt-dlp + ffmpeg)   [produção]
              -> local (youtubei.js ou yt-dlp)       [transição]
              -> vex                                  [fallback]
          -> MediaSource (arquivo temporário + metadados)
      -> envio Baileys com stream e metadados
      -> cleanup em finally
```

### 8.2 Contrato interno

Criar uma abstração reutilizável, por exemplo:

```js
{
  openStream(): Promise<Readable>, // nova abertura para retry/fallback
  sizeBytes: number,
  meta: {
    title,
    author,
    durationSeconds,
    thumbnail,
    filename,
    mimetype
  },
  cleanup(): Promise<void>
}
```

Regras:

- `openStream()` deve poder ser chamado mais de uma vez, sempre a partir do arquivo temporário.
- `cleanup()` deve ser idempotente.
- O feature não devolve `Buffer` de mídia.
- O arquivo temporário é criado em diretório próprio, com nome aleatório e permissões restritas.
- O limite de bytes é aplicado durante a escrita, não depois.
- O provider não tem permissão de escolher caminho arbitrário; o `media.js` controla o diretório.

### 8.3 Componentes

- `dados/src/funcs/api/features/youtube.js`
  - `normalizeYoutubeInput()`
  - `search()`
  - `getAudio()`
  - `getVideo()`
  - `runYoutube()`
- `dados/src/funcs/api/providers/local/youtube.js`
  - implementação local (`yt-dlp` ou `youtubei.js`);
  - separar `search`, `prepareAudio`, `prepareVideo`.
- `dados/src/funcs/api/providers/vex/youtube.js`
  - adaptador para o contrato novo, reutilizando o módulo Vex atual.
- `dados/src/funcs/api/media.js`
  - download/stream com `AbortController`, timeout, redirecionamentos limitados, `Content-Length`, limite de bytes e escrita atômica em temporário;
  - limpeza e varredura de temporários órfãos.
- `dados/src/funcs/api/config.js` e `policy.js`
  - `NAZUNA_YOUTUBE_PROVIDER=local|vex|auto`, default `vex`;
  - limites e timeouts;
  - cadeia `local -> vex` em `auto`.
- `dados/src/funcs/api/index.js`
  - registrar `youtube.audio` e `youtube.video`.
- `dados/src/index.js`
  - trocar as chamadas de `youtube.mp3/mp4` por `run('youtube.audio'|'youtube.video', ...)`;
  - manter textos, aliases e fallback de documento.

### 8.4 Fluxo de envio

1. Normalizar entrada e metadados.
2. Verificar duração e limites antes de baixar.
3. Provider grava em arquivo temporário com limite de bytes.
4. Validar tamanho e mimetype.
5. Enviar ao Baileys:
   - `audio: { stream: createReadStream(path) }`, `seconds`, `mimetype`;
   - `video: { stream: createReadStream(path) }`, `jpegThumbnail`, `mimetype`.
6. Em erro de tamanho no envio, reabrir o arquivo e enviar como `document`.
7. Em `finally`, fechar streams e chamar `cleanup()`.
8. Não tentar novo provider depois que o envio começou.

### 8.5 Configuração inicial sugerida

```text
NAZUNA_YOUTUBE_PROVIDER=vex
NAZUNA_YOUTUBE_MAX_AUDIO_MB=32
NAZUNA_YOUTUBE_MAX_VIDEO_MB=64
NAZUNA_YOUTUBE_MAX_DURATION_SECONDS=1800
NAZUNA_YOUTUBE_SEARCH_TIMEOUT_MS=15000
NAZUNA_YOUTUBE_MEDIA_TIMEOUT_MS=120000
NAZUNA_YOUTUBE_MAX_CONCURRENT=2
NAZUNA_YOUTUBE_QUEUE_LIMIT=20
```

O default `vex` é obrigatório durante a transição. `auto` deve ser opt-in até os testes manuais serem concluídos.

## 9. Decisão recomendada

### 9.1 Primária: backend próprio com `yt-dlp` + `ffmpeg`

É a opção com maior chance de continuar funcionando quando o YouTube mudar. Também é a que melhor separa responsabilidades:

- o bot não precisa de binários, cookies ou lógica de decipher;
- o backend pode limitar recursos, enfileirar, converter e limpar;
- o bot fica com um cliente HTTP simples e streaming controlado;
- falhas de extração não derrubam o processo do WhatsApp.

Custo: operar mais um serviço e manter `yt-dlp`/FFmpeg atualizados.

### 9.2 Alternativa local com `yt-dlp`

Se não houver backend, mas for permitido instalar binários, usar `yt-dlp.exe` diretamente via `child_process.spawn`:

- argumentos fixos e allowlist;
- `--no-playlist`, `--no-warnings`, `--no-progress`, `--socket-timeout`, `--max-filesize`;
- `--print-json` para metadados ou `-J` com cuidado;
- saída de mídia em arquivo temporário, não em memória;
- `AbortController`/kill no timeout;
- FFmpeg para MP3/merge.

Não usar `youtube-dl-exec` nem `yt-dlp-wrap` como camada adicional.

### 9.3 Alternativa local sem binários: `youtubei.js`

É a única opção viável sem instalar binários, mas com estas limitações explícitas:

- exige avaliador JS customizado para decifrar formatos;
- não entrega MP3 sem FFmpeg;
- vídeo acima de 360p pode exigir merge;
- a seleção de formato precisa de fallback;
- o avaliador com `new Function` tem risco de segurança;
- precisa de validação real antes de ser default.

Ela serve como transição, não como substituta definitiva da Vex em qualidade.

### 9.4 O que não recomendamos

- `@distube/ytdl-core`, `ytdl-core`, `play-dl`: descontinuados/pausados/sem repositório.
- `yt-dlp-wrap`: repositório 404.
- `youtube-dl-exec`: wrapper com Python e pós-instalação; camada extra.
- `ffmpeg-static` no bot como primeira escolha: aumenta pacote, licença e superfície de instalação; preferir no backend.
- URL remota direta no Baileys: expiração, SSRF e falta de controle de tamanho.

## 10. Plano para a Fase 2B

Nenhum item abaixo foi implementado.

1. Criar o contrato `MediaSource` e `features/youtube.js` com testes usando providers falsos.
2. Criar `media.js` com escrita temporária, limite de bytes, timeout, abort e limpeza.
3. Implementar o provider escolhido:
   - backend próprio, se aprovado; ou
   - `yt-dlp` local direto; ou
   - `youtubei.js` local transitório.
4. Implementar `providers/vex/youtube.js` como fallback, sem chamadas reais em testes.
5. Adicionar configuração e flag, mantendo `vex` como default.
6. Migrar primeiro `/play`/`/ytmp3`; validar. Depois `/play2`, `/playvid`, `/ytmp4`.
7. Trocar o envio para stream + `seconds` + `jpegThumbnail`, com fallback para documento.
8. Adicionar testes de:
   - URL inválida, host inválido e ID inválido;
   - busca sem resultado;
   - duração acima do limite;
   - arquivo acima do limite;
   - timeout de busca e de download;
   - abort/cancelamento e limpeza de temporário;
   - falha do provider e fallback para Vex;
   - falha de envio e fallback para documento;
   - concorrência e fila;
   - stream com backpressure.
9. Rodar `node --test "test/api/*.test.js"` e `git diff --check`.
10. Fazer teste manual controlado no WhatsApp, com uma conta de teste, somente após aprovação.

## 11. Critérios de aceite

- Nenhum download de mídia fica inteiro em RAM.
- Nenhuma URL remota é enviada ao Baileys para YouTube.
- Timeout, limite de bytes, duração e cancelamento são aplicados antes/durante o download.
- Arquivo temporário é removido em todos os caminhos.
- Falha de provider cai para Vex somente antes do envio.
- Falha de envio por tamanho reenvia como documento usando o mesmo arquivo.
- Comandos e aliases atuais continuam funcionando.
- Default continua `vex` até aprovação explícita.
- Testes automatizados não chamam Vex, WhatsApp ou YouTube real.
- Não há regressão nos 33 testes da Etapa 1.

## 12. Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| YouTube muda extração/PO token | Download falha | `yt-dlp` atualizado/backend; fallback Vex; mensagem clara |
| IP bloqueado | Busca/download falham | Backend com IP próprio/proxy; fallback; limites |
| Vídeo sem formato combinado 360p | Sem MP4 direto | Escolher melhor combinado; merge no backend; erro explícito |
| MP3 exige FFmpeg | Sem áudio no formato atual | Conversão no backend ou aceitar M4A com validação |
| Arquivo grande | Disco/RAM/tempo | Limite durante stream; abort; fila; aviso antes |
| Temporário órfão | Disco cheio | `finally`, varredura TTL, diretório dedicado |
| Baileys spoola em temp | Latência/disco | Assumir o custo; monitorar; não duplicar em RAM |
| Stream fornecido sem limite no Baileys | Consumo excessivo | Contador/Transform próprio e abort |
| `new Function` no `youtubei.js` | Execução de código remoto | Evitar; sandbox/avaliador restrito; preferir backend |
| Dependências descontinuadas | Falha silenciosa | Não usar; validar manutenção antes de adicionar |
| Licença GPL de binários | Obrigações de distribuição | Avaliar antes de empacotar FFmpeg/yt-dlp |
| Divergência de versão do Baileys | Contrato diferente | Não alterar agora; fixar versão antes da 2B |

## 13. Perguntas para aprovação

1. A Fase 2B terá um backend próprio disponível? Se sim, qual URL, autenticação e formato de resposta?
2. É permitido instalar `yt-dlp.exe` e FFmpeg no host do bot, ou tudo deve ser npm puro?
3. `/play` precisa obrigatoriamente entregar MP3, ou M4A é aceitável mediante validação no WhatsApp?
4. Os limites de 32 MB (áudio), 64 MB (vídeo 360p) e 30 minutos permanecem?
5. O default deve continuar `vex` e `auto` deve ser opt-in?
6. Podemos limitar vídeo a 360p nesta fase e deixar 720p+ para o backend?
7. Há cookies/PO token disponíveis para o backend ou a operação será anônima?
8. O fallback para Vex deve continuar após a migração ou será removido em uma fase posterior?

## 14. Fontes consultadas

Acesso em 2026-10-20.

- `yt-dlp` README e releases: https://github.com/yt-dlp/yt-dlp
- `yt-dlp` instalação: https://github.com/yt-dlp/yt-dlp/wiki/Installation
- `youtubei.js` README: https://github.com/LuanRT/YouTube.js
- `youtubei.js` guia: https://ytjs.dev/guide/getting-started.html
- `youtubei.js` `Innertube.download`: https://github.com/LuanRT/YouTube.js/blob/main/docs/api/classes/Innertube.md
- `youtubei.js` `DownloadOptions`: https://github.com/LuanRT/YouTube.js/blob/main/docs/api/youtubei.js/namespaces/Types/interfaces/DownloadOptions.md
- `youtubei.js` avaliador padrão: https://github.com/LuanRT/YouTube.js/blob/main/src/platform/jsruntime/default.ts
- `youtubei.js` exemplo de download: https://github.com/LuanRT/YouTube.js/blob/main/examples/download/index.ts
- `@distube/ytdl-core` README: https://github.com/distubejs/ytdl-core
- `ytdl-core` README: https://github.com/fent/node-ytdl-core
- `youtube-dl-exec` README: https://github.com/microlinkhq/youtube-dl-exec
- `ffmpeg-static` README: https://github.com/eugeneware/ffmpeg-static
- `@ffmpeg-installer/ffmpeg` README: https://github.com/kribblo/node-ffmpeg-installer
- Metadados npm: https://registry.npmjs.org/
- Código local do Baileys: `node_modules/baileys/lib/Types/Message.d.ts`, `lib/Utils/messages.js`, `lib/Utils/messages-media.js`.

## 15. Observações finais

- `youtubei.js` é promissor, mas o requisito de avaliador JavaScript e a ausência de MP3/merge impedem tratá-lo como solução equivalente à Vex sem validação.
- `yt-dlp` é a alternativa com melhor relação robustez/manutenção, mas o custo de binário, FFmpeg e operação precisa ser aceito explicitamente.
- O Baileys suporta stream, mas não protege streams fornecidos com limite de tamanho; essa responsabilidade é nossa.
- A decisão de arquitetura deve ser tomada antes de qualquer código da Fase 2B. Até lá, `vex` permanece o default e nenhuma dependência deve ser instalada.
