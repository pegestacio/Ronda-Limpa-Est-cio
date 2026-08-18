# ZELO — Estácio

Sistema de gestão e qualidade dos ambientes (React + Vite + Supabase), pronto
para subir no GitHub e hospedar no Vercel. Interface redesenhada como portal
corporativo (sidebar + topbar), mantendo toda a lógica, banco de dados e
integrações do projeto original (código interno ainda referenciado como
"rondalimpa" em alguns arquivos de configuração — só o nome de exibição
virou ZELO, nada no backend mudou).

## 1. Criar o projeto no Supabase

1. Crie um projeto em https://supabase.com (grátis).
2. Vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas (`usuarios`, `ambientes`, `inspecoes`, `notificacoes`)
   e o bucket de storage `evidencias` (fotos das inspeções).
3. Em **Project Settings → API**, copie:
   - `Project URL` → vai virar `VITE_SUPABASE_URL`
   - `anon public key` → vai virar `VITE_SUPABASE_ANON_KEY`

## 2. Rodar localmente (opcional, pra testar antes)

```bash
npm install
cp .env.example .env
# edite o .env com a URL e a anon key do seu projeto Supabase
npm run dev
```

Abra o link que aparecer (geralmente http://localhost:5173).
Na primeira vez, a tela vai pedir pra você criar sua conta de **administrador**.

## 3. Subir no GitHub

```bash
git init
git add .
git commit -m "RondaLimpa"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/rondalimpa.git
git push -u origin main
```

## 4. Hospedar no Vercel

1. Em https://vercel.com, **Add New → Project** → importe o repositório `rondalimpa`.
2. O Vercel detecta automaticamente que é um projeto Vite.
3. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (os mesmos valores do passo 1)
4. Deploy. Pronto — o link do Vercel é o endereço que você compartilha com os
   dois inspetores.

## 5. Primeiro acesso

- Acesse o link → como ainda não existe nenhum usuário, vai aparecer a tela
  "Primeiro acesso" → crie sua conta de **administrador**.
- Entre como admin → aba **Usuários** → crie um acesso (nome, e-mail, senha)
  para cada um dos dois inspetores, com o perfil "Inspetor".
- Use o botão "Credenciais" pra copiar e-mail/senha prontos e mandar pra eles.

## Chat com IA

Tem um botão flutuante (balãozinho azul no canto inferior direito, visível
para administradores) que abre um chat conversacional. Você pode perguntar
coisas como "quantas inspeções foram feitas essa semana?" ou "qual ambiente
tem mais ocorrências de não limpo?" e a IA responde com base nos dados reais
do banco. Usa a mesma chave `GEMINI_API_KEY` já configurada para o resumo.

Para ativar, é a mesma lógica de sempre — crie mais uma Edge Function:

1. No painel do Supabase, **Edge Functions** → **Deploy a new function** →
   nomeie como `chat-ia` (esse nome exato) → cole o conteúdo do arquivo
   `supabase/functions/chat-ia/index.ts` → Deploy.
2. Não precisa criar um novo secret — ele reaproveita o `GEMINI_API_KEY` que
   você já configurou para o resumo.

**Limitação:** o chat envia os dados de ambientes e das últimas inspeções
junto de cada pergunta (não tem "memória" de longo prazo além da conversa
atual, e reinicia ao recarregar a página). Para uma base muito grande de
inspeções, isso pode ficar lento ou caro — nesse caso, dá pra evoluir depois
para um sistema que resuma os dados antes de mandar pra IA.

## Resumo com IA

Na aba **Relatórios**, tem um botão "Gerar resumo" que usa IA (Google Gemini)
para resumir em português as inspeções filtradas — destaques, problemas
recorrentes e uma recomendação. Usa o **Gemini 2.5 Flash**, que tem um nível
gratuito generoso no Google AI Studio (sem precisar cartão de crédito).

Isso funciona através de uma Edge Function do Supabase (`supabase/functions/resumo-ia`),
que guarda a chave da API em segredo no servidor (nunca fica visível no navegador).
Passo a passo para ativar:

1. Vá em https://aistudio.google.com/apikey, entre com uma conta Google e
   clique em **"Create API key"**. Copie a chave gerada (não precisa cartão
   de crédito para o nível gratuito).
2. No painel do Supabase, vá em **Edge Functions** → **Deploy a new function**
   → nomeie como `resumo-ia` → cole o conteúdo do arquivo
   `supabase/functions/resumo-ia/index.ts` → Deploy.
   (Se essa opção de colar código não aparecer no seu painel, dá pra fazer
   pelo terminal com a Supabase CLI: `supabase functions deploy resumo-ia`.)
3. Ainda em Edge Functions, procure **Secrets** (ou em Project Settings →
   Edge Functions) e adicione: nome `GEMINI_API_KEY`, valor a chave que
   você gerou no passo 1.
4. Pronto — o botão "Gerar resumo" na aba Relatórios já deve funcionar.

O nível gratuito do Gemini tem um limite de quantas chamadas por minuto/dia
você pode fazer — bem mais do que suficiente pra um botão que você aciona
manualmente de vez em quando. Se um dia esse limite for um problema, dá pra
migrar pro plano pago do Google ou trocar pra outro provedor de IA.

## Notificação por e-mail

Além da notificação interna (aba Notificações), o app pode enviar um e-mail de
verdade para os administradores sempre que um ambiente for marcado como
"Não Limpo" — usa o **Resend**, que tem nível gratuito (3.000 e-mails/mês).

Passo a passo para ativar:

1. Crie uma conta em https://resend.com usando **o e-mail que você quer
   receber as notificações** (isso importa — veja a observação abaixo).
2. Vá em **API Keys** → **Create API Key** → copie a chave gerada.
3. No painel do Supabase, vá em **Edge Functions** → **Deploy a new function**
   → nomeie como `notificar-email` (esse nome exato) → cole o conteúdo do
   arquivo `supabase/functions/notificar-email/index.ts` → Deploy.
4. Em **Secrets**, adicione: nome `RESEND_API_KEY`, valor a chave copiada no
   passo 2.
5. Pronto — toda vez que um inspetor marcar "Não Limpo", os administradores
   cadastrados (aba Usuários) recebem um e-mail automático.

**Observação importante:** sem verificar um domínio próprio no Resend, só é
possível enviar e-mails para o **mesmo endereço da conta Resend** (é uma
limitação do nível gratuito, para evitar spam). Ou seja: cadastre sua conta
no Resend com o mesmo e-mail que você usa como administrador no RondaLimpa,
que o envio funciona sem custo. Se um dia quiser enviar para vários e-mails
diferentes (não só o seu), será preciso verificar um domínio no Resend
(adicionando alguns registros DNS).

## Sobre o QR Code

Cada ambiente tem um QR Code real (gerado com a lib `qrcode`). Ele guarda um
link do próprio site, tipo `https://seu-site.vercel.app/?ambiente=ID-DO-AMBIENTE`.
Quando o inspetor aponta a câmera do celular (a câmera nativa, sem precisar
abrir o app antes), o navegador abre esse link e — se o inspetor já estiver
logado no celular — cai direto na ficha de inspeção daquele ambiente.

Passo a passo pra usar:
1. Na aba **Ambientes**, clique em "Código" no ambiente desejado e depois em
   "Imprimir" pra colar na porta.
2. No celular do inspetor, ele entra uma vez no site e faz login (o login
   fica salvo no navegador).
3. Nas próximas vezes, é só apontar a câmera pro QR na porta.

## Sobre segurança do login

Para manter simples (só você e mais duas pessoas), o login usa uma tabela
própria (`usuarios`) com e-mail/senha, sem o Supabase Auth. Isso é suficiente
para uso interno, mas a senha fica visível para quem tiver acesso à
`anon key` do projeto. Se um dia quiser reforçar, dá para migrar esse login
para o Supabase Auth (login gerenciado, senhas com hash, recuperação de senha
por e-mail etc.) — é um passo a mais que posso te ajudar a fazer depois.

## Sobre notificação por e-mail

Quando um ambiente é marcado como "Não Limpo", o app cria uma notificação
*dentro do próprio sistema* (aba Notificações do admin) — não dispara e-mail
de verdade. Para e-mail real, dá pra criar uma Supabase Edge Function
disparada por um trigger na tabela `notificacoes`, usando um serviço tipo
Resend ou SendGrid.
