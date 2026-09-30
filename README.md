# ViralUp Studio

Pipeline automatizado para vídeos verticais autorizados.

## Automação atual

- Seleção múltipla de vídeos
- Fila automática em sequência
- Perfil de campanha salvo no navegador
- Múltiplas fontes autorizadas: ReelShort / RS Boost, NetShort, Upload próprio e Outro parceiro
- Registro do tipo de autorização por fonte
- Origem, campanha e autorização reaproveitadas automaticamente
- Processamento FFmpeg em 1080x1920
- Marca ViralUp e @ViralUp automáticos
- Título automático
- Legenda automática
- Hashtags automáticas
- Nome de arquivo padronizado
- Capa 9:16 gerada automaticamente a partir do vídeo
- Pacote ZIP com MP4 + capa JPG + legenda TXT + dados JSON
- Biblioteca local persistente em IndexedDB
- Opção de baixar o pacote automaticamente
- Auto-deploy no Render a cada atualização do branch main

## Limite atual

25 MB por vídeo no MVP para manter estabilidade no plano gratuito.

## Publicação

A automação vai até "pacote pronto para publicar". A postagem no Kwai permanece manual até existir uma API oficial autorizada e habilitada para a conta.

## Direitos

O sistema exige origem e referência de autorização antes de processar em modo automático. Não foi implementado scraping nem download não autorizado de plataformas.
