# ViralUp Studio

Aplicação web responsiva para preparar vídeos verticais autorizados.

## Funcional na versão atual

- Upload real de vídeo no navegador
- Registro de origem, campanha e autorização de uso
- Processamento server-side com FFmpeg
- Saída MP4 1080x1920 em 9:16 sem esticar o conteúdo
- Biblioteca persistente no próprio navegador usando IndexedDB
- Visualização, download e exclusão de vídeos processados
- Auto-deploy pelo Render conectado ao branch main

## Limite atual

A primeira versão limita cada vídeo a 25 MB para manter o processamento estável no plano gratuito.

Os arquivos processados ficam armazenados localmente no aparelho/navegador do usuário. Isso evita depender de storage externo neste MVP e mantém o conteúdo fora do repositório.

## Publicação

A publicação no Kwai permanece manual até existir uma integração/API oficial autorizada e disponível para a conta.

## Segurança

Nunca coloque tokens, senhas ou chaves de API no GitHub.
