# 🗺️ Catálogo de Telas e Módulos

Este diretório centraliza a documentação de navegação e a estrutura de segurança (ACL) do sistema.

> Aviso Importante: os documentos canônicos e validados diretamente contra o código-fonte vivem em `../telas`. Os arquivos deste diretório servem como referência geral/histórica. Em caso de divergência, considere `../telas` como a fonte da verdade.

## Estrutura
* Canônico — **[Catálogo de Telas](../telas/catalogo-telas.md)**
* Canônico — **[Matriz de Permissões (ACL)](../telas/matriz-permissoes.md)**
* Referência Geral — **[Catálogo de Telas](./catalogo-telas.md)**
* Referência Geral — **[Matriz de Permissões](./matriz-permissoes.md)**

## Como usar este documento
1.  **Desenvolvimento:** Valide sempre na versão canônica em `../telas` antes de criar/alterar rotas.
2.  **IA / Copilot:** Ao pedir novas features, referencie o catálogo canônico para melhor contexto.
3.  **Segurança:** Use a matriz como guia, mas implemente as regras finais em RLS e guards.
