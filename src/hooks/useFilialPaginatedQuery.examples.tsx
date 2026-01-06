/**
 * EXEMPLOS DE USO DO HOOK useFilialPaginatedQuery
 *
 * Este arquivo contém exemplos práticos de como usar o hook em diferentes cenários
 */

import {
  useFilialPaginatedQuery,
  flattenPaginatedData,
} from "@/hooks/useFilialPaginatedQuery";

// ============================================================
// EXEMPLO 1: Pedidos de Oração (SalaDeGuerra)
// ============================================================

export function ExemploPedidosOracaoPaginados() {
  const { igrejaId, filialId, isAllFiliais } = {}; // Vem do AuthContext

  // Com filtros
  const { data, fetchNextPage, hasNextPage, isLoading, error } =
    useFilialPaginatedQuery({
      table: "pedidos_oracao",
      select: `
      *,
      intercessores(nome),
      profiles!pedidos_oracao_pessoa_id_fkey(nome)
    `,
      filters: {
        status: "pendente", // Opcional: pode ser undefined
      },
      orderBy: {
        column: "data_criacao",
        ascending: false,
      },
      igrejaId: igrejaId || null,
      filialId: filialId || null,
      isAllFiliais: isAllFiliais ?? false,
    });

  const pedidos = flattenPaginatedData(data?.pages || []);

  return (
    <div>
      {isLoading && <p>Carregando pedidos...</p>}
      {error && <p>Erro: {error.message}</p>}

      <ul>
        {pedidos.map((pedido: any) => (
          <li key={pedido.id}>{pedido.pedido}</li>
        ))}
      </ul>

      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Carregar mais</button>
      )}
    </div>
  );
}

// ============================================================
// EXEMPLO 2: Eventos com Range de Datas (Escalas)
// ============================================================

export function ExemploEventosPaginados() {
  const { igrejaId, filialId, isAllFiliais } = {}; // Vem do AuthContext
  const inicioMes = new Date("2026-01-01").toISOString();
  const fimMes = new Date("2026-01-31").toISOString();

  // Sem filtros simples - usando query manual para range
  const { data, fetchNextPage, hasNextPage, isLoading } =
    useFilialPaginatedQuery({
      table: "eventos",
      select: "id, titulo, data_evento, tipo",
      filters: {}, // Range de datas requer query manual
      orderBy: {
        column: "data_evento",
        ascending: true,
      },
      igrejaId: igrejaId || null,
      filialId: filialId || null,
      isAllFiliais: isAllFiliais ?? false,
    });

  const eventos = flattenPaginatedData(data?.pages || []);

  return (
    <div>
      {isLoading && <p>Carregando eventos...</p>}

      <table>
        <thead>
          <tr>
            <th>Título</th>
            <th>Data</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento: any) => (
            <tr key={evento.id}>
              <td>{evento.titulo}</td>
              <td>{evento.data_evento}</td>
              <td>{evento.tipo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Carregar mais eventos</button>
      )}
    </div>
  );
}

// ============================================================
// EXEMPLO 3: Transações Financeiras com Filtros Múltiplos
// ============================================================

