# ViralUp Studio

MVP web responsivo para organizar o fluxo de conteúdo vertical da ViralUp.

## Objetivo

Fluxo inicial:

1. Importar somente material com autorização de uso.
2. Registrar origem, campanha e direitos.
3. Preparar o vídeo em formato vertical 9:16.
4. Aplicar identidade visual ViralUp.
5. Revisar e colocar na fila "Pronto para publicar".
6. Publicar manualmente no Kwai até existir uma integração oficial autorizada e disponível.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy

O projeto inclui `Dockerfile` e está preparado para deploy em serviço compatível com Node.js, incluindo Railway.

## Próximas etapas

- Upload real de vídeo
- Banco de dados
- Metadados de autorização/campanha
- Storage
- Worker FFmpeg 1080x1920
- Branding automático ViralUp
- Histórico de processamento
- Fila de publicação
- Login e painel administrativo

## Segurança

Nunca coloque tokens, senhas ou chaves de API no repositório. Use variáveis de ambiente/secrets do provedor de deploy.
