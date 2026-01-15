# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/5d2bce2b-4d46-4c21-be9d-48f8accf07b0

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/5d2bce2b-4d46-4c21-be9d-48f8accf07b0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

## Development

- Dev server: roda em `http://localhost:8080` (ver `vite.config.ts`).
- VS Code Task: use a tarefa `Dev: Vite` para iniciar o servidor de desenvolvimento.
- Build: `npm run build` gera arquivos em `dist/` e registra o service worker PWA.

## Extensões Recomendadas

- ESLint (`dbaeumer.vscode-eslint`): lint e qualidade de código.
- Prettier (`esbenp.prettier-vscode`): formatação consistente.
- Tailwind CSS (`bradlc.vscode-tailwindcss`): auto-complete/utilitários.
- Supabase (`supabase.supabase-vscode`): integração com banco e policies.

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/5d2bce2b-4d46-4c21-be9d-48f8accf07b0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

ATENÇÃO!
> Neste projeto, documentação é parte do código.
> Toda mudança de módulo exige atualização de:
> - ao menos um diagrama (fluxo/sequência)
> - ao menos um documento textual (manual, funcionalidades, produto ou ADR)
> Pull requests sem documentação não são aceitos.