export function ExemploTransacoesPaginadas() {
  const { igrejaId, filialId, isAllFiliais } = {}; // Vem do AuthContext
  const [tipoFiltro, setTipoFiltro] = React.useState("saida");
  const [statusFiltro, setStatusFiltro] = React.useState("pendente");

  const { data, fetchNextPage, hasNextPage, isLoading } =
    useFilialPaginatedQuery({
      table: "transacoes_financeiras",
      select: `
      id, descricao, valor, data_vencimento, 
      status, tipo, centro_custo_id
    `,
      filters: {
        tipo: tipoFiltro,
        status: statusFiltro,
      },
      orderBy: {
        column: "data_vencimento",
        ascending: true,
      },
      igrejaId: igrejaId || null,
      filialId: filialId || null,
      isAllFiliais: isAllFiliais ?? false,
    });

  const transacoes = flattenPaginatedData(data?.pages || []);

  return (
    <div>
      <div>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
        >
          <option value="saida">Saídas</option>
          <option value="entrada">Entradas</option>
        </select>

        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
        >
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
      </div>

      {isLoading && <p>Carregando transações...</p>}

      <table>
        <tbody>
          {transacoes.map((t: any) => (
            <tr key={t.id}>
              <td>{t.descricao}</td>
              <td>R$ {t.valor}</td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasNextPage && (
        <button onClick={() => fetchNextPage()}>Carregar mais</button>
      )}
    </div>
  );
}

// ============================================================
// EXEMPLO 4: Testemunhos com Paginação Inline
// ============================================================

export function ExemploTestemunhosPaginados() {
  const { igrejaId, filialId, isAllFiliais } = {}; // Vem do AuthContext

  const { data, fetchNextPage, hasNextPage, isLoading } =
    useFilialPaginatedQuery({
      table: "testemunhos",
      select: `
      *,
      profiles!testemunhos_autor_id_fkey(nome)
    `,
      filters: {
        publicar: true, // Apenas públicos
      },
      orderBy: {
        column: "created_at",
        ascending: false,
      },
      igrejaId: igrejaId || null,
      filialId: filialId || null,
      isAllFiliais: isAllFiliais ?? false,
    });

  const testemunhos = flattenPaginatedData(data?.pages || []);

  return (
    <div className="space-y-4">
      {testemunhos.map((t: any) => (
        <div key={t.id} className="border p-4 rounded">
          <h3 className="font-bold">{t.titulo}</h3>
          <p className="text-sm text-gray-600">Por {t.profiles?.nome}</p>
          <p>{t.mensagem}</p>
        </div>
      ))}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isLoading}
          className="w-full py-2 bg-blue-500 text-white rounded"
        >
          {isLoading ? "Carregando..." : "Ver mais testemunhos"}
        </button>
      )}
    </div>
  );
}

// ============================================================
// EXEMPLO 5: Com Disable Condicional (Esperar contexto carregar)
// ============================================================

export function ExemploComDisableCondicional() {
  const { igrejaId, filialId, isAllFiliais, loading: authLoading } = {}; // Vem do AuthContext

  // Query só executa quando authLoading = false
  const { data, fetchNextPage, hasNextPage } = useFilialPaginatedQuery({
    table: "pedidos_oracao",
    select: "*",
    filters: {},
    orderBy: { column: "data_criacao", ascending: false },
    igrejaId: igrejaId || null,
    filialId: filialId || null,
    isAllFiliais: isAllFiliais ?? false,
    enabled: !authLoading && !!igrejaId, // Condicional
  });

  const pedidos = flattenPaginatedData(data?.pages || []);

  if (authLoading) return <p>Autenticando...</p>;

  return <div>{pedidos.length} pedidos carregados</div>;
}

// ============================================================
// EXEMPLO 6: Diferença entre isAllFiliais=true vs false
// ============================================================

/**
 * Quando isAllFiliais = false:
 * Query: SELECT * FROM pedidos_oracao
 *        WHERE igreja_id = $1 AND filial_id = $2
 * Retorna: Apenas registros da filial específica
 *
 * Quando isAllFiliais = true:
 * Query: SELECT * FROM pedidos_oracao
 *        WHERE igreja_id = $1
 *        (sem filtro filial_id)
 * Retorna: Todos os registros da Igreja (de todas as filiais)
 * Paginado: 50 por página
 */

export function ExemploComparacaoIsAllFiliais() {
  const { igrejaId, filialId, isAllFiliais } = {}; // Vem do AuthContext

  const { data: pages = [] } = useFilialPaginatedQuery({
    table: "pedidos_oracao",
    select: "*",
    igrejaId: igrejaId || null,
    filialId: filialId || null,
    isAllFiliais: isAllFiliais ?? false, // ← Faz diferença aqui
  });

  const totalPedidos = pages.flat().length;

  return (
    <div>
      <p>
        Visualizando:
        {isAllFiliais ? "Todas as filiais" : <>Filial: {filialId}</>}
      </p>
      <p>Total carregado: {totalPedidos} registros</p>
    </div>
  );
}
