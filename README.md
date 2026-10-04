# ViralUp Studio

Studio mobile-first de criação de conteúdo com IA, com o pipeline anterior preservado em `/pipeline`.

## Núcleo novo

- Foto → vídeo de produto
- Texto/imagem → vídeo
- UGC e avatar como fluxos de criação
- Miniaturas e imagens com IA
- Projetos e fila de processamento
- Créditos por usuário
- Login/cadastro via Supabase
- Compra de créditos via Mercado Pago
- APK Android WebView apontando para o deploy oficial

## Provedores

### Vídeo
- **Google Veo 3.1**: integração direta pela Gemini API (`predictLongRunning`)
- **Kling 2.6 Pro**: integração pela fila da fal.ai

### Imagem
- **OpenAI GPT Image 2.5 Flare** por padrão

> A Videos API / Sora 2 da OpenAI foi removida em 24/09/2026. Por isso o projeto não usa endpoint de vídeo obsoleto da OpenAI.

## Banco e autenticação

Execute `supabase/migrations/20261004_studio.sql` no SQL Editor do projeto Supabase. Depois configure no servidor:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

O banco cria `profiles`, `projects`, `payments` e funções atômicas de crédito.

## Pagamentos

Configure `MERCADOPAGO_ACCESS_TOKEN`. O checkout usa Preferences API e o webhook valida o pagamento consultando a API do Mercado Pago antes de liberar créditos.

## Deploy

O projeto continua compatível com Next.js no Render. O repositório existente pode continuar com auto-deploy do branch `main`.

## Android

O diretório `android/` contém um shell nativo com WebView. O workflow `.github/workflows/android-apk.yml` gera `viralup-studio-debug.apk` como artifact do GitHub Actions.

## Segurança

- chaves privadas somente no servidor
- créditos descontados via função SQL atômica
- webhook de pagamento confere o pagamento diretamente no Mercado Pago
- RLS habilitado nas tabelas do Supabase
