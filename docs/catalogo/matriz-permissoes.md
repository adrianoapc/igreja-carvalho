# Matriz de Permissões (ACL)

> ⚠️ Este documento é uma proposta inicial de ACL.  
> A fonte final de autorização é definida por Guards de rota e policies/RLS no Supabase.

Este documento define o nível de acesso esperado para cada Perfil (Role) nos módulos do sistema.
Use este guia para configurar RLS (Row Level Security) e Guards de Rotas.

## Perfis do Sistema (Roles)
* **Admin:** Acesso total (Superusuário).
* **Técnico:** Igual ao Admin + Acesso a configurações de infraestrutura (Logs, Manutenção).
* **Financeiro:** Foco total em Tesouraria + Visualização de Membros.
* **Secretaria:** Foco total em Pessoas, Agenda e Comunicação.
* **Líder (Ministerial):** Gere seu "feudo" (Seu time, sua escala, seu curso).
* **Voluntário:** Operacional (Faz check-in, serve na escala).
* **Membro:** Consumidor (Vê perfil, agenda, faz cursos, doa).

## Matriz de Acesso

| Módulo | Admin / Técnico | Financeiro | Secretaria | Líder | Voluntário | Membro |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Sistema (Config)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pessoas (CRM)** | ✅ | 👁️ (Leitura) | ✅ | ⚠️ (Seu Grupo) | ⚠️ (Criar Contato) | ❌ |
| **Finanças** | ✅ | ✅ | ❌ | ⚠️ (Reembolso) | ❌ | ❌ |
| **Cultos (Liturgia)** | ✅ | ❌ | 👁️ | ✅ | 👁️ | 👁️ (Agenda) |
| **Ensino (Gestão)** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Ensino (Aluno)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Kids (Gestão)** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Kids (Operação)** | ✅ | ❌ | ❌ | ✅ | ✅ | ⚠️ (Checkin) |
| **Escalas (Gestão)** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Escalas (Minhas)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Intercessão** | ✅ | ❌ | ❌ | ✅ | ✅ (Orar) | ⚠️ (Pedir) |
| **Projetos** | ✅ | ❌ | 👁️ | ✅ | ⚠️ (Tarefas) | ❌ |

### Legenda
* ✅ **Total:** Pode Ver, Criar, Editar e Excluir.
* 👁️ **Leitura:** Apenas visualiza dados.
* ⚠️ **Parcial:** Acesso restrito (ex: Apenas dados próprios, ou apenas uma sub-funcionalidade específica).
* ❌ **Sem Acesso:** Bloqueado (403/404).
