# RondaLimpa

App de controle de limpeza de ambientes (React + Vite + Supabase), pronto para
subir no GitHub e hospedar no Vercel — igual você fez no projeto PEG 2026.

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
