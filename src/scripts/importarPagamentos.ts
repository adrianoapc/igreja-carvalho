import { read, utils } from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export async function importarPagamentosExcel(filePath: string) {
  try {
    // Ler arquivo
    const response = await fetch(filePath);
    const data = await response.arrayBuffer();
    const workbook = read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json(worksheet);

    console.log(`Total de linhas: ${jsonData.length}`);

    // Buscar contas, categorias e fornecedores existentes
    const { data: contas } = await supabase
      .from("contas")
      .select("id, nome")
      .eq("ativo", true);

    const { data: categorias } = await supabase
      .from("categorias_financeiras")
      .select("id, nome")
      .eq("ativo", true)
      .eq("tipo", "saida");

    const { data: fornecedores } = await supabase
      .from("fornecedores")
      .select("id, nome")
      .eq("ativo", true);

    if (!contas || contas.length === 0) {
      throw new Error("Nenhuma conta ativa encontrada");
    }

    // Criar mapas para busca rápida
    const contasMap = new Map(contas.map(c => [c.nome.toLowerCase(), c.id]));
    const categoriasMap = new Map(categorias?.map(c => [c.nome.toLowerCase(), c.id]) || []);
    const fornecedoresMap = new Map(fornecedores?.map(f => [f.nome.toLowerCase(), f.id]) || []);

    const transacoes = [];
    const erros = [];
    const novosFornecedores = new Set<string>();
    const novasCategorias = new Set<string>();

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i];
      
      try {
        // Parse data de vencimento
        let dataVencimento: string | null = null;
        if (row.Vencimento) {
          const vencStr = String(row.Vencimento).trim();
          const [dia, mes, ano] = vencStr.split('/');
          if (dia && mes && ano) {
            dataVencimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          }
        }

        // Parse data de competência
        let dataCompetencia: string | null = null;
        if (row.Competência) {
          const compStr = String(row.Competência).trim();
          const [dia, mes, ano] = compStr.split('/');
          if (dia && mes && ano) {
            dataCompetencia = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
          }
        }

        // Parse data de pagamento
        let dataPagamento: string | null = null;
        if (row['Data do pagamento']) {
          const pagStr = String(row['Data do pagamento']).trim();
          if (pagStr) {
            const [dia, mes, ano] = pagStr.split('/');
            if (dia && mes && ano) {
              dataPagamento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
          }
        }

        const descricao = row.Descrição || '';
        const valorBase = parseFloat(String(row['Valor Base'] || 0).replace(',', '.'));
        
        if (!descricao || !valorBase || !dataVencimento) {
          erros.push(`Linha ${i + 1}: Dados obrigatórios faltando`);
          continue;
        }

        // Buscar conta
        const nomeConta = (row.Conta || '').toLowerCase().trim();
        let contaId = contasMap.get(nomeConta) || contasMap.get('santander') || contas[0].id;

        // Buscar categoria
        let categoriaId = null;
        if (row.Categoria) {
          const nomeCategoria = row.Categoria.toLowerCase().trim();
          categoriaId = categoriasMap.get(nomeCategoria);
          if (!categoriaId) {
            novasCategorias.add(row.Categoria);
          }
        }

        // Buscar fornecedor
        let fornecedorId = null;
        if (row.Fornecedor) {
          const nomeFornecedor = row.Fornecedor.toLowerCase().trim();
          fornecedorId = fornecedoresMap.get(nomeFornecedor);
          if (!fornecedorId) {
            novosFornecedores.add(row.Fornecedor);
          }
        }

        // Determinar status
        const status = dataPagamento ? "pago" : "pendente";

        // Parse valores financeiros
        const juros = parseFloat(String(row.Juros || 0).replace(',', '.')) || 0;
        const multas = parseFloat(String(row.Multas || 0).replace(',', '.')) || 0;
        const desconto = parseFloat(String(row.Desconto || 0).replace(',', '.')) || 0;
        const taxasAdministrativas = parseFloat(String(row['Taxas Administrativas'] || 0).replace(',', '.')) || 0;

        transacoes.push({
          tipo: "saida",
          descricao,
          valor: valorBase,
          data_vencimento: dataVencimento,
          data_pagamento: dataPagamento,
          data_competencia: dataCompetencia,
          status,
          tipo_lancamento: "unico",
          conta_id: contaId,
          categoria_id: categoriaId,
          fornecedor_id: fornecedorId,
          juros,
          multas,
          desconto,
          taxas_administrativas: taxasAdministrativas,
          observacoes: row.Subcategoria ? `Subcategoria: ${row.Subcategoria}` : null,
        });
      } catch (error) {
        erros.push(`Linha ${i + 1}: ${error}`);
      }
    }

    console.log(`Transações processadas: ${transacoes.length}`);
    console.log(`Erros: ${erros.length}`);
    console.log(`Novos fornecedores encontrados: ${Array.from(novosFornecedores).join(', ')}`);
    console.log(`Novas categorias encontradas: ${Array.from(novasCategorias).join(', ')}`);

    if (transacoes.length === 0) {
      throw new Error("Nenhuma transação válida para importar");
    }

    // Inserir em lotes de 100
    const batchSize = 100;
    let totalInserido = 0;

    for (let i = 0; i < transacoes.length; i += batchSize) {
      const batch = transacoes.slice(i, i + batchSize);
      const { error } = await supabase
        .from("transacoes_financeiras")
        .insert(batch);

      if (error) {
        console.error(`Erro no lote ${i / batchSize + 1}:`, error);
        throw error;
      }

      totalInserido += batch.length;
      console.log(`Inserido: ${totalInserido}/${transacoes.length}`);
    }

    return {
      success: true,
      total: transacoes.length,
      erros: erros.length,
      novosFornecedores: Array.from(novosFornecedores),
      novasCategorias: Array.from(novasCategorias),
    };
  } catch (error) {
    console.error("Erro ao importar:", error);
    throw error;
  }
}
